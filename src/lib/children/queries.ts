import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENT_KINDS, type AchievementKind } from "@/lib/achievements";

export type ChildRow = {
  id: string;
  nickname: string;
  birth_month: string;
  avatar: string;
  preferred_themes: string[];
  accessibility: { lowInk?: boolean; highContrast?: boolean; motorSupport?: boolean };
  /** Sprint 5: per-child adaptive difficulty opt-out. */
  adaptive_enabled: boolean;
};

export async function getChildren(): Promise<ChildRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, nickname, birth_month, avatar, preferred_themes, accessibility, adaptive_enabled")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getChild(id: string): Promise<ChildRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, nickname, birth_month, avatar, preferred_themes, accessibility, adaptive_enabled")
    .eq("id", id)
    .single();
  return data;
}

/** Earned achievement kinds per child (RLS-scoped to the owner), catalog order. */
export async function getAchievementsByChild(): Promise<Record<string, AchievementKind[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("achievements")
    .select("child_id, kind")
    .order("earned_at", { ascending: true });
  const known = new Set<string>(ACHIEVEMENT_KINDS);
  const out: Record<string, AchievementKind[]> = {};
  for (const row of data ?? []) {
    if (!known.has(row.kind)) continue; // ignore any legacy/unknown kinds
    (out[row.child_id] ??= []).push(row.kind as AchievementKind);
  }
  // Present each child's badges in catalog order for a stable render.
  for (const id of Object.keys(out)) {
    out[id] = ACHIEVEMENT_KINDS.filter((k) => out[id]!.includes(k));
  }
  return out;
}
