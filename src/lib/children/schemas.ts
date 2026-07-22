import { z } from "zod";
import { zUuid, zLocale, zTheme, zAvatar } from "@/lib/validation/common";
import { isValidBirthMonth } from "@/lib/children/age";

/**
 * Runtime validation for the child-profile actions (Stability B2).
 *
 * `nickname`: the DB column is unbounded `text`, so this is a product-level guard
 * against oversized input (the form has no max attribute) — it also rejects an
 * empty or whitespace-only name the way the form's `required` does client-side.
 * `birthMonth`: reuses the domain's own isValidBirthMonth (real month, not in the
 * future, child within the 0–10 age range) so the rule can't drift from the form.
 */
const zNickname = z
  .string()
  .min(1)
  .max(60)
  .refine((s) => s.trim().length > 0, "nickname_empty");

const zBirthMonth = z.string().refine((s) => isValidBirthMonth(s), "birth_month_out_of_range");

const zAccessibility = z.object({
  lowInk: z.boolean(),
  highContrast: z.boolean(),
  motorSupport: z.boolean(),
});

const zPreferredThemes = z.array(zTheme).max(12);

export const createChildSchema = z.object({
  nickname: zNickname,
  birthMonth: zBirthMonth,
  avatar: zAvatar,
  preferredThemes: zPreferredThemes,
  accessibility: zAccessibility,
  locale: zLocale,
});

export const updateChildSchema = z.object({
  nickname: zNickname,
  birthMonth: zBirthMonth,
  avatar: zAvatar,
  preferredThemes: zPreferredThemes,
  accessibility: zAccessibility,
});
