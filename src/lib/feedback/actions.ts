"use server";

import { createClient } from "@/lib/supabase/server";
import { evaluateAchievements } from "@/lib/achievements";
import { runCalibrationForSession } from "@/lib/adaptive/queries";
import { getChild } from "@/lib/children/queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { EASE_SUCCESS } from "./ease";
import { sessionFeedbackSchema } from "./schemas";
import { zUuid } from "@/lib/validation/common";
import type { SlotFeedback } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

// EASE_SUCCESS (./ease) and SlotFeedback (./types) live outside this module — a
// "use server" file may export only async functions, so no value or type is
// declared or re-exported here. Callers import them from those modules directly.

export async function submitSessionFeedback(
  sessionId: string,
  entries: SlotFeedback[],
): Promise<{ error?: string }> {
  if (!zUuid.safeParse(sessionId).success || !sessionFeedbackSchema.safeParse(entries).success) {
    return { error: "invalid_input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // Atomic finalize (Stability B1): the feedback rows (upserted on the slot key,
  // so a double-submit writes no duplicates) and the session-completion state are
  // written in ONE transaction inside finalize_feedback. Ownership is re-enforced
  // in the RPC (A3b). Calibration runs only AFTER this commits, so it never sees a
  // partially-written session.
  const { data, error } = await supabase.rpc("finalize_feedback", {
    p_owner: user.id,
    p_session: sessionId,
    p_entries: entries.map((e) => ({
      slotIndex: e.slotIndex,
      slotKind: e.slotKind,
      completed: e.completed,
      enjoyment: e.enjoyment,
      successRate: e.ease ? EASE_SUCCESS[e.ease] : null,
    })),
  });
  if (error) return { error: error.message };
  const result = data as { child_id?: string; error?: string };
  if (result.error) return { error: result.error };

  // Achievements + calibration are best-effort side effects on the now-committed,
  // complete session — never fail the feedback save. Calibration is idempotent
  // per session inside.
  if (result.child_id) {
    try {
      await awardAchievements(supabase, result.child_id, user.id);
    } catch {
      /* ignore — feedback already saved */
    }
    try {
      const child = await getChild(result.child_id);
      if (child) {
        await runCalibrationForSession(
          supabase,
          sessionId,
          result.child_id,
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
