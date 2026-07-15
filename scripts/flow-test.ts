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
import { composeWorksheet, defaultRenderOptions } from "../src/lib/worksheets/page";
import { evaluateAchievements, ACHIEVEMENT_KINDS } from "../src/lib/achievements";
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

  console.log(`\n${failures ? `${failures} CHECK(S) FAILED` : "ALL CHECKS PASSED"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nflow test threw:", e);
  process.exit(1);
});
