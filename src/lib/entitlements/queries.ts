import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateAllowance,
  withinRateLimit,
  RATE_LIMIT_WINDOW_SEC,
  WINDOW_DAYS,
  type Allowance,
  type PlanTier,
} from "./limits";

/**
 * The DB half of plan gating: read the account's tier and its recent worksheet
 * timestamps, then let the pure `evaluateAllowance` decide. All rows are
 * owner-scoped by RLS, so the count is the account's own generations.
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
    .from("worksheets")
    .select("created_at")
    .eq("owner_id", ownerId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const generatedAt = (rows ?? []).map((r) => new Date(r.created_at as string));
  return evaluateAllowance({ tier, generatedAt, now });
}

/**
 * Abuse rate limit: is another generation allowed right now? Reuses the same
 * owner-scoped worksheets count (worksheets_owner_recent_idx), over a seconds
 * window. Applies to every tier — this is anti-hammering, not plan gating.
 */
export async function isRateLimited(ownerId: string, now = new Date(), client?: SupabaseClient): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();
  const { data } = await supabase
    .from("worksheets")
    .select("created_at")
    .eq("owner_id", ownerId)
    .gte("created_at", since);
  const generatedAt = (data ?? []).map((r) => new Date(r.created_at as string));
  return !withinRateLimit(generatedAt, now);
}
