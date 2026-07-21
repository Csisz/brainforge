/**
 * RLS ATTACK-MATRIX — negative security suite (Security A3).
 *
 * The A1 bug (user-writable subscriptions) survived for sprints because the only
 * integration test was a happy path. Security must be proven by NEGATIVE tests:
 * for every sensitive table, no actor may reach data they shouldn't, and RLS must
 * not be so tight it locks a user out of their own rows.
 *
 * Runs against real local Postgres (same style as flow-test.ts), internet-free.
 *   npm run test:rls   (tsx --env-file=.env.local scripts/rls-attack-test.ts)
 *
 * Fixtures: two independent owners userA + userB, each created through the real
 * signup path (so the handle_new_user trigger gives them a profile + free
 * subscription), plus their own child/session/worksheet/feedback/achievement/
 * calibration/ledger rows; an anon client (no auth); a service-role client.
 *
 * Output reads as a matrix: table | actor | operation → expected. Every assertion
 * is a security regression guard — `regressions` must always be 0.
 *
 * History: A3 first shipped this suite RED on four isolated "known gap" assertions
 * (cross-tenant reference writes). A3b closed that gap (with-check reference
 * integrity, migration 0009); those four assertions were flipped to their secure
 * expectation and are now permanent guards proving the gap stays closed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let regressions = 0;
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

/** A confidentiality/self-access/reference-integrity assertion. A failure here is
 *  a real security regression. */
const check = (table: string, actor: string, op: string, expected: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "  ok  " : " FAIL "} ${pad(table, 18)} ${pad(actor, 6)} ${pad(op, 26)} → ${expected}${detail ? "   (" + detail + ")" : ""}`);
  if (!pass) regressions++;
};

/** An insert is "rejected" when it neither errored-out-clean nor created a row. */
const rejected = (res: { error: unknown; data: unknown }) =>
  Boolean(res.error) || (Array.isArray(res.data) ? res.data.length : 0) === 0;

const step = (n: string) => console.log(`\n── ${n}`);
const rowsOf = (res: { data: unknown }) => (Array.isArray(res.data) ? res.data.length : 0);
const rnd = () => randomUUID();

type User = { client: SupabaseClient; id: string; email: string };

async function signUp(admin: SupabaseClient, tag: string): Promise<User> {
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `rls-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const password = "rls-attack-pw-7731";
  const { data: su, error } = await client.auth.signUp({ email, password });
  if (error || !su.user) throw new Error(`signUp ${tag}: ${error?.message}`);
  await admin.auth.admin.updateUserById(su.user.id, { email_confirm: true });
  const { data: si, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2 || !si.user) throw new Error(`signIn ${tag}: ${e2?.message}`);
  return { client, id: si.user.id, email };
}

type Fixtures = {
  child: string;
  session: string;
  worksheet: string;
  feedback: string;
  achievement: string;
  goal: string; // calibration goal (keyed with child)
};

async function seed(u: User): Promise<Fixtures> {
  const c = u.client;
  const child = (await c.from("children").insert({ owner_id: u.id, nickname: "Fixture", birth_month: "2021-01-01", avatar: "cat" }).select("id").single()).data!.id as string;
  const session = (await c.from("sessions").insert({ owner_id: u.id, child_id: child, goals: ["attention"], theme: "nature", duration_min: 20, difficulty: 3, seed: rnd(), plan: { slots: [] } }).select("id").single()).data!.id as string;
  const worksheet = (await c.from("worksheets").insert({ owner_id: u.id, child_id: child, generator_id: "maze", generator_version: 1, seed: rnd() }).select("id").single()).data!.id as string;
  const feedback = (await c.from("feedback").insert({ owner_id: u.id, session_id: session, slot_index: 0, slot_kind: "worksheet", completed: true }).select("id").single()).data!.id as string;
  const achievement = (await c.from("achievements").insert({ owner_id: u.id, child_id: child, kind: "first_session" }).select("id").single()).data!.id as string;
  await c.from("calibration").insert({ owner_id: u.id, child_id: child, goal: "attention", level: 3 });
  // Ledger is written only by the reserve RPC (A2) — use it to give userA a row.
  await c.rpc("reserve_generation", { p_owner: u.id, p_count: 1, p_counts_quota: true });
  return { child, session, worksheet, feedback, achievement, goal: "attention" };
}

async function main() {
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

  step("fixtures — two owners via the real signup path");
  const A = await signUp(admin, "a");
  const B = await signUp(admin, "b");
  const fxA = await seed(A);
  const fxB = await seed(B);
  console.log(`  userA ${A.id.slice(0, 8)} / userB ${B.id.slice(0, 8)} — profiles+subs from handle_new_user, child/session/... seeded`);

  // ── id-keyed, owner-scoped tables (children/sessions/worksheets/feedback/achievements)
  // Each: cross-tenant read/update/delete denied (0 rows), cross-tenant insert
  // as userA rejected (with check), anon fully denied, userA self read + write OK.
  const specs: Array<{ table: string; idA: string; patch: Record<string, unknown>; insertAsA: Record<string, unknown> }> = [
    { table: "children", idA: fxA.child, patch: { nickname: "hax" }, insertAsA: { owner_id: A.id, nickname: "x", birth_month: "2021-01-01" } },
    { table: "sessions", idA: fxA.session, patch: { status: "abandoned" }, insertAsA: { owner_id: A.id, child_id: fxB.child, goals: ["attention"], theme: "nature", duration_min: 20, difficulty: 3, seed: rnd(), plan: { slots: [] } } },
    { table: "worksheets", idA: fxA.worksheet, patch: { params: {} }, insertAsA: { owner_id: A.id, child_id: fxB.child, generator_id: "maze", generator_version: 1, seed: rnd() } },
    { table: "feedback", idA: fxA.feedback, patch: { note: "x" }, insertAsA: { owner_id: A.id, session_id: fxB.session, slot_index: 1, slot_kind: "worksheet", completed: true } },
    { table: "achievements", idA: fxA.achievement, patch: { earned_at: new Date().toISOString() }, insertAsA: { owner_id: A.id, child_id: fxB.child, kind: "hax-" + rnd().slice(0, 8) } },
  ];

  step("cross-tenant confidentiality (userB vs userA) + self-access");
  for (const s of specs) {
    const t = s.table;
    check(t, "userB", "SELECT userA row", "0 rows", rowsOf(await B.client.from(t).select("id").eq("id", s.idA)) === 0);
    check(t, "userB", "UPDATE userA row", "0 rows", rowsOf(await B.client.from(t).update(s.patch).eq("id", s.idA).select("id")) === 0);
    check(t, "userB", "DELETE userA row", "0 rows", rowsOf(await B.client.from(t).delete().eq("id", s.idA).select("id")) === 0);
    const insAsA = await B.client.from(t).insert(s.insertAsA).select("id");
    check(t, "userB", "INSERT owner=userA", "rejected", !!insAsA.error || rowsOf(insAsA) === 0, insAsA.error?.code ?? `rows=${rowsOf(insAsA)}`);
    // self-access — RLS must not lock userA out of their own rows.
    check(t, "userA", "SELECT own", "≥1 row", rowsOf(await A.client.from(t).select("id").eq("id", s.idA)) >= 1);
    check(t, "userA", "UPDATE own", "1 row", rowsOf(await A.client.from(t).update(s.patch).eq("id", s.idA).select("id")) === 1);
  }

  step("calibration (composite key child_id+goal)");
  {
    const q = (c: SupabaseClient) => c.from("calibration").select("level").eq("child_id", fxA.child).eq("goal", fxA.goal);
    check("calibration", "userB", "SELECT userA row", "0 rows", rowsOf(await q(B.client)) === 0);
    check("calibration", "userB", "UPDATE userA row", "0 rows", rowsOf(await B.client.from("calibration").update({ level: 1 }).eq("child_id", fxA.child).eq("goal", fxA.goal).select("level")) === 0);
    const insAsA = await B.client.from("calibration").insert({ owner_id: A.id, child_id: fxB.child, goal: "creativity", level: 2 }).select("level");
    check("calibration", "userB", "INSERT owner=userA", "rejected", !!insAsA.error || rowsOf(insAsA) === 0, insAsA.error?.code ?? `rows=${rowsOf(insAsA)}`);
    check("calibration", "userA", "SELECT own", "≥1 row", rowsOf(await q(A.client)) >= 1);
    check("calibration", "userA", "UPDATE own", "1 row", rowsOf(await A.client.from("calibration").update({ level: 4 }).eq("child_id", fxA.child).eq("goal", fxA.goal).select("level")) === 1);
  }

  step("profiles (id = auth.uid)");
  {
    check("profiles", "userB", "SELECT userA row", "0 rows", rowsOf(await B.client.from("profiles").select("id").eq("id", A.id)) === 0);
    check("profiles", "userB", "UPDATE userA row", "0 rows", rowsOf(await B.client.from("profiles").update({ locale: "xx" }).eq("id", A.id).select("id")) === 0);
    const insAsA = await B.client.from("profiles").insert({ id: A.id, display_name: "hax" }).select("id");
    check("profiles", "userB", "INSERT id=userA", "rejected", !!insAsA.error || rowsOf(insAsA) === 0, insAsA.error?.code ?? `rows=${rowsOf(insAsA)}`);
    check("profiles", "userA", "SELECT own", "≥1 row", rowsOf(await A.client.from("profiles").select("id").eq("id", A.id)) >= 1);
    check("profiles", "userA", "UPDATE own", "1 row", rowsOf(await A.client.from("profiles").update({ locale: "hu" }).eq("id", A.id).select("id")) === 1);
  }

  step("subscriptions — read-only for users (locks in A1)");
  {
    check("subscriptions", "userA", "SELECT own", "≥1 row", rowsOf(await A.client.from("subscriptions").select("tier").eq("owner_id", A.id)) >= 1);
    check("subscriptions", "userA", "UPDATE own tier", "0 rows", rowsOf(await A.client.from("subscriptions").update({ tier: "premium" }).eq("owner_id", A.id).select("tier")) === 0);
    check("subscriptions", "userB", "SELECT userA row", "0 rows", rowsOf(await B.client.from("subscriptions").select("tier").eq("owner_id", A.id)) === 0);
    check("subscriptions", "userB", "UPDATE userA tier", "0 rows", rowsOf(await B.client.from("subscriptions").update({ tier: "premium" }).eq("owner_id", A.id).select("tier")) === 0);
    check("subscriptions", "anon", "SELECT userA row", "0 rows", rowsOf(await anon.from("subscriptions").select("tier").eq("owner_id", A.id)) === 0);
    const svc = await admin.from("subscriptions").update({ tier: "premium" }).eq("owner_id", A.id).select("tier");
    check("subscriptions", "service", "UPDATE tier", "1 row", rowsOf(svc) === 1, `webhook path — tier ${svc.data?.[0]?.tier}`);
    await admin.from("subscriptions").update({ tier: "free" }).eq("owner_id", A.id);
  }

  step("generation_ledger — read-only for users (locks in A2)");
  {
    check("generation_ledger", "userA", "SELECT own", "≥1 row", rowsOf(await A.client.from("generation_ledger").select("id").eq("owner_id", A.id)) >= 1);
    const selfIns = await A.client.from("generation_ledger").insert({ owner_id: A.id }).select("id");
    check("generation_ledger", "userA", "INSERT own", "rejected", !!selfIns.error || rowsOf(selfIns) === 0, selfIns.error?.code ?? `rows=${rowsOf(selfIns)}`);
    check("generation_ledger", "userA", "UPDATE own", "0 rows", rowsOf(await A.client.from("generation_ledger").update({ counts_quota: false }).eq("owner_id", A.id).select("id")) === 0);
    check("generation_ledger", "userB", "SELECT userA row", "0 rows", rowsOf(await B.client.from("generation_ledger").select("id").eq("owner_id", A.id)) === 0);
    check("generation_ledger", "anon", "SELECT userA row", "0 rows", rowsOf(await anon.from("generation_ledger").select("id").eq("owner_id", A.id)) === 0);
  }

  step("anon — fully denied on every sensitive table");
  for (const t of ["profiles", "children", "sessions", "worksheets", "feedback", "achievements", "subscriptions", "calibration", "generation_ledger"]) {
    check(t, "anon", "SELECT (all rows)", "0 rows", rowsOf(await anon.from(t).select("*").limit(50)) === 0);
  }
  // anon writes on a representative table
  {
    const ins = await anon.from("children").insert({ owner_id: A.id, nickname: "x", birth_month: "2021-01-01" }).select("id");
    check("children", "anon", "INSERT", "rejected", !!ins.error || rowsOf(ins) === 0, ins.error?.code ?? `rows=${rowsOf(ins)}`);
    check("children", "anon", "UPDATE userA row", "0 rows", rowsOf(await anon.from("children").update({ nickname: "x" }).eq("id", fxA.child).select("id")) === 0);
    check("children", "anon", "DELETE userA row", "0 rows", rowsOf(await anon.from("children").delete().eq("id", fxA.child).select("id")) === 0);
  }

  // ── tenant reference integrity (A3b — closed) ──
  // Permanent regression guard: userB creates its OWN row (owner_id = userB) that
  // REFERENCES userA's child / session. The with check now requires the referenced
  // row to belong to the caller, so every one of these must be REJECTED. (These
  // were the four RED "known gap" assertions before A3b — kept, flipped to secure.)
  step("tenant reference integrity — cross-tenant reference writes rejected (A3b)");
  {
    const s = await B.client.from("sessions").insert({ owner_id: B.id, child_id: fxA.child, goals: ["attention"], theme: "nature", duration_min: 20, difficulty: 3, seed: "xref-" + rnd(), plan: { slots: [] } }).select("id");
    check("sessions", "userB", "INSERT ref userA.child", "rejected", rejected(s), s.error?.code ?? `created row ${(s.data?.[0]?.id ?? "").slice(0, 8)}`);
    const w = await B.client.from("worksheets").insert({ owner_id: B.id, child_id: fxA.child, generator_id: "maze", generator_version: 1, seed: "xref-" + rnd() }).select("id");
    check("worksheets", "userB", "INSERT ref userA.child", "rejected", rejected(w), w.error?.code ?? `created row ${(w.data?.[0]?.id ?? "").slice(0, 8)}`);
    const f = await B.client.from("feedback").insert({ owner_id: B.id, session_id: fxA.session, slot_index: 9, slot_kind: "worksheet", completed: true }).select("id");
    check("feedback", "userB", "INSERT ref userA.session", "rejected", rejected(f), f.error?.code ?? `created row ${(f.data?.[0]?.id ?? "").slice(0, 8)}`);
    // calibration PK is (child_id, goal) — this also proves the PK-squat is closed.
    const cal = await B.client.from("calibration").insert({ owner_id: B.id, child_id: fxA.child, goal: "problem_solving", level: 2 }).select("child_id");
    check("calibration", "userB", "INSERT ref userA.child", "rejected", rejected(cal), cal.error?.code ?? "created row (PK squat!)");
  }

  // ── teardown — deleting the auth users cascades every owned row ──
  step("teardown");
  await admin.auth.admin.deleteUser(A.id);
  await admin.auth.admin.deleteUser(B.id);
  console.log("  test owners deleted (cascade removed all fixtures + gap rows)");

  console.log(`\n── SUMMARY`);
  console.log(`  confidentiality / self-access / reference integrity:  ${regressions === 0 ? "ALL SECURE" : regressions + " REGRESSION(S) — investigate immediately"}`);
  console.log(`\n${regressions === 0 ? "ALL CHECKS PASSED" : "SUITE RED"} — regressions=${regressions}`);
  process.exit(regressions > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nrls-attack test threw:", e);
  process.exit(1);
});
