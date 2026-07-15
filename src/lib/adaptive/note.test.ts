import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adaptiveNote } from "./note";
import type { CalibrationRow } from "./queries";

const NOW = new Date("2026-07-15T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const row = (o: Partial<CalibrationRow> = {}): CalibrationRow => ({
  goal: "fine_motor",
  level: 3,
  last_step_up_at: null,
  pending_anchor: false,
  ...o,
});

describe("which line a parent sees", () => {
  test("nothing to say when nothing happened", () => {
    assert.equal(adaptiveNote([row()], NOW), null);
    assert.equal(adaptiveNote([], NOW), null);
  });

  test("a pending anchor means we stepped down — say the calm line", () => {
    assert.equal(adaptiveNote([row({ pending_anchor: true })], NOW), "stepDown");
  });

  test("a fresh step up is worth celebrating", () => {
    assert.equal(adaptiveNote([row({ last_step_up_at: hoursAgo(2) })], NOW), "stepUp");
  });

  test("an old step up is not news any more", () => {
    assert.equal(adaptiveNote([row({ last_step_up_at: hoursAgo(30) })], NOW), null);
  });

  test("step down wins over step up on another goal", () => {
    // A parent whose child just had a hard time needs the calming sentence more
    // than a celebration about a different goal; stacking both reads as a
    // scorecard, which is what this must never be.
    const rows = [
      row({ goal: "working_memory", pending_anchor: true }),
      row({ goal: "fine_motor", last_step_up_at: hoursAgo(1) }),
    ];
    assert.equal(adaptiveNote(rows, NOW), "stepDown");
  });

  test("only one line, ever — never a per-goal list", () => {
    const rows = [
      row({ goal: "fine_motor", pending_anchor: true }),
      row({ goal: "attention", pending_anchor: true }),
    ];
    assert.equal(adaptiveNote(rows, NOW), "stepDown");
  });
});
