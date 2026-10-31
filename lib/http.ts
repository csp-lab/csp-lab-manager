import { headers } from "next/headers";

export async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/admin") || value.startsWith("//") || value.startsWith("/admin/login")) {
    return "/admin/endpoints";
  }
  return value;
}
