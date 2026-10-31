import assert from "node:assert/strict";
import test from "node:test";
import { consumeMemoryWindow } from "./rate-limit.ts";

test("memory window blocks the 101st hit", () => {
  const key = `test-${Date.now()}`;
  for (let i = 0; i < 100; i += 1) {
    assert.equal(consumeMemoryWindow(key, 1_000, 100, 10_000).success, true);
  }
  assert.equal(consumeMemoryWindow(key, 1_000, 100, 10_000).success, false);
  assert.equal(consumeMemoryWindow(key, 12_000, 100, 10_000).success, true);
});
