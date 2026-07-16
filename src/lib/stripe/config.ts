import type { PlanTier } from "@/lib/entitlements/limits";

/**
 * Stripe wiring config, entirely from env so prices are never hardcoded and
 * staging/prod differ by configuration alone. The two paid, self-serve tiers
 * map to a price id each; school/therapist are sales-led and have no price here.
 */
export type PurchasableTier = "premium" | "family";

export function priceIdForTier(tier: PurchasableTier): string | undefined {
  return tier === "premium" ? process.env.STRIPE_PRICE_PREMIUM : process.env.STRIPE_PRICE_FAMILY;
}

/** Reverse map: which tier a Stripe price grants. Unknown price ⇒ null. */
export function tierForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  if (priceId === process.env.STRIPE_PRICE_FAMILY) return "family";
  return null;
}

/** True when the Stripe keys are configured — gates the billing UI in dev. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PREMIUM && process.env.STRIPE_PRICE_FAMILY);
}
