"use server";

import { createClient } from "@/lib/supabase/server";
import type { ThemeId } from "@/lib/worksheets/types";

export type CreateChildInput = {
  nickname: string;
  birthMonth: string; // "YYYY-MM" from <input type="month">
  avatar: string;
  preferredThemes: ThemeId[];
  accessibility: { lowInk: boolean; highContrast: boolean; motorSupport: boolean };
};

export async function createChild(input: CreateChildInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase.from("children").insert({
    owner_id: user.id,
    nickname: input.nickname,
    birth_month: `${input.birthMonth}-01`,
    avatar: input.avatar,
    preferred_themes: input.preferredThemes,
    accessibility: input.accessibility,
  });

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
