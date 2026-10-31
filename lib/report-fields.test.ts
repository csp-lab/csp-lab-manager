import assert from "node:assert/strict";
import test from "node:test";
import { blockedDomain, formatReportCount, formatReportTime, resolveReportTime, slugifyAppName } from "./report-fields.ts";

test("slugify collapses spaces", () => {
  assert.equal(slugifyAppName("CSP Lab"), "csp-lab");
});

test("blocked domain keeps host and bare tokens", () => {
  assert.equal(blockedDomain("https://cdn.example/app.js?x=1"), "cdn.example");
  assert.equal(blockedDomain("inline"), "inline");
  assert.equal(blockedDomain("data:text/html,hi"), "data");
  assert.equal(blockedDomain("  "), "unknown");
});

test("report count caps at 99+", () => {
  assert.equal(formatReportCount(12), "12");
  assert.equal(formatReportCount(99), "99");
  assert.equal(formatReportCount(100), "99+");
});

test("report time drops milliseconds", () => {
  assert.equal(formatReportTime("2026-10-31T14:05:06.789Z"), "2026-10-31T14:05:06Z");
});

test("now expressions resolve like Grafana", () => {
  const now = new Date("2026-11-01T01:43:00.000Z");
  assert.equal(resolveReportTime("now", now)?.getTime(), now.getTime());
  assert.equal(resolveReportTime("now-15m", now)?.getTime(), now.getTime() - 15 * 60_000);
  assert.equal(resolveReportTime("now - 1h", now)?.getTime(), now.getTime() - 3_600_000);
  assert.equal(resolveReportTime("now-1h+5m", now)?.getTime(), now.getTime() - 3_600_000 + 5 * 60_000);
  assert.equal(resolveReportTime("2026-11-01T09:00:00.000Z", now)?.toISOString(), "2026-11-01T09:00:00.000Z");
  assert.equal(resolveReportTime("now-15"), null);
  assert.equal(resolveReportTime("yesterday"), null);
});
