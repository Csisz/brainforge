"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/children/queries";
import { getRecentWorksheets, getRecentActivityKeys } from "@/lib/sessions/queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { composeSession, type MaterialId } from "@/lib/activities/engine";
import { resolveAdaptivePlan } from "@/lib/adaptive/queries";
import { defaultDifficulty } from "@/lib/activities/difficulty";
import { freshSeed } from "@/lib/random";
import type { DevelopmentGoal } from "@/lib/worksheets/types";
import type { CreatePackInput } from "./types";

/** A weekly pack draws worksheets from a broad goal set so the days vary; the
 * composer's own anti-repetition (now accumulated across the pack) keeps them
 * from clumping. Parents pick days + length, not goals — a pack is print-ahead
 * variety, not a targeted single session. */
const PACK_GOALS: DevelopmentGoal[] = [
  "attention", "fine_motor", "visual_perception", "problem_solving", "pre_writing", "math_thinking",
];
const PACK_MATERIALS: MaterialId[] = ["pencil", "paper", "crayons", "scissors", "glue", "blocks", "tape"];

/**
 * Compose a whole "Heti csomag" at once (Sprint 8 M2). Calibration is FIXED for
 * the pack — the levels are resolved once, with no anchor/rotate one-shots (those
 * belong to interactive sessions); feedback on packed sessions shapes the *next*
 * pack. The pack is gated all-or-nothing: if its worksheets would exceed the free
 * allowance the whole thing is declined (upgrade notice), never a partial pack.
 */
export async function createPack(
  input: CreatePackInput,
): Promise<{ error?: string; gated?: boolean }> {
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

  const useAdaptive = child.adaptive_enabled !== false;
  const resolved = useAdaptive ? await resolveAdaptivePlan(input.childId, age, PACK_GOALS) : undefined;
  const adaptive = resolved ? { levelByGoal: resolved.levelByGoal } : undefined;
  const difficulty = defaultDifficulty(age);

  // Compose every day, accumulating anti-repetition across the pack's own days
  // (plus the child's real history) so a 7-day pack does not repeat itself.
  const usedWorksheets = [...recentWorksheets];
  const usedActivities = [...recentActivities];
  const plans = Array.from({ length: input.days }, () => {
    const plan = composeSession({
      childId: input.childId,
      age,
      goals: PACK_GOALS,
      theme: input.theme,
      durationMin: input.durationMin,
      materials: PACK_MATERIALS,
      difficulty,
      recentWorksheets: usedWorksheets,
      recentActivities: usedActivities,
      locale: input.locale,
      adaptive,
    });
    for (const s of plan.slots) {
      if (s.kind === "worksheet") usedWorksheets.push({ generatorId: s.recipe.generatorId, seed: s.recipe.seed });
      else usedActivities.push(s.activityKey);
    }
    return plan;
  });

  // Persist the WHOLE pack in one transaction via the RPC (Stability B1): all N
  // sessions + their worksheets are inserted all-or-nothing, and the quota is
  // reserved for the pack's worksheet count in the SAME transaction — so a failure
  // (or an over-cap decline) leaves neither a partial pack nor a consumed unit.
  // The client-supplied pack_id is the idempotency key: a resubmit is a no-op.
  const packSessions = plans.map((plan) => ({
    seed: freshSeed(),
    plan,
    worksheets: plan.slots
      .filter((s) => s.kind === "worksheet")
      .map((s) => ({
        generatorId: s.recipe.generatorId,
        generatorVersion: s.recipe.generatorVersion,
        params: s.recipe.params,
        seed: s.recipe.seed,
        goal: s.goal,
      })),
  }));

  const { data, error } = await supabase.rpc("create_pack", {
    p_owner: user.id,
    p_child: input.childId,
    p_pack_id: input.packId,
    p_theme: input.theme,
    p_duration: input.durationMin,
    p_materials: PACK_MATERIALS,
    p_goals: PACK_GOALS,
    p_difficulty: difficulty,
    p_sessions: packSessions,
  });
  if (error) return { error: error.message };
  const result = data as { pack_id?: string; gated?: boolean; error?: string };
  if (result.error === "rate_limited") return { error: "rate_limited" };
  if (result.error) return { error: result.error };
  if (result.gated) return { gated: true };

  redirect(`/${input.locale}/app/pack/${input.packId}/print`);
}
