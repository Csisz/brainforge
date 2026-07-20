"use server";

import { createClient } from "@/lib/supabase/server";
import { evaluateAchievements } from "@/lib/achievements";
import { runCalibrationForSession } from "@/lib/adaptive/queries";
import { getChild } from "@/lib/children/queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { EASE_SUCCESS } from "./ease";
import type { SlotFeedback } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

// EASE_SUCCESS (./ease) and SlotFeedback (./types) live outside this module — a
// "use server" file may export only async functions, so no value or type is
// declared or re-exported here. Callers import them from those modules directly.

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
      success_rate: e.ease ? EASE_SUCCESS[e.ease] : null,
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

    // Calibration likewise: a child's next session being mis-levelled is a
    // worse outcome than a lost update, but neither justifies losing feedback
    // the parent already gave us. Idempotent per session inside.
    try {
      const child = await getChild(session.child_id);
      if (child) {
        await runCalibrationForSession(
          supabase,
          sessionId,
          session.child_id,
          user.id,
          ageFromBirthMonth(child.birth_month),
        );
      }
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
