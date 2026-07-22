import { z } from "zod";
import type { DevelopmentGoal, ThemeId } from "@/lib/worksheets/types";
import type { MaterialId, SessionSlot } from "@/lib/activities/engine";
import type { AvatarId } from "@/lib/children/avatar-list";
import type { RewardFamily } from "@/lib/worksheets/generators/reward-chart";
import type { Ease } from "@/lib/feedback/ease";
import type { AppLocale } from "@/i18n/routing";
import { THEME_IDS } from "@/lib/worksheets/theme-list";

/**
 * Shared Zod primitives for server-action input validation (Stability B2).
 *
 * TypeScript types vanish at runtime, so a client can call any server action
 * with arbitrary JSON. These schemas re-assert the input SHAPE and VALUE ranges
 * at the top of each action, before anything reaches an RPC or the DB. They add
 * no new business rules — they mirror what the DB/domain already enforces (see
 * each constant's note) and sit IN FRONT of the B1 RPC ownership/quota checks,
 * which stay for genuine business rejections (forbidden_child, quota_exceeded).
 *
 * Enum values are DERIVED from the domain's own closed unions so they cannot
 * drift: `keysOf(... : Record<Union, true>)` fails to compile the moment a union
 * gains or loses a member without this list being updated in lockstep.
 */

/** Object keys as a non-empty tuple, with the object pinned to EXACTLY cover T. */
const keysOf = <T extends string>(rec: Record<T, true>): [T, ...T[]] =>
  Object.keys(rec) as [T, ...T[]];

const GOAL_KEYS = keysOf<DevelopmentGoal>({
  attention: true, working_memory: true, executive_function: true, visual_perception: true,
  bilateral_coordination: true, fine_motor: true, pre_writing: true, pre_reading: true,
  math_thinking: true, creativity: true, problem_solving: true,
});
const MATERIAL_KEYS = keysOf<MaterialId>({
  pencil: true, crayons: true, scissors: true, glue: true, paper: true,
  ball: true, cups: true, blocks: true, tape: true, dice: true,
});
const AVATAR_KEYS = keysOf<AvatarId>({
  cat: true, dog: true, rabbit: true, bird: true, fish: true, turtle: true,
});
// The DB `slot_kind` enum and SessionSlot["kind"] must stay in step; this Record
// forces that at compile time.
const SLOT_KIND_KEYS = keysOf<SessionSlot["kind"]>({
  warmup: true, movement: true, worksheet: true, memory_game: true,
  creative: true, reward: true, reflection: true,
});
const EASE_KEYS = keysOf<Ease>({ easy: true, ok: true, hard: true });
const REWARD_FAMILY_KEYS = keysOf<RewardFamily>({
  tree: true, flower: true, balloon: true, fish: true, caterpillar: true,
});
const LOCALE_KEYS = keysOf<AppLocale>({ hu: true, en: true, de: true });

/** A UUID — every id/idempotency key crossing the action boundary. */
export const zUuid = z.string().uuid();

/** Supported UI locales (i18n routing.locales). */
export const zLocale = z.enum(LOCALE_KEYS);
/** Development goals (closed union in worksheets/types). */
export const zGoal = z.enum(GOAL_KEYS);
/** Theme ids — derived from the canonical runtime list. */
export const zTheme = z.enum(THEME_IDS as unknown as [ThemeId, ...ThemeId[]]);
/** Physical materials a parent can have on hand. */
export const zMaterial = z.enum(MATERIAL_KEYS);
/** Child avatar ids offered by the profile form. */
export const zAvatar = z.enum(AVATAR_KEYS);
/** Session slot kinds — mirrors the DB `slot_kind` enum. */
export const zSlotKind = z.enum(SLOT_KIND_KEYS);
/** How a worksheet went, in the parent's words (drives calibration). */
export const zEase = z.enum(EASE_KEYS);
/** Reward-collection-sheet motif families. */
export const zRewardFamily = z.enum(REWARD_FAMILY_KEYS);

/** 1 (easiest) … 5 (hardest) — DB: `difficulty between 1 and 5`. */
export const zDifficultyLevel = z.number().int().min(1).max(5);
/** Session length — DB: `duration_min in (10,20,30,45)`. */
export const zDurationMin = z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(45)]);
/** Parent enjoyment rating — DB: `enjoyment between 1 and 5`. */
export const zEnjoyment = z.number().int().min(1).max(5);
