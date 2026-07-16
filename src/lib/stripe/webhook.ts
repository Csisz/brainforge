import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tierForPriceId } from "./config";

/**
 * Apply a Stripe event to the subscriptions table. Idempotent by construction:
 * every write sets the row to the event's target STATE (tier/status/period),
 * never increments, so replaying the same event — or an out-of-order retry —
 * lands on the same result. Takes its Supabase client so the webhook route
 * passes the service-role client while tests pass an owner-scoped one.
 *
 * Returns which owner (if any) was touched, for logging and tests.
 */
export async function applyStripeEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<{ handled: boolean; ownerId?: string }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // We stamp the account id on the session at creation; trust that, not the
      // client, to know whose subscription this is.
      const ownerId = session.client_reference_id ?? session.metadata?.owner_id;
      if (!ownerId) return { handled: false };
      const tier = (session.metadata?.tier as string | undefined) ?? null;
      await supabase
        .from("subscriptions")
        .update({
          tier: tier ?? "premium",
          status: "active",
          provider_customer_id: typeof session.customer === "string" ? session.customer : null,
          updated_at: new Date().toISOString(),
        })
        .eq("owner_id", ownerId);
      return { handled: true, ownerId };
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id;
      const tier = tierForPriceId(priceId);
      const periodEnd = firstItemPeriodEnd(sub);
      const patch: Record<string, unknown> = {
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (tier) patch.tier = tier; // keep the last known tier if the price is unknown
      const { data } = await supabase
        .from("subscriptions")
        .update(patch)
        .eq("provider_customer_id", customerId(sub))
        .select("owner_id")
        .maybeSingle();
      return { handled: true, ownerId: data?.owner_id };
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const { data } = await supabase
        .from("subscriptions")
        .update({ tier: "free", status: "canceled", updated_at: new Date().toISOString() })
        .eq("provider_customer_id", customerId(sub))
        .select("owner_id")
        .maybeSingle();
      return { handled: true, ownerId: data?.owner_id };
    }

    default:
      return { handled: false };
  }
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

/** current_period_end moved onto items in newer API versions; read either shape. */
function firstItemPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  return item?.current_period_end ?? legacy ?? null;
}
