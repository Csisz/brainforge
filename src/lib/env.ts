import { z } from "zod";

/**
 * Environment validation, run once at server boot (see instrumentation.ts).
 * Fail fast with a readable message rather than crash deep in a request when a
 * required variable is missing or malformed in production.
 *
 * Optional integrations (Stripe, Resend, Google login) are validated as
 * all-or-nothing GROUPS: half-configured Stripe is a deployment mistake we would
 * rather catch at boot than discover when a checkout silently fails.
 */
const schema = z
  .object({
    // Required everywhere.
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),

    // Optional: Stripe (all-or-nothing).
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PREMIUM: z.string().optional(),
    STRIPE_PRICE_FAMILY: z.string().optional(),

    // Optional: email.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Optional: Google login.
    NEXT_PUBLIC_AUTH_GOOGLE: z.enum(["0", "1"]).optional(),
  })
  .superRefine((env, ctx) => {
    const stripeKeys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PREMIUM", "STRIPE_PRICE_FAMILY"] as const;
    const setCount = stripeKeys.filter((k) => env[k]).length;
    if (setCount > 0 && setCount < stripeKeys.length) {
      for (const k of stripeKeys) {
        if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: "required when any STRIPE_* is set (Stripe is all-or-nothing)" });
      }
    }

    // Resend transactional email is all-or-nothing too (B6): a half-configured
    // sender is a deployment mistake we'd rather fail at boot than discover when a
    // signup confirmation silently doesn't send. Both absent ⇒ fall back to
    // Supabase's built-in sender, which is fine for local dev.
    const resendKeys = ["RESEND_API_KEY", "EMAIL_FROM"] as const;
    const resendSet = resendKeys.filter((k) => env[k]).length;
    if (resendSet > 0 && resendSet < resendKeys.length) {
      for (const k of resendKeys) {
        if (!env[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: "required when RESEND_API_KEY or EMAIL_FROM is set (Resend is all-or-nothing)" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

/**
 * Validate process.env. Throws with a grouped, readable message on failure.
 * Idempotent and cheap; safe to call more than once.
 */
export function validateEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(
      `\n✖ Invalid environment configuration:\n${issues}\n\nSee .env.example for the full list and shape.\n`,
    );
  }
  return parsed.data;
}
