import { createClient } from "@/lib/supabase/server";
import type { PaperSize } from "@/lib/worksheets/types";

export type ProfileRow = {
  display_name: string | null;
  locale: string;
  paper_size: PaperSize;
};

export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name, locale, paper_size")
    .eq("id", user.id)
    .single();
  return data;
}
