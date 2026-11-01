import assert from "node:assert/strict";
import test from "node:test";
import { createApiKey } from "./api-key.ts";

test("createApiKey matches openssl rand -hex 16", () => {
  const key = createApiKey();
  assert.match(key, /^[0-9a-f]{32}$/);
  assert.notEqual(key, createApiKey());
});
