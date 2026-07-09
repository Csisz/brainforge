import { createClient } from "@/lib/supabase/server";

export type WorksheetRecord = {
  id: string;
  child_id: string;
  session_id: string | null;
  generator_id: string;
  generator_version: number;
  params: unknown;
  seed: string;
};

export async function getWorksheet(id: string): Promise<WorksheetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("worksheets")
    .select("id, child_id, session_id, generator_id, generator_version, params, seed")
    .eq("id", id)
    .single();
  return data;
}

export async function getSessionWorksheets(sessionId: string): Promise<WorksheetRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("worksheets")
    .select("id, child_id, session_id, generator_id, generator_version, params, seed")
    .eq("session_id", sessionId);
  return data ?? [];
}
