"use server";

import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/children/queries";
import { getRecentWorksheets, getRecentActivityKeys } from "./queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { composeSession, type MaterialId } from "@/lib/activities/engine";
import { resolveAdaptivePlan, clearAnchor, clearRotate } from "@/lib/adaptive/queries";
import { defaultDifficulty } from "@/lib/activities/difficulty";
import { freshSeed } from "@/lib/random";
import { startSessionSchema } from "./schemas";
import type { DevelopmentGoal, Difficulty, ThemeId } from "@/lib/worksheets/types";

// Internal-only input type — not exported (see the "use server" export rule).
type StartSessionInput = {
  childId: string;
  goals: DevelopmentGoal[];
  theme: ThemeId;
  durationMin: 10 | 20 | 30 | 45;
  materials: MaterialId[];
  /**
   * null ⇒ "Automatikus": let calibration choose a level per goal. A number is
   * the parent's manual override and wins for the whole session — but feedback
   * is still recorded either way, so calibration keeps learning quietly and the
   * toggle is never a one-way door.
   */
  difficulty: Difficulty | null;
  /** Per-submit key so a double-submit yields one session, not two (B1). */
  idempotencyKey: string;
  locale: string;
};

export async function startSession(input: StartSessionInput): Promise<{ sessionId?: string; error?: string }> {
  // B2: validate the raw payload before anything touches the DB or the RPC. A
  // malformed call (bad uuid, unknown goal/theme, out-of-range difficulty) is
  // rejected here as invalid_input; the RPC's failure paths stay for genuine
  // business rejections (forbidden_child, quota).
  if (!startSessionSchema.safeParse(input).success) return { error: "invalid_input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const child = await getChild(input.childId);
  if (!child) return { error: "child_not_found" };

  const age = ageFromBirthMonth(child.birth_month);
  const [recentWorksheets, recentActivities] = await Promise.all([
    getRecentWorksheets(input.childId),
    getRecentActivityKeys(input.childId),
  ]);

  // Adaptive is consulted only when the parent left the slider on Automatic AND
  // this child has it enabled. A manual override wins for this session.
  const useAdaptive = input.difficulty === null && child.adaptive_enabled !== false;
  const adaptive = useAdaptive ? await resolveAdaptivePlan(input.childId, age, input.goals) : undefined;

  // The session-wide fallback: what a manual override says, or the age default
  // for the rows the adaptive plan does not cover.
  const sessionDifficulty = input.difficulty ?? defaultDifficulty(age);

  const plan = composeSession({
    childId: input.childId,
    age,
    goals: input.goals,
    theme: input.theme,
    durationMin: input.durationMin,
    materials: input.materials,
    difficulty: sessionDifficulty,
    recentWorksheets,
    recentActivities,
    locale: input.locale,
    adaptive,
  });

  // The anchor is a one-shot promise: spend it only if a slot actually used it.
  const anchorUsed =
    adaptive?.anchor &&
    plan.slots.some(
      (s) => s.kind === "worksheet" && s.recipe.generatorId === adaptive.anchor!.generatorId,
    );

  // The session's worksheet recipes for the atomic insert (B1). Gating/rate limit
  // and the quota reservation are decided INSIDE the RPC, in one transaction with
  // the inserts: a rate limit hard-fails, being over the weekly cap soft-gates
  // (session with no worksheet, no unit consumed), and any failure rolls the whole
  // thing back — no orphaned session, no consumed quota.
  const worksheets = plan.slots
    .filter((slot) => slot.kind === "worksheet")
    .map((slot) => ({
      generatorId: slot.recipe.generatorId,
      generatorVersion: slot.recipe.generatorVersion,
      params: slot.recipe.params,
      seed: slot.recipe.seed,
      goal: slot.goal,
    }));

  const { data, error } = await supabase.rpc("create_session", {
    p_owner: user.id,
    p_child: input.childId,
    p_goals: input.goals,
    p_theme: input.theme,
    p_duration: input.durationMin,
    p_materials: input.materials,
    p_difficulty: sessionDifficulty,
    p_seed: freshSeed(),
    p_plan: plan,
    p_worksheets: worksheets,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { error: error.message };
  const result = data as { session_id?: string; gated?: boolean; error?: string };
  if (result.error) return { error: result.error };
  if (!result.session_id) return { error: "session_insert_failed" };

  // The session exists (committed): spend the one-shot anchor/rotate now. Both
  // are idempotent flag clears, so a resubmit that returned the same session is
  // harmless.
  if (anchorUsed && adaptive?.anchor) await clearAnchor(input.childId, adaptive.anchor.goal);
  const worksheetGoals = new Set(plan.slots.filter((s) => s.kind === "worksheet").map((s) => s.goal));
  for (const goal of Object.keys(adaptive?.avoidByGoal ?? {}) as DevelopmentGoal[]) {
    if (worksheetGoals.has(goal)) await clearRotate(input.childId, goal);
  }

  return { sessionId: result.session_id };
}
