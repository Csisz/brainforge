"use server";

import { createClient } from "@/lib/supabase/server";
import { canAddChild, type PlanTier } from "@/lib/entitlements/limits";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import type { ThemeId } from "@/lib/worksheets/types";

export type CreateChildInput = {
  nickname: string;
  birthMonth: string; // "YYYY-MM" from <input type="month">
  avatar: string;
  preferredThemes: ThemeId[];
  accessibility: { lowInk: boolean; highContrast: boolean; motorSupport: boolean };
  /** For localizing the welcome email sent after the first child. */
  locale: string;
};

/** `error: "child_limit_reached"` is a signal, not a message — the UI shows a
 * warm upgrade prompt for it, never a raw error. */
export async function createChild(input: CreateChildInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // Child cap is per tier (PLAN_LIMITS). Enforced here, server-side — never a
  // client claim. Existing children are never touched; we only decline to add.
  const [{ data: sub }, { count }] = await Promise.all([
    supabase.from("subscriptions").select("tier").eq("owner_id", user.id).maybeSingle(),
    supabase.from("children").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  const tier = (sub?.tier ?? "free") as PlanTier;
  if (!canAddChild(tier, count ?? 0)) return { error: "child_limit_reached" };

  const { error } = await supabase.from("children").insert({
    owner_id: user.id,
    nickname: input.nickname,
    birth_month: `${input.birthMonth}-01`,
    avatar: input.avatar,
    preferred_themes: input.preferredThemes,
    accessibility: input.accessibility,
  });
  if (error) return { error: error.message };

  // First child ⇒ welcome note. Decorative and best-effort: sendWelcomeEmail
  // never throws and its result is ignored, so a missing/failing email provider
  // never affects onboarding.
  if ((count ?? 0) === 0 && user.email) {
    void sendWelcomeEmail(user.email, input.locale, input.nickname);
  }

  return {};
}

export type UpdateChildInput = {
  nickname: string;
  birthMonth: string; // "YYYY-MM" from the birth-month dropdowns
  avatar: string;
  preferredThemes: ThemeId[];
  accessibility: { lowInk: boolean; highContrast: boolean; motorSupport: boolean };
};

/**
 * Edit an existing child (Sprint 7 M1). RLS scopes the update to the owner, so a
 * child id from another account simply matches no row. adaptive_enabled is left
 * alone here — it has its own toggle.
 */
export async function updateChild(childId: string, input: UpdateChildInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase
    .from("children")
    .update({
      nickname: input.nickname,
      birth_month: `${input.birthMonth}-01`,
      avatar: input.avatar,
      preferred_themes: input.preferredThemes,
      accessibility: input.accessibility,
    })
    .eq("id", childId);
  return error ? { error: error.message } : {};
}

/**
 * Delete a child (Sprint 7 M1). RLS scopes it to the owner; the foreign keys
 * cascade, so sessions, worksheets, feedback, achievements and calibration for
 * this child go with it. The UI gates this behind a typed nickname confirmation.
 */
export async function deleteChild(childId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase.from("children").delete().eq("id", childId);
  return error ? { error: error.message } : {};
}

/**
 * Per-child adaptive difficulty opt-out (Sprint 5 M4). RLS scopes the update to
 * the owner, so a child id from another account simply matches no row.
 */
export async function setAdaptiveEnabled(childId: string, enabled: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase
    .from("children")
    .update({ adaptive_enabled: enabled })
    .eq("id", childId);
  return error ? { error: error.message } : {};
}
