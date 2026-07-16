/**
 * M5 acceptance flow test (headless).
 * Drives the real chain against local Supabase:
 *   signup (magic link via Mailpit) → child → session containing a dual_path
 *   worksheet → print render → feedback → achievement row.
 *
 * Run: npx tsx scripts/flow-test.ts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { composeSession, type SessionSlot } from "../src/lib/activities/engine";
import type { DevelopmentGoal } from "../src/lib/worksheets/types";
import { composeWorksheet, defaultRenderOptions } from "../src/lib/worksheets/page";
import { evaluateAchievements, ACHIEVEMENT_KINDS } from "../src/lib/achievements";
import { runCalibrationForSession, bestGeneratorForGoal, recentGeneratorsForGoal } from "../src/lib/adaptive/queries";
import { coldStartLevel } from "../src/lib/adaptive/engine";
import { EASE_SUCCESS } from "../src/lib/feedback/actions";
import { getGenerationAllowance } from "../src/lib/entitlements/queries";
import { freshSeed } from "../src/lib/random";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAILPIT = "http://localhost:54324";
const OUT = process.env.FLOW_OUT ?? ".";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${detail ? "  — " + detail : ""}`);
  if (!cond) failures++;
};
const step = (n: string) => console.log(`\n── ${n}`);

async function main() {
  const email = `flow-${Date.now()}@example.test`;
  const supabase = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1 ── SIGNUP via magic link -------------------------------------------
  step(`1. signup — ${email}`);
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  ok("magic link requested", !otpErr, otpErr?.message);
  if (otpErr) return;

  // Poll Mailpit for the message.
  let token = "";
  for (let i = 0; i < 25 && !token; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=1`)).json();
    if (!list.messages?.length) continue;
    const raw = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
    const body = `${raw.Text ?? ""} ${raw.HTML ?? ""}`;
    token = (body.match(/token_hash=([a-zA-Z0-9._-]+)/) ?? body.match(/[?&]token=([a-zA-Z0-9._-]+)/) ?? [])[1] ?? "";
  }
  ok("magic link delivered to Mailpit", Boolean(token), token ? `token_hash=${token.slice(0, 10)}…` : "no token found");
  if (!token) return;

  const { data: verified, error: vErr } = await supabase.auth.verifyOtp({ token_hash: token, type: "email" });
  ok("magic link verifies → session", !vErr && Boolean(verified?.user), vErr?.message);
  const user = verified!.user!;

  // The signup trigger must have created profile + free subscription.
  const { data: prof } = await supabase.from("profiles").select("id").eq("id", user.id).single();
  ok("handle_new_user created profile", Boolean(prof));
  const { data: sub } = await supabase.from("subscriptions").select("tier").eq("owner_id", user.id).single();
  ok("handle_new_user created free subscription", sub?.tier === "free", `tier=${sub?.tier}`);

  // 2 ── CHILD ------------------------------------------------------------
  step("2. child");
  const birth = new Date();
  birth.setFullYear(birth.getFullYear() - 6); // age 6 → inside dual_path's [5,10]
  const { data: child, error: cErr } = await supabase
    .from("children")
    .insert({
      owner_id: user.id,
      nickname: "Lili",
      birth_month: birth.toISOString().slice(0, 8) + "01",
      avatar: "star",
      preferred_themes: ["space"],
      accessibility: {},
    })
    .select("id, nickname")
    .single();
  ok("child created under RLS", !cErr && Boolean(child), cErr?.message);
  if (!child) return;

  // RLS proof: an anonymous client must not see this child.
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: leaked } = await anon.from("children").select("id").eq("id", child.id);
  ok("RLS hides the child from an unauthenticated client", (leaked ?? []).length === 0);

  // 3 ── SESSION containing dual_path -------------------------------------
  step("3. session with a dual_path worksheet");
  let plan = null as ReturnType<typeof composeSession> | null;
  let dual: Extract<SessionSlot, { kind: "worksheet" }> | undefined;
  for (let i = 0; i < 40 && !dual; i++) {
    plan = composeSession({
      childId: child.id,
      age: 6,
      goals: ["bilateral_coordination", "attention"],
      theme: "space",
      durationMin: 30,
      materials: ["pencil", "paper", "cups", "ball"],
      difficulty: 3,
      recentWorksheets: [],
      locale: "hu",
    });
    dual = plan.slots.find(
      (s): s is Extract<SessionSlot, { kind: "worksheet" }> =>
        s.kind === "worksheet" && s.recipe.generatorId === "dual_path",
    );
  }
  ok("composer produced a dual_path worksheet slot", Boolean(dual), dual ? `seed=${dual.recipe.seed.slice(0, 8)}…` : "not selected in 40 tries");
  if (!dual || !plan) return;

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .insert({
      child_id: child.id,
      owner_id: user.id,
      goals: ["bilateral_coordination", "attention"],
      theme: "space",
      duration_min: 30,
      materials: ["pencil", "paper", "cups", "ball"],
      difficulty: 3,
      seed: freshSeed(),
      plan,
      status: "planned",
    })
    .select("id")
    .single();
  ok("session row persisted", !sErr && Boolean(session), sErr?.message);
  if (!session) return;

  const { error: wErr } = await supabase.from("worksheets").insert({
    session_id: session.id,
    child_id: child.id,
    owner_id: user.id,
    generator_id: dual.recipe.generatorId,
    generator_version: dual.recipe.generatorVersion,
    params: dual.recipe.params,
    seed: dual.recipe.seed,
  });
  ok("worksheet recipe persisted (no SVG stored)", !wErr, wErr?.message);

  // Uniqueness guarantee: same (child, generator, seed) must be rejected.
  const { error: dupErr } = await supabase.from("worksheets").insert({
    session_id: session.id,
    child_id: child.id,
    owner_id: user.id,
    generator_id: dual.recipe.generatorId,
    generator_version: dual.recipe.generatorVersion,
    params: dual.recipe.params,
    seed: dual.recipe.seed,
  });
  ok("unique(child,generator,seed) rejects a repeat", Boolean(dupErr), dupErr?.code);

  // 4 ── PRINT render ------------------------------------------------------
  step("4. print render");
  const page = composeWorksheet(dual.recipe, {
    age: 6,
    difficulty: 3,
    theme: "space",
    render: defaultRenderOptions("hu"),
  }, { childName: child.nickname });
  ok("dual_path renders an A4 page", page.svg.includes('width="210mm"'));
  const colors = [...new Set([...page.svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase()))];
  const meaningful = colors.filter((c) => {
    const r = c.slice(1, 3), g = c.slice(3, 5), b = c.slice(5, 7);
    return !(r === g && g === b); // not a pure gray
  });
  ok("dual_path keeps meaningful (non-gray) header colors", meaningful.length >= 2, meaningful.slice(0, 6).join(" "));
  // Re-render must be byte-identical (recipe, not file).
  const again = composeWorksheet(dual.recipe, {
    age: 6, difficulty: 3, theme: "space", render: defaultRenderOptions("hu"),
  }, { childName: child.nickname });
  ok("same recipe re-renders byte-identically", again.svg === page.svg);
  writeFileSync(`${OUT}/flow-dual_path.svg`, page.svg);

  // 5 ── FEEDBACK (mirrors submitSessionFeedback) --------------------------
  step("5. feedback");
  const entries = plan.slots.map((s, i) => ({
    session_id: session.id,
    owner_id: user.id,
    slot_index: i,
    slot_kind: s.kind,
    completed: true,
    enjoyment: 5,
  }));
  const { error: fErr } = await supabase.from("feedback").insert(entries);
  ok(`feedback saved for all ${entries.length} slots`, !fErr, fErr?.message);

  const { data: done, error: upErr } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", session.id)
    .select("child_id")
    .single();
  ok("session marked completed", !upErr && done?.child_id === child.id, upErr?.message);

  // 6 ── ACHIEVEMENTS (same logic as awardAchievements) --------------------
  step("6. achievements");
  const award = async () => {
    const [sessions, worksheets] = await Promise.all([
      supabase.from("sessions").select("completed_at").eq("child_id", child.id).eq("status", "completed"),
      supabase.from("worksheets").select("generator_id").eq("child_id", child.id),
    ]);
    const earned = evaluateAchievements({
      completedSessionDays: (sessions.data ?? []).map((s) => s.completed_at).filter(Boolean).map((d: string) => d.slice(0, 10)),
      worksheetGeneratorIds: (worksheets.data ?? []).map((w) => w.generator_id as string),
    });
    if (!earned.length) return earned;
    await supabase.from("achievements").upsert(
      earned.map((kind) => ({ child_id: child.id, owner_id: user.id, kind })),
      { onConflict: "child_id,kind", ignoreDuplicates: true },
    );
    return earned;
  };

  const earned = await award();
  ok("evaluate → first_session earned", earned.includes("first_session"), earned.join(", "));
  ok("evaluate → first_print earned", earned.includes("first_print"));

  const readBack = async () =>
    ((await supabase.from("achievements").select("kind").eq("child_id", child.id)).data ?? []).map((r) => r.kind);
  const first = await readBack();
  ok("achievement rows visible for the child card", first.length === earned.length, first.join(", "));
  ok("kinds are all in the code catalog", first.every((k) => (ACHIEVEMENT_KINDS as readonly string[]).includes(k)));

  await award(); // idempotency: re-running must not duplicate
  const second = await readBack();
  ok("re-awarding is idempotent (unique constraint holds)", second.length === first.length, `${first.length} → ${second.length}`);

  // 7 ── ADAPTIVE CALIBRATION (Sprint 5) -----------------------------------
  // Everything above proves one session. This proves the loop: what a child
  // does changes what they are given next.
  step("7. adaptive calibration");
  const GOAL = "fine_motor" as const;

  /**
   * Run a whole session for GOAL at a given outcome, through the real code:
   * compose → persist → feedback → runCalibrationForSession. `at` lets us place
   * a session in the past to exercise the 7-day gate without waiting a week.
   */
  async function playSession(
    ease: "easy" | "hard",
    enjoyment: number,
    goal: DevelopmentGoal = GOAL,
    at = new Date(),
  ) {
    const adaptive = await currentPlan(goal);
    const plan = composeSession({
      childId: child!.id,
      age: 6,
      goals: [goal],
      theme: "space",
      durationMin: 30,
      materials: ["pencil", "paper", "cups", "ball"],
      difficulty: 3,
      recentWorksheets: [],
      locale: "hu",
      adaptive,
    });
    const { data: s } = await supabase
      .from("sessions")
      .insert({
        child_id: child!.id, owner_id: user.id, goals: [goal], theme: "space",
        duration_min: 30, materials: ["pencil", "paper"], difficulty: 3,
        seed: freshSeed(), plan, status: "completed", completed_at: at.toISOString(),
      })
      .select("id")
      .single();

    // Worksheet rows carry the goal, so recentGeneratorsForGoal can find them —
    // and so this mirrors what startSession actually persists.
    const sheets = plan.slots.filter((slot) => slot.kind === "worksheet");
    if (sheets.length) {
      await supabase.from("worksheets").insert(
        sheets.map((slot) => ({
          session_id: s!.id, child_id: child!.id, owner_id: user.id,
          generator_id: slot.recipe.generatorId, generator_version: slot.recipe.generatorVersion,
          params: slot.recipe.params, seed: slot.recipe.seed, goal: slot.goal,
        })),
      );
    }

    // Consume the pending flags at compose time, exactly as startSession does —
    // BEFORE this session's own feedback could set them again.
    await supabase.from("calibration").update({ pending_anchor: false })
      .eq("child_id", child!.id).eq("goal", goal).eq("pending_anchor", true);
    if (goal in adaptive.avoidByGoal) {
      await supabase.from("calibration").update({ rotate_pending: false })
        .eq("child_id", child!.id).eq("goal", goal);
    }

    const rows = plan.slots.map((slot, i) => ({
      session_id: s!.id, owner_id: user.id, slot_index: i, slot_kind: slot.kind,
      completed: true, enjoyment,
      success_rate: slot.kind === "worksheet" ? EASE_SUCCESS[ease] : null,
    }));
    await supabase.from("feedback").insert(rows);
    await runCalibrationForSession(supabase, s!.id, child!.id, user.id, 6, at);
    return { sessionId: s!.id, plan, avoid: adaptive.avoidByGoal[goal] ?? [] };
  }

  const currentPlan = async (goal: DevelopmentGoal = GOAL) => {
    const { data } = await supabase
      .from("calibration")
      .select("goal, level, last_step_up_at, pending_anchor, rotate_pending")
      .eq("child_id", child!.id);
    const row = (data ?? []).find((r) => r.goal === goal);
    const anchorGen = row?.pending_anchor ? await bestGeneratorForGoal(supabase, child!.id, goal) : null;
    const avoidByGoal: Partial<Record<DevelopmentGoal, string[]>> = {};
    if (row?.rotate_pending) avoidByGoal[goal] = await recentGeneratorsForGoal(supabase, child!.id, goal);
    return {
      levelByGoal: { [goal]: row?.level ?? coldStartLevel(6) },
      avoidByGoal,
      anchor: anchorGen ? { goal, generatorId: anchorGen } : undefined,
    };
  };
  const levelNow = async (goal: DevelopmentGoal = GOAL) => {
    const { data } = await supabase
      .from("calibration")
      .select("level, pending_anchor, last_step_up_at, rotate_pending")
      .eq("child_id", child!.id)
      .eq("goal", goal)
      .maybeSingle();
    return data;
  };

  // Cold start: a first impression must be winnable (age default 3, minus one).
  ok("cold start is one below the age default", coldStartLevel(6) === 2, `level ${coldStartLevel(6)}`);

  // --- A hard session drops the level and anchors the next one -------------
  const hard = await playSession("hard", 3);
  const afterHard = await levelNow();
  ok("a hard session steps the level down", afterHard?.level === 1, `level ${afterHard?.level} (from cold start 2)`);
  ok("...and sets the anchor for the next session", afterHard?.pending_anchor === true);

  const anchorGenerator = await bestGeneratorForGoal(supabase, child.id, GOAL);
  ok("an anchor generator is identified from history", Boolean(anchorGenerator), anchorGenerator ?? "none");

  const next = await playSession("easy", 5);
  const usedAnchor = next.plan.slots.some(
    (s) => s.kind === "worksheet" && s.recipe.generatorId === anchorGenerator,
  );
  ok("the next session leads with the anchor generator", usedAnchor, anchorGenerator ?? "");
  const nextSheet = next.plan.slots.find((s) => s.kind === "worksheet");
  ok(
    "the next session's worksheet is composed at the LOWERED level",
    nextSheet?.kind === "worksheet" && nextSheet.difficulty === 1,
    nextSheet?.kind === "worksheet" ? `difficulty ${nextSheet.difficulty}` : "no sheet",
  );

  // --- Idempotency: one bad afternoon must not step a child down twice -----
  const beforeReplay = (await levelNow())?.level;
  await runCalibrationForSession(supabase, hard.sessionId, child.id, user.id, 6);
  ok("re-running calibration for a session changes nothing", (await levelNow())?.level === beforeReplay,
    `level stayed ${beforeReplay}`);

  // --- Two strong sessions raise the level, once --------------------------
  // On a goal with NO history: fine_motor already has a strong session (the
  // anchor one), so a single new success there legitimately completes a streak.
  const RISE = "math_thinking" as const;

  await playSession("easy", 5, RISE);
  const afterOne = await levelNow(RISE);
  ok("one strong session is not enough to rise", afterOne?.level === 2, `level ${afterOne?.level} (cold start 2)`);

  await playSession("easy", 5, RISE);
  const afterTwo = await levelNow(RISE);
  ok("two consecutive strong sessions raise the level", afterTwo?.level === 3, `level ${afterTwo?.level}`);
  ok("...and stamp the step-up clock", Boolean(afterTwo?.last_step_up_at));

  // --- The 7-day gate ------------------------------------------------------
  await playSession("easy", 5, RISE);
  const afterThree = await levelNow(RISE);
  ok(
    "a third strong session within 7 days does NOT rise again",
    afterThree?.level === 3,
    `level ${afterThree?.level} — progress is deliberate`,
  );

  // Backdate the step-up past the gate; the next strong pair may rise again.
  await supabase
    .from("calibration")
    .update({ last_step_up_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })
    .eq("child_id", child.id)
    .eq("goal", RISE);
  await playSession("easy", 5, RISE);
  const afterGate = await levelNow(RISE);
  ok("once the gate has passed, a strong pair rises again", afterGate?.level === 4, `level ${afterGate?.level}`);

  // --- A struggle is heard immediately, even mid-streak --------------------
  await playSession("hard", 3, RISE);
  const afterRelapse = await levelNow(RISE);
  ok("a hard session retreats at once, whatever the streak", afterRelapse?.level === 3, `level ${afterRelapse?.level}`);
  ok("...and owes the next session a win", afterRelapse?.pending_anchor === true);

  // --- Boredom: aced but not enjoyed → rotate the material, not the level ---
  // On a goal with 10 generators, so avoiding 3 still leaves a real choice.
  const BORE = "visual_perception" as const;

  // Build some history so there are recent generators to steer away from.
  await playSession("easy", 5, BORE);
  await playSession("easy", 5, BORE);
  await playSession("easy", 5, BORE);
  const levelBeforeBored = (await levelNow(BORE))?.level;

  // High success (easy → 1.0), low enjoyment (1) — the boredom signal.
  await playSession("easy", 1, BORE);
  const afterBored = await levelNow(BORE);
  ok("boredom leaves the level unchanged", afterBored?.level === levelBeforeBored, `level ${afterBored?.level} (was ${levelBeforeBored})`);
  ok("...and marks a rotation pending", afterBored?.rotate_pending === true);

  const avoided = await recentGeneratorsForGoal(supabase, child.id, BORE);
  ok("the recent generators to avoid are identified", avoided.length >= 3, avoided.join(", "));

  // The next session composes against the avoid list, then clears the flag.
  const rotated = await playSession("easy", 5, BORE);
  const rotatedSheet = rotated.plan.slots.find((s) => s.kind === "worksheet");
  const rotatedGen = rotatedSheet?.kind === "worksheet" ? rotatedSheet.recipe.generatorId : "";
  ok("the next session's worksheet avoids the recently-seen generators", !avoided.includes(rotatedGen), `picked ${rotatedGen}, avoided ${avoided.join(",")}`);
  ok("...and the rotation flag is cleared after the session is composed", (await levelNow(BORE))?.rotate_pending === false);

  // 8 ── PLAN GATING (Sprint 6 M1) -----------------------------------------
  // By now this free account has generated well over the weekly limit.
  step("8. plan gating");
  const blocked = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("a free account over its weekly limit is blocked", blocked.allowed === false, `used ${blocked.used}, tier ${blocked.tier}`);
  ok("...with a real unlock time in the future", Boolean(blocked.unlockAt) && blocked.unlockAt!.getTime() > Date.now());

  // The gate reads subscriptions, never a client claim: upgrading lifts it.
  await supabase.from("subscriptions").update({ tier: "premium" }).eq("owner_id", user.id);
  const premium = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("upgrading to premium unlocks generation", premium.allowed && premium.unlimited, `tier ${premium.tier}`);
  await supabase.from("subscriptions").update({ tier: "free" }).eq("owner_id", user.id);
  const backToFree = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("downgrading re-applies the gate", backToFree.allowed === false, `tier ${backToFree.tier}`);

  console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "ALL CHECKS PASSED"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nflow test threw:", e);
  process.exit(1);
});
