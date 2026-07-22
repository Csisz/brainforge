import { z } from "zod";
import { zLocale } from "@/lib/validation/common";

/**
 * Runtime validation for the account-deletion actions (Stability B2). These only
 * guard SHAPE — the real gates stay in the action: the signed token is verified
 * cryptographically and the confirmation is matched against the account email.
 * The length caps keep an oversized payload from ever reaching that logic.
 */
export const requestAccountDeletionSchema = z.object({ locale: zLocale });

export const deleteAccountSchema = z.object({
  confirmation: z.string().min(1).max(320), // an email address at most
  token: z.string().min(1).max(2048),
});
