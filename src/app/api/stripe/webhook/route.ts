import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { applyStripeEvent } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook. The signature is verified against STRIPE_WEBHOOK_SECRET before
 * anything is read — an unsigned or tampered body is rejected with 400 and never
 * reaches the DB. Uses the service-role client because a webhook has no user
 * session, and the row update is idempotent, so Stripe's retries are safe.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const body = await req.text(); // raw body required for signature verification
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_signature", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 },
    );
  }

  try {
    await applyStripeEvent(createAdminClient(), event);
  } catch (err) {
    // Return 500 so Stripe retries; the handler is idempotent, so a retry is safe.
    return NextResponse.json(
      { error: "handler_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
