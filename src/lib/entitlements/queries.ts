import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAllowance, WINDOW_DAYS, type Allowance, type PlanTier } from "./limits";

/**
 * ENTITLEMENTS — read + reserve.
 *
 * `reserveGeneration` is the ONE gate every worksheet-creating path goes through
 * (Security A2). It is an atomic check-and-reserve in Postgres (reserve_generation
 * RPC): counting and recording happen in a single locked transaction, so two
 * concurrent requests at cap-1 cannot both pass. Do NOT reintroduce a
 * read-then-write gate in app code — that has a TOCTOU race.
 *
 * `getGenerationAllowance` is a read for DISPLAY only (settings usage, the upgrade
 * card's unlock time). It counts the same ledger the reserve writes, so the number
 * shown matches what the gate enforces.
 */

export type ReserveReason = "rate_limited" | "quota_exceeded" | "forbidden" | "not_authenticated" | null;
export type Reservation = { allowed: boolean; reason: ReserveReason; remaining: number; unlimited: boolean };

/**
 * Atomically reserve `count` generation units for the owner.
 * - count: 1 for a single sheet/session, N for an N-worksheet pack (all-or-nothing).
 * - countsQuota: false for reward charts — rate-limited but exempt from the weekly
 *   free cap (motivation tool, see A2 in printRewardChart).
 * Fails closed: any RPC error denies generation.
 */
export async function reserveGeneration(
  ownerId: string,
  opts: { count?: number; countsQuota?: boolean } = {},
  client?: SupabaseClient,
): Promise<Reservation> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_generation", {
    p_owner: ownerId,
    p_count: opts.count ?? 1,
    p_counts_quota: opts.countsQuota ?? true,
  });
  if (error || !data) {
    // Fail closed — never grant generation when the reserve could not be recorded.
    return { allowed: false, reason: "quota_exceeded", remaining: 0, unlimited: false };
  }
  return data as Reservation;
}

/**
 * The DB half of plan gating, for DISPLAY. Reads the account's tier and its recent
 * quota-counting ledger rows, then lets the pure `evaluateAllowance` decide. The
 * ledger is written only by reserve_generation, so this matches the gate exactly.
 */
export async function getGenerationAllowance(
  ownerId: string,
  now = new Date(),
  client?: SupabaseClient,
): Promise<Allowance> {
  const supabase = client ?? (await createClient());

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const tier = (sub?.tier ?? "free") as PlanTier;

  // Only the window matters; fetch a little past it to be safe against clock skew.
  const since = new Date(now.getTime() - (WINDOW_DAYS + 1) * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from("generation_ledger")
    .select("created_at")
    .eq("owner_id", ownerId)
    .eq("counts_quota", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const generatedAt = (rows ?? []).map((r) => new Date(r.created_at as string));
  return evaluateAllowance({ tier, generatedAt, now });
}
