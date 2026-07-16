import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createEmailProvider, sendEmail } from "./provider";

const KEY = "RESEND_API_KEY";
afterEach(() => {
  delete process.env[KEY];
});

describe("email is decorative — silent fallback, never load-bearing", () => {
  test("no provider is configured without a key", () => {
    delete process.env[KEY];
    assert.equal(createEmailProvider(), null);
  });

  test("sendEmail returns false (not throw) when unconfigured", async () => {
    delete process.env[KEY];
    const ok = await sendEmail({ to: "a@b.test", subject: "hi", text: "hi" });
    assert.equal(ok, false);
  });

  test("a provider exists once a key is set", () => {
    process.env[KEY] = "re_test_key";
    const provider = createEmailProvider();
    assert.ok(provider);
    assert.equal(provider!.id, "resend");
  });

  test("a provider send failure is swallowed to false", async () => {
    process.env[KEY] = "re_test_key";
    // No network in tests: the fetch will reject, and sendEmail must catch it.
    const ok = await sendEmail({ to: "a@b.test", subject: "hi", text: "hi" });
    assert.equal(ok, false);
  });
});
