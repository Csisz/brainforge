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
