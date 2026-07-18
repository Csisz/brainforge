import { createClient } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/sessions/queries";

/**
 * The sessions of a weekly pack (Sprint 8 M2), in day order. RLS scopes it to the
 * owner, so an unknown or someone else's pack id simply returns nothing.
 */
export async function getPackSessions(packId: string): Promise<SessionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("pack_id", packId)
    .order("created_at", { ascending: true });
  return (data ?? []) as SessionRow[];
}
