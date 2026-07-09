import { createClient } from "@/lib/supabase/server";

export type ChildRow = {
  id: string;
  nickname: string;
  birth_month: string;
  avatar: string;
  preferred_themes: string[];
  accessibility: { lowInk?: boolean; highContrast?: boolean; motorSupport?: boolean };
};

export async function getChildren(): Promise<ChildRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, nickname, birth_month, avatar, preferred_themes, accessibility")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getChild(id: string): Promise<ChildRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, nickname, birth_month, avatar, preferred_themes, accessibility")
    .eq("id", id)
    .single();
  return data;
}
