"use server";

import { createClient } from "@/lib/supabase/server";
import type { SessionSlot } from "@/lib/activities/engine";

export type SlotFeedback = {
  slotIndex: number;
  slotKind: SessionSlot["kind"];
  completed: boolean;
  enjoyment: number | null;
};

export async function submitSessionFeedback(
  sessionId: string,
  entries: SlotFeedback[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error: feedbackError } = await supabase.from("feedback").insert(
    entries.map((e) => ({
      session_id: sessionId,
      owner_id: user.id,
      slot_index: e.slotIndex,
      slot_kind: e.slotKind,
      completed: e.completed,
      enjoyment: e.enjoyment,
    })),
  );
  if (feedbackError) return { error: feedbackError.message };

  const { error: sessionError } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (sessionError) return { error: sessionError.message };

  return {};
}
