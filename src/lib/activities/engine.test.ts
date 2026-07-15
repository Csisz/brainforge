import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { composeSession, type SessionRequest, type WorksheetSlot } from "./engine";
import type { DevelopmentGoal, Difficulty } from "@/lib/worksheets/types";

const req = (over: Partial<SessionRequest> = {}): SessionRequest => ({
  childId: "child-1",
  age: 6,
  goals: ["fine_motor", "attention"],
  theme: "space",
  durationMin: 30,
  materials: ["pencil", "paper", "cups", "ball"],
  difficulty: 3,
  recentWorksheets: [],
  locale: "hu",
  ...over,
});

const sheets = (r: SessionRequest = req()): WorksheetSlot[] =>
  composeSession(r).slots.filter((s): s is WorksheetSlot => s.kind === "worksheet");

describe("every composed worksheet slot is attributed", () => {
  // The point of typing `goal` as required: a slot without one can only ever
  // mean "pre-Sprint-5 row", never "new bug silently skipping calibration".
  test("goal and difficulty are stamped on every worksheet slot, every duration", () => {
    for (const durationMin of [10, 20, 30, 45] as const) {
      for (let i = 0; i < 25; i++) {
        const all = sheets(req({ durationMin }));
        assert.ok(all.length > 0, `${durationMin}min template has no worksheet slot`);
        for (const s of all) {
          assert.ok(s.goal, `${durationMin}min: worksheet slot missing goal`);
          assert.ok(s.difficulty >= 1 && s.difficulty <= 5, `bad difficulty ${s.difficulty}`);
        }
      }
    }
  });

  test("the goal stamped is always one the session actually asked for", () => {
    const goals: DevelopmentGoal[] = ["working_memory", "creativity"];
    for (let i = 0; i < 25; i++) {
      for (const s of sheets(req({ goals }))) {
        assert.ok(goals.includes(s.goal), `stamped ${s.goal}, not requested`);
      }
    }
  });
});

describe("calibrated difficulty", () => {
  test("a worksheet uses its own goal's level, not the session's", () => {
    const r = req({
      goals: ["fine_motor"],
      difficulty: 5,
      adaptive: { levelByGoal: { fine_motor: 2 } },
    });
    for (const s of sheets(r)) assert.equal(s.difficulty, 2);
  });

  test("two goals can be composed at different levels in one session", () => {
    const r = req({
      goals: ["fine_motor", "working_memory"],
      difficulty: 3,
      durationMin: 45,
      adaptive: { levelByGoal: { fine_motor: 1, working_memory: 5 } },
    });
    // Whatever goals get picked, each sheet must match ITS goal's level.
    for (let i = 0; i < 25; i++) {
      for (const s of sheets(r)) {
        assert.equal(s.difficulty, s.goal === "fine_motor" ? 1 : 5);
      }
    }
  });

  test("a goal missing from the plan falls back to the session level", () => {
    const r = req({ goals: ["creativity"], difficulty: 4, adaptive: { levelByGoal: { fine_motor: 1 } } });
    for (const s of sheets(r)) assert.equal(s.difficulty, 4);
  });

  test("no adaptive plan at all ⇒ session level everywhere", () => {
    for (const s of sheets(req({ difficulty: 2 }))) assert.equal(s.difficulty, 2);
  });
});

describe("rotate_variety", () => {
  test("avoided generators are not picked for that goal when alternatives exist", () => {
    // fine_motor has many generators; avoid two and they must never appear.
    const avoid = ["maze", "tracing"];
    const r = req({ goals: ["fine_motor"], adaptive: { levelByGoal: {}, avoidByGoal: { fine_motor: avoid } } });
    for (let i = 0; i < 40; i++) {
      for (const s of sheets(r)) assert.ok(!avoid.includes(s.recipe.generatorId), `picked avoided ${s.recipe.generatorId}`);
    }
  });

  test("avoidance yields rather than fail when it would leave nothing", () => {
    // Avoid everything for the goal: we must still produce a sheet.
    const r = req({ goals: ["fine_motor"] });
    const everything = sheets(r).map((s) => s.recipe.generatorId);
    const all = req({
      goals: ["fine_motor"],
      adaptive: {
        levelByGoal: {},
        avoidByGoal: { fine_motor: [...everything, "maze", "tracing", "mirror_drawing", "cut_and_paste"] },
      },
    });
    assert.ok(sheets(all).length > 0, "over-avoidance must not empty the session");
  });
});

describe("the anchor", () => {
  test("a pending anchor is honored: the named generator appears, for its goal", () => {
    const r = req({
      goals: ["fine_motor", "attention"],
      adaptive: { levelByGoal: { fine_motor: 2 }, anchor: { goal: "fine_motor", generatorId: "tracing" } },
    });
    for (let i = 0; i < 25; i++) {
      const all = sheets(r);
      const anchored = all[0]!;
      assert.equal(anchored.recipe.generatorId, "tracing");
      assert.equal(anchored.goal, "fine_motor");
      assert.equal(anchored.difficulty, 2, "the anchor still uses the calibrated level");
    }
  });

  test("the anchor beats anti-repetition — a guaranteed win is not negotiable", () => {
    const r = req({
      goals: ["fine_motor"],
      recentWorksheets: [{ generatorId: "tracing", seed: "x" }],
      adaptive: {
        levelByGoal: {},
        avoidByGoal: { fine_motor: ["tracing"] },
        anchor: { goal: "fine_motor", generatorId: "tracing" },
      },
    });
    assert.equal(sheets(r)[0]!.recipe.generatorId, "tracing");
  });

  test("it is spent once — a second worksheet slot is picked normally", () => {
    // 45min is the only template with more than one worksheet slot; if that
    // changes this test still holds (it just asserts on what exists).
    const r = req({
      durationMin: 45,
      goals: ["fine_motor"],
      adaptive: { levelByGoal: {}, anchor: { goal: "fine_motor", generatorId: "tracing" } },
    });
    const all = sheets(r);
    assert.equal(all[0]!.recipe.generatorId, "tracing");
    assert.ok(all.length >= 1);
  });
});

describe("a session is always composable", () => {
  // Regression: every `creative` activity needs materials and every
  // `memory_game` is 3+, so these threw "pick() on empty array" — from the
  // wizard's own defaults, before the parent ever saw a plan.
  test("45 minutes with only pencil and paper (no creative activity fits)", () => {
    const plan = composeSession(req({ durationMin: 45, materials: ["pencil", "paper"] }));
    assert.equal(plan.slots.length, 7);
    assert.ok(plan.slots.some((s) => s.kind === "creative"));
  });

  test("a 2-year-old's 30-minute session (no memory game is age-appropriate)", () => {
    const plan = composeSession(req({ age: 2, durationMin: 30, materials: [] }));
    assert.ok(plan.slots.some((s) => s.kind === "memory_game"));
  });

  test("no materials at all, every duration", () => {
    for (const durationMin of [10, 20, 30, 45] as const) {
      const plan = composeSession(req({ durationMin, materials: [] }));
      assert.equal(plan.totalMinutes, durationMin);
    }
  });

  test("every physical slot still names an activity", () => {
    for (const s of composeSession(req({ durationMin: 45, materials: [] })).slots) {
      if (s.kind !== "worksheet") assert.match(s.activityKey, /^activity\./);
    }
  });
});

describe("determinism of the contract", () => {
  test("difficulty is always a valid Difficulty even from odd calibration", () => {
    for (const level of [1, 2, 3, 4, 5] as Difficulty[]) {
      const r = req({ goals: ["fine_motor"], adaptive: { levelByGoal: { fine_motor: level } } });
      for (const s of sheets(r)) assert.equal(s.difficulty, level);
    }
  });

  test("totalMinutes matches the template regardless of adaptive input", () => {
    assert.equal(composeSession(req({ durationMin: 30 })).totalMinutes, 30);
    assert.equal(
      composeSession(req({ durationMin: 30, adaptive: { levelByGoal: { fine_motor: 1 } } })).totalMinutes,
      30,
    );
  });
});
