"use server";

import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/children/queries";
import { getRecentWorksheets } from "./queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { composeSession, type MaterialId } from "@/lib/activities/engine";
import { freshSeed } from "@/lib/random";
import type { DevelopmentGoal, Difficulty, ThemeId } from "@/lib/worksheets/types";

export type StartSessionInput = {
  childId: string;
  goals: DevelopmentGoal[];
  theme: ThemeId;
  durationMin: 10 | 20 | 30 | 45;
  materials: MaterialId[];
  difficulty: Difficulty;
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

  const recentWorksheets = await getRecentWorksheets(input.childId);
  const plan = composeSession({
    childId: input.childId,
    age: ageFromBirthMonth(child.birth_month),
    goals: input.goals,
    theme: input.theme,
    durationMin: input.durationMin,
    materials: input.materials,
    difficulty: input.difficulty,
    recentWorksheets,
    locale: input.locale,
  });

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      child_id: input.childId,
      owner_id: user.id,
      goals: input.goals,
      theme: input.theme,
      duration_min: input.durationMin,
      materials: input.materials,
      difficulty: input.difficulty,
      seed: freshSeed(),
      plan,
      status: "active",
    })
    .select("id")
    .single();

  if (sessionError || !session) return { error: sessionError?.message ?? "session_insert_failed" };

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
