/**
 * M5 acceptance flow test (headless).
 * Drives the real chain against local Supabase:
 *   signup (email + password, email confirmed via the admin API) → child →
 *   session containing a dual_path worksheet → print render → feedback →
 *   achievement row.
 *
 * Run: npx tsx scripts/flow-test.ts
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { composeSession, type SessionSlot } from "../src/lib/activities/engine";
import type { DevelopmentGoal } from "../src/lib/worksheets/types";
import { composeWorksheet, defaultRenderOptions } from "../src/lib/worksheets/page";
import { evaluateAchievements, ACHIEVEMENT_KINDS } from "../src/lib/achievements";
import { runCalibrationForSession, bestGeneratorForGoal, recentGeneratorsForGoal } from "../src/lib/adaptive/queries";
import { coldStartLevel } from "../src/lib/adaptive/engine";
import { EASE_SUCCESS } from "../src/lib/feedback/ease";
import { getGenerationAllowance } from "../src/lib/entitlements/queries";
import { applyStripeEvent } from "../src/lib/stripe/webhook";
import { freshSeed } from "../src/lib/random";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

  // 1 ── SIGNUP with email + password (Sprint 9 M0) ----------------------
  // Confirm email is ON, so signUp creates no session. The headless test stands
  // in for the emailed confirmation link by confirming the address via the admin
  // API, then signs in with the password — the real product's post-confirm path.
  step(`1. signup — ${email}`);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    ok("SUPABASE_SERVICE_ROLE_KEY available for confirming the signup", false, "set it in .env.local");
    return;
  }
  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const password = "flow-test-pw-9182";
  const { data: signUpData, error: suErr } = await supabase.auth.signUp({ email, password });
  ok("signUp creates a user", !suErr && Boolean(signUpData?.user), suErr?.message);
  ok("...with no session until the email is confirmed", signUpData?.session === null);
  const userId = signUpData?.user?.id;
  if (!userId) return;

  // Stand in for clicking the confirmation link: confirm the address.
  const { error: confErr } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  ok("the confirmation link marks the email confirmed", !confErr, confErr?.message);

  const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  ok("email + password signs in → session", !siErr && Boolean(signIn?.user), siErr?.message);
  if (siErr || !signIn?.user) return;
  const user = signIn.user;

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

  // 8 ── GENERATION QUOTA — atomic reserve across all paths (Security A2) ----
  // reserve_generation is the ONE gate every worksheet-creating path uses
  // (startSession, pack, catalog print, reward print). We exercise it directly
  // here — the actions delegate to it, so proving the RPC proves the gate. The
  // calibration phase above inserted worksheets directly (deliberately bypassing
  // the gate to drive levels), which do NOT touch the ledger, so this account
  // starts with a clean quota.
  step("8. generation quota (atomic reserve, A2)");

  type Reserve = { allowed: boolean; reason: string | null; remaining: number; unlimited: boolean };
  const reserve = async (count = 1, countsQuota = true): Promise<Reserve> =>
    (await admin.rpc("reserve_generation", { p_owner: user.id, p_count: count, p_counts_quota: countsQuota }))
      .data as Reserve;
  const clearLedger = () => admin.from("generation_ledger").delete().eq("owner_id", user.id);

  await clearLedger();
  const r1 = await reserve(), r2 = await reserve(), r3 = await reserve();
  ok("free tier: the first 3 reserves succeed (weekly cap)", r1.allowed && r2.allowed && r3.allowed, `remaining ${r1.remaining}/${r2.remaining}/${r3.remaining}`);

  // NEGATIVE GUARD (the whole point of A2): at the cap the shared reserve DENIES.
  // This is exactly what printWorksheetForChild returns as an error and what
  // startSession soft-gates on — the catalog/reward quota bypass is closed.
  const r4 = await reserve();
  ok("at the cap, a further reserve is DENIED — catalog/session bypass closed", r4.allowed === false && r4.reason === "quota_exceeded", `allowed=${r4.allowed}, reason=${r4.reason}`);

  const blocked = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("the usage display agrees the account is over its weekly limit", blocked.allowed === false && blocked.used >= 3, `used ${blocked.used}`);
  ok("...with a real unlock time in the future", Boolean(blocked.unlockAt) && blocked.unlockAt!.getTime() > Date.now());

  // Reward charts are intentionally quota-EXEMPT (motivation tool): still allowed
  // at the cap (rate limit would still apply).
  const reward = await reserve(1, false);
  ok("reward-chart printing stays free at the cap (quota-exempt)", reward.allowed === true, `allowed=${reward.allowed}, reason=${reward.reason}`);

  // CONCURRENCY: two near-simultaneous reserves at cap-1 must not BOTH pass —
  // the atomic in-DB check-and-reserve makes exactly one win (no TOCTOU race).
  await clearLedger();
  await reserve(); await reserve(); // used 2 of 3 ⇒ one unit left
  const [c1, c2] = await Promise.all([reserve(), reserve()]);
  const passed = [c1, c2].filter((r) => r.allowed).length;
  ok("two concurrent reserves at cap-1 — exactly one succeeds (atomic)", passed === 1, `passed=${passed}, reasons=${c1.reason}/${c2.reason}`);

  // A1 (unchanged): a USER-client tier write is still denied by RLS.
  const bypass = await supabase.from("subscriptions").update({ tier: "premium" }).eq("owner_id", user.id).select("tier");
  const afterBypass = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("a USER-client tier write is denied by RLS — the paid-tier bypass is closed", afterBypass.tier === "free", `rowsWritten=${bypass.data?.length ?? 0}, tier=${afterBypass.tier}`);

  // Premium: unlimited across every path (a 10-unit reserve — well over the free
  // cap — passes), via the legitimate service-role tier write.
  await admin.from("subscriptions").update({ tier: "premium" }).eq("owner_id", user.id);
  await clearLedger();
  const pBig = await reserve(10);
  ok("premium: reserve is unlimited across all paths", pBig.allowed && pBig.unlimited, `allowed=${pBig.allowed}, unlimited=${pBig.unlimited}`);
  const premium = await getGenerationAllowance(user.id, new Date(), supabase);
  ok("...and the display shows unlimited", premium.allowed && premium.unlimited, `tier ${premium.tier}`);
  await admin.from("subscriptions").update({ tier: "free" }).eq("owner_id", user.id);
  await clearLedger();

  // 9 ── STRIPE WEBHOOK (Sprint 6 M2) — mocked, signed with the test secret ---
  step("9. stripe webhook");
  const stripe = new Stripe("sk_test_flowtest_dummy", { apiVersion: "2026-06-24.dahlia" });
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_flowtest";

  /** Sign a payload the way Stripe does, then verify it — exactly the route's path. */
  const signedEvent = (payload: object) => {
    const body = JSON.stringify(payload);
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
    return stripe.webhooks.constructEvent(body, header, WEBHOOK_SECRET);
  };

  // A tampered signature must be rejected before anything is read.
  let rejected = false;
  try {
    stripe.webhooks.constructEvent(JSON.stringify({ id: "evt" }), "t=1,v1=deadbeef", WEBHOOK_SECRET);
  } catch {
    rejected = true;
  }
  ok("a bad signature is rejected", rejected);

  const checkout = signedEvent({
    id: "evt_flow_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_flow",
        object: "checkout.session",
        client_reference_id: user.id,
        customer: "cus_flowtest",
        metadata: { owner_id: user.id, tier: "premium" },
      },
    },
  });
  ok("a valid signature verifies to an event", checkout.type === "checkout.session.completed");

  // applyStripeEvent runs with the service-role client — exactly like the real
  // webhook route (subscriptions are no longer client-writable, Security A1).
  const applied = await applyStripeEvent(admin, checkout);
  const readSub = async () =>
    (await supabase.from("subscriptions").select("tier, status, provider_customer_id").eq("owner_id", user.id).single()).data;
  const afterCheckout = await readSub();
  ok("checkout.session.completed activates the tier from the session", applied.handled && afterCheckout?.tier === "premium", `tier ${afterCheckout?.tier}`);
  ok("...and links the Stripe customer", afterCheckout?.provider_customer_id === "cus_flowtest");

  // Idempotency: replaying the same event lands on the same state, not a dupe.
  await applyStripeEvent(admin, checkout);
  const afterReplay = await readSub();
  ok("replaying the same event is idempotent", afterReplay?.tier === "premium" && afterReplay?.status === afterCheckout?.status);

  const canceled = signedEvent({
    id: "evt_flow_cancel",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_flow", object: "subscription", customer: "cus_flowtest", status: "canceled", items: { data: [] } } },
  });
  await applyStripeEvent(admin, canceled);
  const afterCancel = await readSub();
  ok("subscription.deleted drops the account back to free", afterCancel?.tier === "free" && afterCancel?.status === "canceled", `tier ${afterCancel?.tier}, status ${afterCancel?.status}`);

  // 10 ── ATOMIC LIFECYCLE — create_session / create_pack / finalize_feedback (B1)
  // The lifecycles are now single security-definer RPCs: all writes in one
  // transaction, composing reserve_generation, re-enforcing A3b ownership, and
  // idempotent on a per-submit key. We call them exactly as the actions do — via
  // the signed-in USER client, so auth.uid() = the owner and the caller checks run.
  step("10. atomic lifecycle RPCs (B1)");

  const ledgerCount = async () =>
    (await admin.from("generation_ledger").select("*", { count: "exact", head: true }).eq("owner_id", user.id)).count ?? 0;
  const sessionsWithKey = async (key: string) =>
    (await admin.from("sessions").select("id").eq("owner_id", user.id).eq("idempotency_key", key)).data ?? [];
  const goodWorksheet = () => [{ generatorId: "dual_path", generatorVersion: 1, params: {}, seed: freshSeed(), goal: "attention" }];
  const createSession = (worksheets: unknown[], key: string, over: Record<string, unknown> = {}) =>
    supabase.rpc("create_session", {
      p_owner: user.id, p_child: child.id, p_goals: ["attention"], p_theme: "space",
      p_duration: 20, p_materials: ["pencil", "paper"], p_difficulty: 3, p_seed: freshSeed(),
      p_plan: { slots: [] }, p_worksheets: worksheets, p_idempotency_key: key, ...over,
    });

  // --- Fault injection: a mid-transaction failure rolls back everything --------
  // A non-numeric generatorVersion makes the worksheet insert (which runs AFTER
  // the session insert, in the same transaction) throw. Nothing must survive: no
  // orphan session, and crucially no consumed quota.
  await clearLedger();
  const badKey = randomUUID();
  const { data: faultData, error: faultErr } = await createSession(
    [{ generatorId: "dual_path", generatorVersion: "boom", params: {}, seed: freshSeed(), goal: "attention" }],
    badKey,
  );
  ok("fault injection: a bad worksheet aborts the whole RPC", Boolean(faultErr) && !faultData, faultErr?.message);
  ok("...leaving no orphan session (transaction rolled back)", (await sessionsWithKey(badKey)).length === 0);
  ok("...and consuming no quota (reserve rolled back too)", (await ledgerCount()) === 0);

  // --- Double-submit: the same idempotency key yields ONE session -------------
  // Two concurrent creates with one key — the advisory lock + idempotency lookup
  // make the second a no-op returning the first's id. Quota is spent exactly once.
  await clearLedger();
  const dupKey = randomUUID();
  const dupWorksheets = goodWorksheet();
  const [d1, d2] = await Promise.all([createSession(dupWorksheets, dupKey), createSession(dupWorksheets, dupKey)]);
  const id1 = (d1.data as { session_id?: string })?.session_id;
  const id2 = (d2.data as { session_id?: string })?.session_id;
  ok("double-submit: both concurrent calls return a session id", Boolean(id1 && id2), `${d1.error?.message ?? ""}${d2.error?.message ?? ""}`);
  ok("...the SAME session id (server-side idempotency)", Boolean(id1) && id1 === id2, `${id1} / ${id2}`);
  ok("...only one session row exists for the key", (await sessionsWithKey(dupKey)).length === 1);
  ok("...and quota is consumed exactly once", (await ledgerCount()) === 1);

  // --- Ownership re-enforced inside the RPC (A3b, security definer bypasses RLS)
  const notMine = await createSession(goodWorksheet(), randomUUID(), { p_child: randomUUID() });
  ok("ownership: a child not owned by the caller is rejected", (notMine.data as { error?: string })?.error === "forbidden_child", JSON.stringify(notMine.data));
  const notCaller = await createSession(goodWorksheet(), randomUUID(), { p_owner: randomUUID() });
  ok("ownership: p_owner ≠ the signed-in caller is rejected", (notCaller.data as { error?: string })?.error === "forbidden", JSON.stringify(notCaller.data));

  // --- finalize_feedback: idempotent upsert + ownership ----------------------
  const fbEntries = [
    { slotIndex: 0, slotKind: "worksheet", completed: true, enjoyment: 5, successRate: 1.0 },
    { slotIndex: 1, slotKind: "creative", completed: true, enjoyment: 4, successRate: null },
  ];
  const ff1 = await supabase.rpc("finalize_feedback", { p_owner: user.id, p_session: id1, p_entries: fbEntries });
  await supabase.rpc("finalize_feedback", { p_owner: user.id, p_session: id1, p_entries: fbEntries }); // replay
  ok("finalize_feedback returns the session's child id", (ff1.data as { child_id?: string })?.child_id === child.id, JSON.stringify(ff1.data ?? ff1.error));
  const fbRows = (await admin.from("feedback").select("slot_index").eq("session_id", id1!)).data ?? [];
  ok("a double finalize does not duplicate feedback (upsert on slot key)", fbRows.length === fbEntries.length, `${fbRows.length} rows`);
  const finalized = (await admin.from("sessions").select("status").eq("id", id1!).single()).data;
  ok("...and the session is marked completed", finalized?.status === "completed", finalized?.status);
  const ffForbidden = await supabase.rpc("finalize_feedback", { p_owner: user.id, p_session: randomUUID(), p_entries: fbEntries });
  ok("ownership: finalizing a session not owned is rejected", (ffForbidden.data as { error?: string })?.error === "forbidden_session", JSON.stringify(ffForbidden.data));

  // --- create_pack: whole pack atomic + idempotent on the pack id ------------
  await clearLedger();
  const packKey = randomUUID();
  const packSessions = [
    { seed: freshSeed(), plan: { slots: [] }, worksheets: goodWorksheet() },
    { seed: freshSeed(), plan: { slots: [] }, worksheets: goodWorksheet() },
  ];
  const createPack = () =>
    supabase.rpc("create_pack", {
      p_owner: user.id, p_child: child.id, p_pack_id: packKey, p_theme: "space",
      p_duration: 20, p_materials: ["pencil"], p_goals: ["attention"], p_difficulty: 3, p_sessions: packSessions,
    });
  const [pk1, pk2] = await Promise.all([createPack(), createPack()]);
  ok("pack double-submit: both concurrent calls return the pack id", (pk1.data as { pack_id?: string })?.pack_id === packKey && (pk2.data as { pack_id?: string })?.pack_id === packKey, `${pk1.error?.message ?? ""}${pk2.error?.message ?? ""}`);
  const packRows = (await admin.from("sessions").select("id").eq("pack_id", packKey)).data ?? [];
  ok("...only one pack's worth of sessions is created (no duplicate pack)", packRows.length === packSessions.length, `${packRows.length} sessions`);
  ok("...and quota is consumed once for the pack's worksheets", (await ledgerCount()) === packSessions.length);
  await clearLedger();

  // 11 ── DELETION LINK SAFETY (Sprint 7 M7c) ------------------------------
  // Deletion is now email-confirmed: the link lands on a confirmation PAGE, and
  // only the explicit typed-confirm action there deletes. A bare GET on the link
  // must never delete — assert it while the account still exists.
  step("11. deletion link safety");
  {
    const { signDeletionToken } = await import("../src/lib/account/deletion-token");
    const delToken = signDeletionToken(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${appUrl}/hu/account/delete?token=${encodeURIComponent(delToken)}`;
    let status = 0;
    let reached = false;
    try {
      const res = await fetch(link, { redirect: "manual" });
      status = res.status;
      reached = true;
    } catch {
      /* the app (npm run dev) is not running */
    }
    if (!reached) {
      console.log(`  --  skipped: confirmation page unreachable at ${appUrl} (run \`npm run dev\`)`);
    } else {
      const stillThere = Boolean((await admin.auth.admin.getUserById(user.id)).data.user);
      ok("a bare GET on the deletion link never deletes the account", stillThere, `status=${status}`);
      ok("...the link routes to a confirmation page, not a delete", status < 500);
    }
  }

  // 12 ── ACCOUNT DELETION (Sprint 6 M4) — GDPR erasure, cascade ------------
  // Exactly what deleteAccount() does after the confirmation page: the auth admin
  // deletes user.id and the DB cascades everything owned by the account.
  step("12. account deletion");
  {
    const childrenBefore = (await admin.from("children").select("id").eq("owner_id", user.id)).data ?? [];
    ok("the account has data to erase before deletion", childrenBefore.length > 0, `${childrenBefore.length} children`);

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    ok("the auth user is hard-deleted", !delErr, delErr?.message);

    // The cascade must have removed everything owned by the account.
    const remaining = await Promise.all(
      ["children", "sessions", "worksheets", "feedback", "calibration", "subscriptions"].map(async (table) => {
        const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("owner_id", user.id);
        return [table, count ?? 0] as const;
      }),
    );
    const leftover = remaining.filter(([, n]) => n > 0);
    ok("deletion cascades through every owned table", leftover.length === 0, leftover.map(([t, n]) => `${t}:${n}`).join(", ") || "all clear");
    const { data: goneProfile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
    ok("the profile row is gone too", !goneProfile);
  }

  console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "ALL CHECKS PASSED"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nflow test threw:", e);
  process.exit(1);
});
