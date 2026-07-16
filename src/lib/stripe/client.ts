import Stripe from "stripe";

/**
 * Lazily-constructed Stripe client. Lazy so importing anything in this module
 * tree does not crash a dev environment that has no Stripe keys (billing is
 * simply hidden there). Callers that need it guard on `stripeConfigured()`.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  cached = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return cached;
}
