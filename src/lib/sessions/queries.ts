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

/**
 * Physical activity keys from the child's most recent sessions (Sprint 8 M1b),
 * for cross-session anti-repetition. Reads the stored plans (the activity keys
 * are already there — nothing new to persist) and flattens the non-worksheet
 * slots. RLS scopes it to the owner.
 */
export async function getRecentActivityKeys(childId: string, sessions = 2): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("plan")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(sessions);
  const keys: string[] = [];
  for (const row of data ?? []) {
    const plan = row.plan as { slots?: Array<{ kind: string; activityKey?: string }> } | null;
    for (const slot of plan?.slots ?? []) {
      if (slot.kind !== "worksheet" && slot.activityKey) keys.push(slot.activityKey);
    }
  }
  return keys;
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
  worksheets_gated: boolean;
};

export async function getSession(id: string): Promise<SessionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select("*").eq("id", id).single();
  return data;
}

export type SessionListItem = SessionRow & {
  children: { nickname: string; avatar: string } | null;
};

export async function getSessions(): Promise<SessionListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*, children(nickname, avatar)")
    .order("created_at", { ascending: false });
  return (data ?? []) as SessionListItem[];
}
