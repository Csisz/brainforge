"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/children/queries";
import { getRecentWorksheets, getRecentActivityKeys } from "@/lib/sessions/queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { composeSession, type MaterialId } from "@/lib/activities/engine";
import { resolveAdaptivePlan } from "@/lib/adaptive/queries";
import { getGenerationAllowance, isRateLimited } from "@/lib/entitlements/queries";
import { packFits } from "@/lib/entitlements/limits";
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
): Promise<{ error?: string; gated?: { unlockAt: string | null } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const child = await getChild(input.childId);
  if (!child) return { error: "child_not_found" };
  if (await isRateLimited(user.id)) return { error: "rate_limited" };

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

  // Gate the WHOLE pack against the free allowance — all-or-nothing.
  const worksheetCount = plans.reduce(
    (n, p) => n + p.slots.filter((s) => s.kind === "worksheet").length,
    0,
  );
  const allowance = await getGenerationAllowance(user.id);
  if (!packFits(allowance, worksheetCount)) {
    return { gated: { unlockAt: allowance.unlockAt?.toISOString() ?? null } };
  }

  // Persist: one pack_id, N planned sessions + their worksheet rows (which count
  // toward the weekly limit, exactly like a normal session's).
  const packId = crypto.randomUUID();
  for (const plan of plans) {
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .insert({
        child_id: input.childId,
        owner_id: user.id,
        goals: PACK_GOALS,
        theme: input.theme,
        duration_min: input.durationMin,
        materials: PACK_MATERIALS,
        difficulty,
        seed: freshSeed(),
        plan,
        status: "planned",
        worksheets_gated: false,
        pack_id: packId,
      })
      .select("id")
      .single();
    if (sErr || !session) return { error: sErr?.message ?? "session_insert_failed" };

    const worksheetRows = plan.slots
      .filter((s) => s.kind === "worksheet")
      .map((s) => ({
        session_id: session.id,
        child_id: input.childId,
        owner_id: user.id,
        generator_id: s.recipe.generatorId,
        generator_version: s.recipe.generatorVersion,
        params: s.recipe.params,
        seed: s.recipe.seed,
        goal: s.goal,
      }));
    if (worksheetRows.length) {
      const { error: wErr } = await supabase.from("worksheets").insert(worksheetRows);
      if (wErr) return { error: wErr.message };
    }
  }

  redirect(`/${input.locale}/app/pack/${packId}/print`);
}
