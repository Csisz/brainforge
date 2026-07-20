"use server";

import { createClient } from "@/lib/supabase/server";
import type { PaperSize } from "@/lib/worksheets/types";

// Internal-only input type — not exported (see the "use server" export rule).
type UpdateProfileInput = {
  displayName: string;
  paperSize: PaperSize;
};

export async function updateProfile(input: UpdateProfileInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: input.displayName, paper_size: input.paperSize })
    .eq("id", user.id);

  return error ? { error: error.message } : {};
}
