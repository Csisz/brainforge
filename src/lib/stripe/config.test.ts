import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stripeConfigured } from "./config";

/**
 * The upgrade CTAs (settings plan, worksheet-limit card, add-child prompt) all
 * branch on this one check to choose beta-notice mode vs checkout mode (Sprint 7
 * M8). Pinning it here pins the behavior of every CTA that reuses it — and guards
 * the rule that the check is never duplicated.
 */
describe("stripeConfigured drives upgrade CTA mode (M8)", () => {
  const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PREMIUM", "STRIPE_PRICE_FAMILY"] as const;
  const snapshot = () => Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const restore = (snap: Record<string, string | undefined>) => {
    for (const k of KEYS) {
      if (snap[k] === undefined) delete process.env[k];
      else process.env[k] = snap[k];
    }
  };

  test("absent Stripe env ⇒ notice mode (false)", () => {
    const snap = snapshot();
    for (const k of KEYS) delete process.env[k];
    assert.equal(stripeConfigured(), false);
    restore(snap);
  });

  test("full Stripe env ⇒ checkout mode (true)", () => {
    const snap = snapshot();
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_PREMIUM = "price_p";
    process.env.STRIPE_PRICE_FAMILY = "price_f";
    assert.equal(stripeConfigured(), true);
    restore(snap);
  });

  test("half-configured Stripe ⇒ notice mode (false), never a partial checkout", () => {
    const snap = snapshot();
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    delete process.env.STRIPE_PRICE_PREMIUM;
    process.env.STRIPE_PRICE_FAMILY = "price_f";
    assert.equal(stripeConfigured(), false);
    restore(snap);
  });
});
