"use server";

import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/children/queries";
import { getRecentWorksheets } from "./queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { composeSession, type MaterialId } from "@/lib/activities/engine";
import { resolveAdaptivePlan, clearAnchor } from "@/lib/adaptive/queries";
import { defaultDifficulty } from "@/lib/activities/difficulty";
import { freshSeed } from "@/lib/random";
import type { DevelopmentGoal, Difficulty, ThemeId } from "@/lib/worksheets/types";

export type StartSessionInput = {
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
  locale: string;
};

export async function startSession(input: StartSessionInput): Promise<{ sessionId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const child = await getChild(input.childId);
  if (!child) return { error: "child_not_found" };

  const age = ageFromBirthMonth(child.birth_month);
  const recentWorksheets = await getRecentWorksheets(input.childId);

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
    locale: input.locale,
    adaptive,
  });

  // The anchor is a one-shot promise: spend it only if a slot actually used it.
  const anchorUsed =
    adaptive?.anchor &&
    plan.slots.some(
      (s) => s.kind === "worksheet" && s.recipe.generatorId === adaptive.anchor!.generatorId,
    );

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      child_id: input.childId,
      owner_id: user.id,
      goals: input.goals,
      theme: input.theme,
      duration_min: input.durationMin,
      materials: input.materials,
      difficulty: sessionDifficulty,
      seed: freshSeed(),
      plan,
      status: "active",
    })
    .select("id")
    .single();

  if (sessionError || !session) return { error: sessionError?.message ?? "session_insert_failed" };

  // Clear the anchor only after the session it was owed to exists.
  if (anchorUsed && adaptive?.anchor) await clearAnchor(input.childId, adaptive.anchor.goal);

  const worksheetRows = plan.slots
    .filter((slot) => slot.kind === "worksheet")
    .map((slot) => ({
      session_id: session.id,
      child_id: input.childId,
      owner_id: user.id,
      generator_id: slot.recipe.generatorId,
      generator_version: slot.recipe.generatorVersion,
      params: slot.recipe.params,
      seed: slot.recipe.seed,
    }));

  if (worksheetRows.length > 0) {
    const { error: worksheetsError } = await supabase.from("worksheets").insert(worksheetRows);
    if (worksheetsError) return { error: worksheetsError.message };
  }

  return { sessionId: session.id };
}
