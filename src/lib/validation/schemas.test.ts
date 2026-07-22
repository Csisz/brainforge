import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { startSessionSchema } from "@/lib/sessions/schemas";
import { createChildSchema, updateChildSchema } from "@/lib/children/schemas";
import { createPackSchema } from "@/lib/pack/schemas";
import { sessionFeedbackSchema } from "@/lib/feedback/schemas";
import { requestAccountDeletionSchema, deleteAccountSchema } from "@/lib/account/schemas";
import { purchasableTierSchema } from "@/lib/billing/schemas";
import { printWorksheetSchema, printRewardChartSchema } from "@/lib/worksheet-records/schemas";
import type { z } from "zod";

/**
 * B2 regression guards. Every client-callable server action validates its input
 * with one of these schemas at the very top, BEFORE any DB/RPC call — so proving
 * the schema rejects a malformed payload proves the action returns invalid_input
 * and writes nothing. The valid samples mirror exactly what the real UIs send, so
 * a schema that is too strict (rejecting a legitimate call) fails here.
 */
const UUID = "123e4567-e89b-12d3-a456-426614174000";
// today ≈ 2026-07; ~age 5, comfortably inside the 0–10 range and not in the future.
const BIRTH = "2021-03";

const accepts = (schema: z.ZodTypeAny, value: unknown, why = "") =>
  assert.equal(schema.safeParse(value).success, true, `should accept ${why}`);
const rejects = (schema: z.ZodTypeAny, value: unknown, why = "") =>
  assert.equal(schema.safeParse(value).success, false, `should reject ${why}`);

describe("startSession schema", () => {
  const valid = {
    childId: UUID, goals: ["attention"], theme: "space", durationMin: 20,
    materials: ["pencil", "paper"], difficulty: null, idempotencyKey: UUID, locale: "hu",
  };
  test("accepts a real wizard payload (auto difficulty, some materials)", () => {
    accepts(startSessionSchema, valid, "the canonical wizard call");
    accepts(startSessionSchema, { ...valid, difficulty: 3, materials: [] }, "manual difficulty + no materials");
  });
  test("rejects malformed payloads and writes nothing", () => {
    rejects(startSessionSchema, { ...valid, childId: "not-a-uuid" }, "bad childId");
    rejects(startSessionSchema, { ...valid, goals: ["flying"] }, "unknown goal");
    rejects(startSessionSchema, { ...valid, goals: [] }, "empty goals");
    rejects(startSessionSchema, { ...valid, theme: "mars" }, "unknown theme");
    rejects(startSessionSchema, { ...valid, durationMin: 15 }, "off-ladder duration");
    rejects(startSessionSchema, { ...valid, difficulty: 9 }, "out-of-range difficulty");
    rejects(startSessionSchema, { ...valid, idempotencyKey: undefined }, "missing idempotency key");
    rejects(startSessionSchema, { ...valid, locale: "fr" }, "unsupported locale");
  });
});

describe("createChild / updateChild schema", () => {
  const valid = {
    nickname: "Lili", birthMonth: BIRTH, avatar: "cat",
    preferredThemes: ["space"], accessibility: { lowInk: false, highContrast: false, motorSupport: false },
    locale: "en",
  };
  test("accepts a real child-form payload", () => {
    accepts(createChildSchema, valid, "create with locale");
    accepts(updateChildSchema, { ...valid, locale: undefined }, "update ignores locale");
    accepts(createChildSchema, { ...valid, preferredThemes: [] }, "no themes chosen");
  });
  test("rejects malformed payloads and writes nothing", () => {
    rejects(createChildSchema, { ...valid, nickname: "" }, "empty nickname");
    rejects(createChildSchema, { ...valid, nickname: "   " }, "whitespace-only nickname");
    rejects(createChildSchema, { ...valid, nickname: "x".repeat(61) }, "oversized nickname");
    rejects(createChildSchema, { ...valid, birthMonth: "2021-13" }, "impossible month");
    rejects(createChildSchema, { ...valid, birthMonth: "1990-01" }, "age out of range");
    rejects(createChildSchema, { ...valid, avatar: "star" }, "unknown avatar");
    rejects(createChildSchema, { ...valid, preferredThemes: ["mars"] }, "unknown theme");
    rejects(createChildSchema, { ...valid, accessibility: { lowInk: "yes", highContrast: false, motorSupport: false } }, "non-boolean flag");
  });
});

describe("createPack schema", () => {
  const valid = { childId: UUID, days: 5, durationMin: 30, theme: "ocean", packId: UUID, locale: "de" };
  test("accepts a real pack-form payload", () => {
    accepts(createPackSchema, valid, "5-day pack");
    for (const days of [3, 5, 7]) accepts(createPackSchema, { ...valid, days }, `${days}-day ladder`);
  });
  test("rejects malformed payloads and writes nothing", () => {
    rejects(createPackSchema, { ...valid, days: 4 }, "off-ladder day count");
    rejects(createPackSchema, { ...valid, packId: "nope" }, "bad packId");
    rejects(createPackSchema, { ...valid, theme: "mars" }, "unknown theme");
    rejects(createPackSchema, { ...valid, durationMin: 25 }, "off-ladder duration");
  });
});

describe("sessionFeedback schema", () => {
  const valid = [
    { slotIndex: 0, slotKind: "worksheet", completed: true, enjoyment: 5, ease: "easy" },
    { slotIndex: 1, slotKind: "creative", completed: true, enjoyment: null },
  ];
  test("accepts a real session-view payload", () => {
    accepts(sessionFeedbackSchema, valid, "worksheet + activity slots");
    accepts(sessionFeedbackSchema, [{ slotIndex: 0, slotKind: "warmup", completed: false, enjoyment: null, ease: null }], "single slot, null ease");
  });
  test("rejects malformed payloads and writes nothing", () => {
    rejects(sessionFeedbackSchema, [], "empty feedback");
    rejects(sessionFeedbackSchema, [{ ...valid[0], slotKind: "activity" }], "unknown slot kind");
    rejects(sessionFeedbackSchema, [{ ...valid[0], enjoyment: 7 }], "enjoyment out of range");
    rejects(sessionFeedbackSchema, [{ ...valid[0], slotIndex: -1 }], "negative slot index");
    rejects(sessionFeedbackSchema, [{ ...valid[0], ease: "medium" }], "unknown ease value");
  });
});

describe("account deletion schemas", () => {
  test("accepts real calls", () => {
    accepts(requestAccountDeletionSchema, { locale: "hu" });
    accepts(deleteAccountSchema, { confirmation: "parent@example.com", token: "a".repeat(120) });
  });
  test("rejects malformed payloads", () => {
    rejects(requestAccountDeletionSchema, { locale: "fr" }, "unsupported locale");
    rejects(deleteAccountSchema, { confirmation: "", token: "t" }, "empty confirmation");
    rejects(deleteAccountSchema, { confirmation: "a@b.com", token: "a".repeat(2049) }, "oversized token");
  });
});

describe("purchasable tier schema", () => {
  test("accepts the two priceable tiers", () => {
    accepts(purchasableTierSchema, "premium");
    accepts(purchasableTierSchema, "family");
  });
  test("rejects any other tier", () => {
    for (const t of ["free", "school", "therapist", "banana"]) rejects(purchasableTierSchema, t, t);
  });
});

describe("worksheet-records print schemas", () => {
  test("accepts real catalog / reward calls", () => {
    accepts(printWorksheetSchema, { generatorId: "maze", childId: UUID, locale: "hu" }, "registered generator");
    accepts(printRewardChartSchema, { childId: UUID, family: "tree", locale: "en" }, "chosen motif");
    accepts(printRewardChartSchema, { childId: UUID, family: null, locale: "en" }, "surprise motif");
  });
  test("rejects malformed payloads and writes nothing", () => {
    rejects(printWorksheetSchema, { generatorId: "not_a_generator", childId: UUID, locale: "hu" }, "unknown generator id");
    rejects(printWorksheetSchema, { generatorId: "maze", childId: "nope", locale: "hu" }, "bad childId");
    rejects(printRewardChartSchema, { childId: UUID, family: "star", locale: "en" }, "unknown family");
    rejects(printRewardChartSchema, { childId: UUID, family: "tree", locale: "fr" }, "unsupported locale");
  });
});
