import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isValidBirthMonth } from "./age";

const NOW = new Date("2026-07-16T12:00:00Z");

describe("isValidBirthMonth", () => {
  test("rejects empty or malformed input", () => {
    assert.equal(isValidBirthMonth("", NOW), false);
    assert.equal(isValidBirthMonth("2026", NOW), false);
    assert.equal(isValidBirthMonth("2026-7", NOW), false, "month must be zero-padded");
    assert.equal(isValidBirthMonth("2026-13", NOW), false);
    assert.equal(isValidBirthMonth("2026-00", NOW), false);
    assert.equal(isValidBirthMonth("2026-07-01", NOW), false, "expects YYYY-MM, not a full date");
  });

  test("accepts the current month (age 0, born this month)", () => {
    assert.equal(isValidBirthMonth("2026-07", NOW), true);
  });

  test("rejects a future month", () => {
    assert.equal(isValidBirthMonth("2026-08", NOW), false);
    assert.equal(isValidBirthMonth("2027-01", NOW), false);
  });

  test("accepts a child who is still 10 (birthday later this year)", () => {
    // born Oct 2015 → turns 11 in Oct 2026, so 10 as of Jul 2026
    assert.equal(isValidBirthMonth("2015-10", NOW), true);
  });

  test("rejects a child who has already turned 11", () => {
    // born Jul 2015 → turned 11 in Jul 2026
    assert.equal(isValidBirthMonth("2015-07", NOW), false);
    assert.equal(isValidBirthMonth("2014-01", NOW), false);
  });

  test("accepts a mid-range age", () => {
    assert.equal(isValidBirthMonth("2020-03", NOW), true);
  });
});
