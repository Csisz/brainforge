"use server";

import { createClient } from "@/lib/supabase/server";
import type { SessionSlot } from "@/lib/activities/engine";
import { evaluateAchievements } from "@/lib/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("child_id")
    .single();
  if (sessionError) return { error: sessionError.message };

  // Achievements are a best-effort side effect — never fail the feedback save.
  if (session?.child_id) {
    try {
      await awardAchievements(supabase, session.child_id, user.id);
    } catch {
      /* ignore — feedback already saved */
    }
  }

  return {};
}

/**
 * Evaluate the child's history and idempotently record any newly earned
 * achievements. The unique(child_id, kind) constraint makes re-inserts no-ops,
 * so we can safely upsert every currently-qualifying kind.
 */
async function awardAchievements(
  supabase: SupabaseClient,
  childId: string,
  ownerId: string,
): Promise<void> {
  const [sessions, worksheets] = await Promise.all([
    supabase.from("sessions").select("completed_at").eq("child_id", childId).eq("status", "completed"),
    supabase.from("worksheets").select("generator_id").eq("child_id", childId),
  ]);

  const completedSessionDays = (sessions.data ?? [])
    .map((s) => s.completed_at)
    .filter((d): d is string => Boolean(d))
    .map((d) => d.slice(0, 10)); // YYYY-MM-DD (UTC)
  const worksheetGeneratorIds = (worksheets.data ?? []).map((w) => w.generator_id as string);

  const earned = evaluateAchievements({ completedSessionDays, worksheetGeneratorIds });
  if (earned.length === 0) return;

  await supabase
    .from("achievements")
    .upsert(
      earned.map((kind) => ({ child_id: childId, owner_id: ownerId, kind })),
      { onConflict: "child_id,kind", ignoreDuplicates: true },
    );
}
