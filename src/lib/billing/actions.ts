"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { priceIdForTier, stripeConfigured, type PurchasableTier } from "@/lib/stripe/config";
import { purchasableTierSchema } from "./schemas";

/**
 * Start a Stripe Checkout for a paid tier. The account id is stamped on the
 * session (client_reference_id + metadata) so the webhook knows whose
 * subscription completed — never trusting anything the browser reports back.
 */
export async function createCheckoutSession(tier: PurchasableTier): Promise<{ url?: string; error?: string }> {
  if (!purchasableTierSchema.safeParse(tier).success) return { error: "invalid_input" };
  if (!stripeConfigured()) return { error: "billing_unavailable" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const price = priceIdForTier(tier);
  if (!price) return { error: "unknown_tier" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Reuse an existing customer if we have one, else let Stripe make one from
      // the account email — either way the webhook links it by owner id.
      customer: sub?.provider_customer_id ?? undefined,
      customer_email: sub?.provider_customer_id ? undefined : (user.email ?? undefined),
      client_reference_id: user.id,
      metadata: { owner_id: user.id, tier },
      success_url: `${appUrl}/app/settings?checkout=success`,
      cancel_url: `${appUrl}/app/settings?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    return { url: session.url ?? undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "checkout_failed" };
  }
}

/** Open the Stripe customer portal so a subscriber can manage or cancel. */
export async function createPortalSession(): Promise<{ url?: string; error?: string }> {
  if (!stripeConfigured()) return { error: "billing_unavailable" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!sub?.provider_customer_id) return { error: "no_customer" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: sub.provider_customer_id,
      return_url: `${appUrl}/app/settings`,
    });
    return { url: portal.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "portal_failed" };
  }
}
