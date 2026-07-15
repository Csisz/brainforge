import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calibrate,
  coldStartLevel,
  STEP_UP_COOLDOWN_DAYS,
  type Calibration,
  type GoalOutcome,
} from "./engine";
import type { Age, Difficulty } from "@/lib/worksheets/types";

const NOW = new Date("2026-07-15T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const outcome = (o: Partial<GoalOutcome> = {}): GoalOutcome => ({
  sessionId: "s",
  successRate: 1,
  enjoyment: 5,
  completed: true,
  ...o,
});
const cal = (c: Partial<Calibration> = {}): Calibration => ({
  level: 3,
  lastStepUpAt: null,
  pendingAnchor: false,
  ...c,
});
const run = (current: Calibration | null, recent: GoalOutcome[], age: Age = 6) =>
  calibrate({ now: NOW, age, current, recent });

const thriving = outcome({ successRate: 0.9, enjoyment: 5 });
const struggling = outcome({ successRate: 0.3, enjoyment: 3 });

describe("cold start — a first impression must be winnable", () => {
  test("is one below the age default", () => {
    // defaultDifficulty: <=3 → 1, <=5 → 2, <=7 → 3, <=9 → 4, else 5
    assert.equal(coldStartLevel(6), 2);
    assert.equal(coldStartLevel(8), 3);
    assert.equal(coldStartLevel(10), 4);
  });

  test("clamps at 1 for the youngest — never 0", () => {
    assert.equal(coldStartLevel(2), 1);
    assert.equal(coldStartLevel(3), 1); // default 1, minus one, clamped
  });

  test("with no row and no history, holds the cold-start level", () => {
    const d = run(null, [], 6);
    assert.equal(d.level, 2);
    assert.equal(d.change, "none");
    assert.equal(d.pendingAnchor, false);
  });

  test("a cold-start child who struggles drops from the cold-start level", () => {
    const d = run(null, [struggling], 6);
    assert.equal(d.level, 1); // 2 - 1
    assert.equal(d.change, "step_down");
  });
});

describe("step down — immediate, no restriction", () => {
  test("low success rate drops the level and anchors the next session", () => {
    const d = run(cal({ level: 4 }), [struggling]);
    assert.equal(d.level, 3);
    assert.equal(d.change, "step_down");
    assert.equal(d.pendingAnchor, true);
  });

  test("not completed drops the level even with no success rate recorded", () => {
    const d = run(cal({ level: 4 }), [outcome({ completed: false, successRate: null })]);
    assert.equal(d.level, 3);
    assert.equal(d.change, "step_down");
  });

  test("completed but below the struggle line still drops", () => {
    const d = run(cal({ level: 3 }), [outcome({ completed: true, successRate: 0.49 })]);
    assert.equal(d.change, "step_down");
  });

  test("at level 1 it holds at 1 but still anchors — the child still had a hard time", () => {
    const d = run(cal({ level: 1 }), [struggling]);
    assert.equal(d.level, 1);
    assert.equal(d.change, "step_down");
    assert.equal(d.pendingAnchor, true);
  });

  test("a recent step up does NOT block a step down — retreat is always allowed", () => {
    const d = run(cal({ level: 4, lastStepUpAt: daysAgo(1) }), [struggling]);
    assert.equal(d.level, 3);
    assert.equal(d.change, "step_down");
  });

  test("struggle beats an otherwise-qualifying step-up streak", () => {
    // Newest is a struggle; the two before it were great.
    const d = run(cal({ level: 3 }), [struggling, thriving, thriving]);
    assert.equal(d.change, "step_down");
  });
});

describe("step up — deliberate", () => {
  test("two consecutive strong sessions raise the level and stamp the clock", () => {
    const d = run(cal({ level: 2 }), [thriving, thriving]);
    assert.equal(d.level, 3);
    assert.equal(d.change, "step_up");
    assert.deepEqual(d.lastStepUpAt, NOW);
  });

  test("one strong session is not enough", () => {
    const d = run(cal({ level: 2 }), [thriving]);
    assert.equal(d.level, 2);
    assert.equal(d.change, "none");
  });

  test("strong but not enjoyed (enjoyment 3) does not step up", () => {
    const ok = outcome({ successRate: 0.9, enjoyment: 3 });
    const d = run(cal({ level: 2 }), [ok, ok]);
    assert.equal(d.change, "none");
  });

  test("enjoyed but not strong enough (0.79) does not step up", () => {
    const near = outcome({ successRate: 0.79, enjoyment: 5 });
    const d = run(cal({ level: 2 }), [near, near]);
    assert.equal(d.change, "none");
  });

  test("0.8 exactly is success — the boundary is inclusive", () => {
    const edge = outcome({ successRate: 0.8, enjoyment: 4 });
    const d = run(cal({ level: 2 }), [edge, edge]);
    assert.equal(d.change, "step_up");
  });

  test("the streak must be consecutive — a weak session between breaks it", () => {
    const meh = outcome({ successRate: 0.6, enjoyment: 5 });
    const d = run(cal({ level: 2 }), [thriving, meh, thriving]);
    assert.equal(d.change, "none");
  });

  test("at level 5 it holds — no step past the top", () => {
    const d = run(cal({ level: 5 }), [thriving, thriving]);
    assert.equal(d.level, 5);
    assert.equal(d.change, "none");
  });
});

describe("the 7-day gate", () => {
  test("a step up 3 days ago blocks another", () => {
    const d = run(cal({ level: 2, lastStepUpAt: daysAgo(3) }), [thriving, thriving]);
    assert.equal(d.level, 2);
    assert.equal(d.change, "none");
  });

  test("exactly 7 days is still too soon — the gate is 'older than'", () => {
    const d = run(cal({ level: 2, lastStepUpAt: daysAgo(STEP_UP_COOLDOWN_DAYS) }), [thriving, thriving]);
    assert.equal(d.change, "none");
  });

  test("8 days lets it through", () => {
    const d = run(cal({ level: 2, lastStepUpAt: daysAgo(8) }), [thriving, thriving]);
    assert.equal(d.level, 3);
    assert.equal(d.change, "step_up");
  });

  test("never stepped up before — no gate to clear", () => {
    const d = run(cal({ level: 2, lastStepUpAt: null }), [thriving, thriving]);
    assert.equal(d.change, "step_up");
  });
});

describe("boredom — nailed it, no fun", () => {
  test("high success + low enjoyment rotates variety and holds the level", () => {
    const d = run(cal({ level: 3 }), [outcome({ successRate: 0.95, enjoyment: 1 })]);
    assert.equal(d.level, 3, "bored is not the same as ready");
    assert.equal(d.change, "none");
    assert.equal(d.rotateVariety, true);
  });

  test("enjoyment 2 is bored; 3 is neither bored nor thriving", () => {
    assert.equal(run(cal(), [outcome({ successRate: 0.9, enjoyment: 2 })]).rotateVariety, true);
    const middling = run(cal(), [outcome({ successRate: 0.9, enjoyment: 3 })]);
    assert.equal(middling.rotateVariety, false);
    assert.equal(middling.change, "none");
  });

  test("a bored session never raises the level, even twice in a row", () => {
    const b = outcome({ successRate: 0.95, enjoyment: 1 });
    const d = run(cal({ level: 2 }), [b, b]);
    assert.equal(d.level, 2);
    assert.equal(d.change, "none");
    assert.equal(d.rotateVariety, true);
  });

  test("a step up wins over boredom when the streak qualifies", () => {
    // Newest thrived (enjoyment 5) so it is not bored; the flag stays off.
    const d = run(cal({ level: 2 }), [thriving, thriving]);
    assert.equal(d.change, "step_up");
    assert.equal(d.rotateVariety, false);
  });
});

describe("the anchor flag", () => {
  test("a step down raises it", () => {
    assert.equal(run(cal({ level: 3 }), [struggling]).pendingAnchor, true);
  });

  test("it survives an unrelated hold — only using it clears it", () => {
    const d = run(cal({ level: 3, pendingAnchor: true }), [outcome({ successRate: 0.6, enjoyment: 3 })]);
    assert.equal(d.pendingAnchor, true);
    assert.equal(d.change, "none");
  });

  test("it is not raised by a good session", () => {
    assert.equal(run(cal({ level: 2 }), [thriving, thriving]).pendingAnchor, false);
  });
});

describe("purity", () => {
  test("same inputs, same answer, and the input is not mutated", () => {
    const current = cal({ level: 3 });
    const recent = [struggling];
    const a = calibrate({ now: NOW, age: 6, current, recent });
    const b = calibrate({ now: NOW, age: 6, current, recent });
    assert.deepEqual(a, b);
    assert.equal(current.level, 3, "input calibration must not be mutated");
    assert.equal(current.pendingAnchor, false);
  });

  test("every level it can return is a valid Difficulty (1..5)", () => {
    for (let level = 1 as Difficulty; level <= 5; level = (level + 1) as Difficulty) {
      for (const recent of [[struggling], [thriving, thriving], []]) {
        const d = run(cal({ level }), recent);
        assert.ok(d.level >= 1 && d.level <= 5, `level ${d.level} out of range`);
      }
    }
  });
});
