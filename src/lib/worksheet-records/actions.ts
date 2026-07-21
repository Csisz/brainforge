"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGenerator } from "@/lib/worksheets/registry";
import { reserveGeneration } from "@/lib/entitlements/queries";
import { freshSeed } from "@/lib/random";
import type { RewardFamily } from "@/lib/worksheets/generators/reward-chart";

/**
 * Catalog "print for this child": persists a session-less worksheet RECIPE
 * (fresh seed, params null ⇒ defaultParams at render time) and hands off to the
 * existing print route. No SVG is stored — the print page renders from this
 * recipe on demand, deriving age/difficulty/theme from the child (there is no
 * owning session). RLS scopes the insert to the signed-in owner.
 */
export async function printWorksheetForChild(
  generatorId: string,
  childId: string,
  locale: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const generator = getGenerator(generatorId); // throws on unknown id (trusted catalog input)

  // Security A2: catalog printing counts against the weekly free cap, like any
  // other generation. Reserve atomically BEFORE the insert; if denied (over the
  // weekly cap or rate-limited), return the typed error and create nothing.
  const reservation = await reserveGeneration(user.id);
  if (!reservation.allowed) return { error: reservation.reason ?? "quota_exceeded" };

  const { data, error } = await supabase
    .from("worksheets")
    .insert({
      owner_id: user.id,
      child_id: childId,
      session_id: null,
      generator_id: generator.id,
      generator_version: generator.version,
      params: null,
      seed: freshSeed(),
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "insert_failed" };

  redirect(`/${locale}/app/worksheets/${data.id}/print`);
}

/**
 * Print a reward collection sheet with a chosen motif (Sprint 8 M3). A `family`
 * pins the motif; null means "Meglepetés" — leave params null so the generator
 * picks a family from the seed. Fresh seed each time, so every print is a new,
 * unique sheet. Same persist-then-print handoff as printWorksheetForChild.
 */
export async function printRewardChart(
  childId: string,
  family: RewardFamily | null,
  locale: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const generator = getGenerator("reward_chart");

  // reward_chart is intentionally quota-exempt (motivation tool, not learning
  // content), see A2 skip — it does NOT consume the weekly free cap. The
  // anti-abuse rate limit still applies, so we reserve a non-quota unit
  // (countsQuota: false). If the product decision changes to count it, flip this
  // to the default reserve.
  const reservation = await reserveGeneration(user.id, { countsQuota: false });
  if (!reservation.allowed) return { error: reservation.reason ?? "rate_limited" };

  const { data, error } = await supabase
    .from("worksheets")
    .insert({
      owner_id: user.id,
      child_id: childId,
      session_id: null,
      generator_id: generator.id,
      generator_version: generator.version,
      params: family ? { n: 21, family } : null,
      seed: freshSeed(),
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "insert_failed" };

  redirect(`/${locale}/app/worksheets/${data.id}/print`);
}
