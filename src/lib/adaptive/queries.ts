import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevelopmentGoal, Difficulty, Age } from "@/lib/worksheets/types";
import type { StoredSessionPlan } from "@/lib/activities/engine";
import type { AdaptivePlan } from "@/lib/activities/engine";
import { calibrate, coldStartLevel, type Calibration, type GoalOutcome } from "./engine";

/**
 * The DB half of the adaptive layer: load rows, hand them to the pure engine,
 * write back what it decides. No rule lives here — if you are about to add an
 * `if` about levels to this file, it belongs in engine.ts where it can be
 * tested without a database.
 */

export type CalibrationRow = {
  goal: DevelopmentGoal;
  level: Difficulty;
  last_step_up_at: string | null;
  pending_anchor: boolean;
};

const toCalibration = (r: CalibrationRow): Calibration => ({
  level: r.level,
  lastStepUpAt: r.last_step_up_at ? new Date(r.last_step_up_at) : null,
  pendingAnchor: r.pending_anchor,
});

export async function getCalibration(childId: string): Promise<CalibrationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calibration")
    .select("goal, level, last_step_up_at, pending_anchor")
    .eq("child_id", childId);
  return (data ?? []) as CalibrationRow[];
}

/**
 * Resolve what the composer needs for this child: a level per goal, plus any
 * variety rotation and the anchor owed after a step-down.
 *
 * `adaptive_enabled === false` or a manual difficulty override ⇒ undefined, and
 * the composer falls back to the session-wide level. Feedback is still recorded
 * in both cases, so calibration keeps learning quietly and a parent who turns
 * the toggle back on does not start from scratch.
 */
export async function resolveAdaptivePlan(
  childId: string,
  age: Age,
  goals: DevelopmentGoal[],
): Promise<AdaptivePlan | undefined> {
  const supabase = await createClient();
  const rows = await getCalibration(childId);
  const byGoal = new Map(rows.map((r) => [r.goal, r]));

  const levelByGoal: Partial<Record<DevelopmentGoal, Difficulty>> = {};
  const avoidByGoal: Partial<Record<DevelopmentGoal, string[]>> = {};
  for (const goal of goals) {
    const row = byGoal.get(goal);
    // A goal with no row has never been calibrated: start it one below the age
    // default rather than at the session level, so a first sheet is winnable.
    levelByGoal[goal] = row ? row.level : coldStartLevel(age);
  }

  // rotate_variety is decided at feedback time and recorded by the composer's
  // caller; here it is expressed as the goal's 3 most recent generator ids.
  const anchorGoal = goals.find((g) => byGoal.get(g)?.pending_anchor);
  const anchor = anchorGoal
    ? await bestGeneratorForGoal(supabase, childId, anchorGoal).then((generatorId) =>
        generatorId ? { goal: anchorGoal, generatorId } : undefined,
      )
    : undefined;

  return { levelByGoal, avoidByGoal, anchor };
}

/**
 * The generator this child has historically done best at for a goal — the one
 * we lead with after a hard session. "Best" is highest mean success across that
 * goal's worksheet slots; ties break toward the more recent.
 *
 * Takes its client rather than reaching for one: this is the anchor rule, and it
 * must be drivable from a test harness, not only from inside a request.
 */
export async function bestGeneratorForGoal(
  supabase: SupabaseClient,
  childId: string,
  goal: DevelopmentGoal,
): Promise<string | null> {
  const outcomes = await goalOutcomesByGenerator(supabase, childId, goal);
  let best: { id: string; score: number } | null = null;
  for (const [id, scores] of outcomes) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (!best || mean > best.score) best = { id, score: mean };
  }
  return best?.id ?? null;
}

/** Per-generator success scores for a goal, newest sessions first. */
async function goalOutcomesByGenerator(
  supabase: SupabaseClient,
  childId: string,
  goal: DevelopmentGoal,
): Promise<Map<string, number[]>> {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, plan, completed_at")
    .eq("child_id", childId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  const out = new Map<string, number[]>();
  if (!sessions?.length) return out;

  const { data: feedback } = await supabase
    .from("feedback")
    .select("session_id, slot_index, success_rate, completed")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    );

  for (const session of sessions) {
    const slots = (session.plan as StoredSessionPlan)?.slots ?? [];
    slots.forEach((slot, i) => {
      if (slot.kind !== "worksheet" || slot.goal !== goal) return;
      const fb = feedback?.find((f) => f.session_id === session.id && f.slot_index === i);
      if (!fb) return;
      const score = fb.success_rate ?? (fb.completed ? 1 : 0);
      out.set(slot.recipe.generatorId, [...(out.get(slot.recipe.generatorId) ?? []), Number(score)]);
    });
  }
  return out;
}

/** The goal's 3 most recent generator ids — what rotate_variety steps away from. */
export async function recentGeneratorsForGoal(
  supabase: SupabaseClient,
  childId: string,
  goal: DevelopmentGoal,
  limit = 3,
): Promise<string[]> {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("plan, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(20);

  const ids: string[] = [];
  for (const s of sessions ?? []) {
    for (const slot of ((s.plan as StoredSessionPlan)?.slots ?? [])) {
      if (slot.kind === "worksheet" && slot.goal === goal && !ids.includes(slot.recipe.generatorId)) {
        ids.push(slot.recipe.generatorId);
      }
    }
    if (ids.length >= limit) break;
  }
  return ids.slice(0, limit);
}

/**
 * Aggregate one session into per-goal outcomes, using each worksheet slot's
 * recorded goal. Slots without a goal are pre-Sprint-5 and contribute nothing:
 * we would rather calibrate on less data than guess which goal a sheet trained.
 */
export function outcomesFromSession(
  plan: StoredSessionPlan,
  feedback: Array<{ slot_index: number; success_rate: number | null; enjoyment: number | null; completed: boolean }>,
  sessionId: string,
): Map<DevelopmentGoal, GoalOutcome> {
  const byGoal = new Map<DevelopmentGoal, { success: number[]; enjoy: number[]; completed: boolean }>();

  plan.slots.forEach((slot, i) => {
    if (slot.kind !== "worksheet" || !slot.goal) return;
    const fb = feedback.find((f) => f.slot_index === i);
    if (!fb) return;
    const acc = byGoal.get(slot.goal) ?? { success: [], enjoy: [], completed: true };
    if (fb.success_rate !== null) acc.success.push(Number(fb.success_rate));
    if (fb.enjoyment !== null) acc.enjoy.push(fb.enjoyment);
    acc.completed = acc.completed && fb.completed;
    byGoal.set(slot.goal, acc);
  });

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const out = new Map<DevelopmentGoal, GoalOutcome>();
  for (const [goal, acc] of byGoal) {
    out.set(goal, {
      sessionId,
      successRate: mean(acc.success),
      enjoyment: mean(acc.enjoy),
      completed: acc.completed,
    });
  }
  return out;
}

/**
 * Run calibration for a finished session. Idempotent per session: the caller
 * guards on sessions.calibration_processed_at, because a parent can submit
 * feedback twice and one bad afternoon must not step a child down twice.
 */
export async function runCalibrationForSession(
  supabase: SupabaseClient,
  sessionId: string,
  childId: string,
  ownerId: string,
  age: Age,
  now = new Date(),
): Promise<Map<DevelopmentGoal, ReturnType<typeof calibrate>>> {
  const results = new Map<DevelopmentGoal, ReturnType<typeof calibrate>>();

  // Claim the session first: the conditional update is the lock. If another
  // submit already claimed it, we do nothing rather than double-apply.
  const { data: claimed } = await supabase
    .from("sessions")
    .update({ calibration_processed_at: now.toISOString() })
    .eq("id", sessionId)
    .is("calibration_processed_at", null)
    .select("id, plan")
    .maybeSingle();
  if (!claimed) return results;

  const { data: feedback } = await supabase
    .from("feedback")
    .select("slot_index, success_rate, enjoyment, completed")
    .eq("session_id", sessionId);

  const outcomes = outcomesFromSession(
    claimed.plan as StoredSessionPlan,
    (feedback ?? []).map((f) => ({ ...f, success_rate: f.success_rate === null ? null : Number(f.success_rate) })),
    sessionId,
  );
  if (outcomes.size === 0) return results;

  const { data: rows } = await supabase
    .from("calibration")
    .select("goal, level, last_step_up_at, pending_anchor")
    .eq("child_id", childId);
  const byGoal = new Map((rows ?? []).map((r) => [r.goal as DevelopmentGoal, r as CalibrationRow]));

  for (const [goal, outcome] of outcomes) {
    const history = await priorOutcomes(supabase, childId, goal, sessionId);
    const row = byGoal.get(goal);
    const decision = calibrate({
      now,
      age,
      current: row ? toCalibration(row) : null,
      recent: [outcome, ...history],
    });
    results.set(goal, decision);

    await supabase.from("calibration").upsert(
      {
        child_id: childId,
        owner_id: ownerId,
        goal,
        level: decision.level,
        last_step_up_at: decision.lastStepUpAt?.toISOString() ?? null,
        pending_anchor: decision.pendingAnchor,
        updated_at: now.toISOString(),
      },
      { onConflict: "child_id,goal" },
    );
  }
  return results;
}

/** This goal's earlier outcomes (excluding the session being processed), newest first. */
async function priorOutcomes(
  supabase: SupabaseClient,
  childId: string,
  goal: DevelopmentGoal,
  excludeSessionId: string,
  limit = 5,
): Promise<GoalOutcome[]> {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, plan, completed_at")
    .eq("child_id", childId)
    .eq("status", "completed")
    .neq("id", excludeSessionId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (!sessions?.length) return [];

  const { data: feedback } = await supabase
    .from("feedback")
    .select("session_id, slot_index, success_rate, enjoyment, completed")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    );

  const out: GoalOutcome[] = [];
  for (const s of sessions) {
    const rows = (feedback ?? [])
      .filter((f) => f.session_id === s.id)
      .map((f) => ({ ...f, success_rate: f.success_rate === null ? null : Number(f.success_rate) }));
    const o = outcomesFromSession(s.plan as StoredSessionPlan, rows, s.id).get(goal);
    if (o) out.push(o);
  }
  return out;
}

/** Clear the anchor once a session has actually been composed with it. */
export async function clearAnchor(childId: string, goal: DevelopmentGoal): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("calibration")
    .update({ pending_anchor: false, updated_at: new Date().toISOString() })
    .eq("child_id", childId)
    .eq("goal", goal);
}
