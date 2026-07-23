/**
 * Legacy account operations (B6). Accounts created in the magic-link era have no
 * password, so they can't use the email + password login. This admin tool gives
 * an operator a documented, per-address path — no addresses are hard-coded here.
 *
 * Run (Node 22+ reads --env-file):
 *   node --env-file=.env.local scripts/legacy-account.mjs status  <email>
 *   node --env-file=.env.local scripts/legacy-account.mjs reset   <email>
 *   node --env-file=.env.local scripts/legacy-account.mjs delete  <email>
 *
 *  status — show whether the account exists, is confirmed, and when it was made.
 *  reset  — print a password-reset link (recovery). The parent opens it and sets
 *           a password; the account then works with email + password. This is the
 *           preferred path — no data is lost.
 *  delete — hard-delete the account so the parent can re-register fresh (their
 *           children/sessions cascade away). Use only if reset isn't wanted.
 *
 * For production, set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to the
 * remote project (a .env.prod.local you do NOT commit), not the local stack.
 */
import { createClient } from "@supabase/supabase-js";

const [action, email] = process.argv.slice(2);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pass --env-file).");
  process.exit(2);
}
if (!["status", "reset", "delete"].includes(action) || !email) {
  console.error("Usage: node --env-file=.env.local scripts/legacy-account.mjs <status|reset|delete> <email>");
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

/** Find a user by email (paginated listing — fine for the handful of legacy accounts). */
async function findUser(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

if (action === "status") {
  const u = await findUser(email);
  if (!u) return console.log(`No account for ${email}.`);
  console.log(`id:         ${u.id}`);
  console.log(`email:      ${u.email}`);
  console.log(`confirmed:  ${Boolean(u.email_confirmed_at)}`);
  console.log(`created:    ${u.created_at}`);
  console.log(`last sign-in: ${u.last_sign_in_at ?? "never"}`);
} else if (action === "reset") {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) return console.error(`Could not generate a reset link: ${error.message}`);
  console.log(`Password-reset link for ${email} (valid ~1h — send it to the parent):\n`);
  console.log(data.properties.action_link);
} else if (action === "delete") {
  const u = await findUser(email);
  if (!u) return console.log(`No account for ${email} — nothing to delete.`);
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) return console.error(`Delete failed: ${error.message}`);
  console.log(`Deleted ${email} (${u.id}). Their data cascaded away; they can re-register.`);
}
