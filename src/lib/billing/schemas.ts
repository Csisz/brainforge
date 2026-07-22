import { z } from "zod";
import type { PurchasableTier } from "@/lib/stripe/config";

/** Runtime validation for createCheckoutSession (Stability B2). The tier must be
 *  one Stripe can actually price — an unknown tier is invalid_input, never a
 *  checkout for a made-up plan. `satisfies` pins the list to PurchasableTier. */
const TIERS = ["premium", "family"] as const satisfies readonly PurchasableTier[];

export const purchasableTierSchema = z.enum(TIERS);
