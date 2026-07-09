import { createClient } from "@/lib/supabase/server";

export async function getRecentWorksheets(
  childId: string,
  limit = 20,
): Promise<Array<{ generatorId: string; seed: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("worksheets")
    .select("generator_id, seed")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((w) => ({ generatorId: w.generator_id, seed: w.seed }));
}

export type SessionRow = {
  id: string;
  child_id: string;
  goals: string[];
  theme: string;
  duration_min: number;
  materials: string[];
  difficulty: number;
  plan: unknown;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export async function getSession(id: string): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select("*").eq("id", id).single();
  return data;
}
