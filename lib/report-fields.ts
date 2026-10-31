import { createHash, timingSafeEqual } from "node:crypto";

const BARE_TOKENS = new Set([
  "inline",
  "eval",
  "self",
  "none",
  "wasm-eval",
  "about",
]);

export function slugifyAppName(appName: string) {
  return appName.trim().toLowerCase().replace(/\s+/g, "-");
}

export function blockedDomain(blockedUri: string) {
  const value = blockedUri.trim();
  if (!value) return "unknown";
  const token = value.toLowerCase();
  if (BARE_TOKENS.has(token)) return token;
  if (token.startsWith("data:")) return "data";
  if (token.startsWith("blob:")) return "blob";
  try {
    const hostname = new URL(value).hostname;
    return hostname || value.slice(0, 253);
  } catch {
    return value.slice(0, 253);
  }
}

export function formatReportCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

export function toDatetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultReportRange() {
  return { from: "now-15m", to: "now" };
}

const FIXED_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

function shiftReportTime(date: Date, sign: number, amount: number, unit: string) {
  if (unit === "M" || unit === "y") {
    const next = new Date(date);
    if (unit === "M") next.setMonth(next.getMonth() + sign * amount);
    else next.setFullYear(next.getFullYear() + sign * amount);
    return next;
  }
  return new Date(date.getTime() + sign * amount * FIXED_UNIT_MS[unit]);
}

// shortcut: no Grafana calendar rounding (`now/d`); add it when a preset needs a snapped boundary.
export function resolveReportTime(value: string, now = new Date()): Date | null {
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith("now")) {
    if (!/^now(?:\s*[+-]\s*\d+\s*[smhdwMy])*$/.test(text)) return null;
    let date = new Date(now);
    for (const match of text.slice(3).matchAll(/\s*([+-])\s*(\d+)\s*([smhdwMy])/g)) {
      date = shiftReportTime(date, match[1] === "+" ? 1 : -1, Number(match[2]), match[3]);
      if (Number.isNaN(date.getTime())) return null;
    }
    return date;
  }
  const absolute = new Date(text);
  return Number.isNaN(absolute.getTime()) ? null : absolute;
}

export function reportBoundIso(value: string, now = new Date()) {
  const date = resolveReportTime(value, now);
  return date ? date.toISOString() : undefined;
}

export function formatReportTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 19)}Z`;
}

export function safeEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}
