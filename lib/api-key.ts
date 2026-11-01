// 32 lowercase hex chars, the same shape as `openssl rand -hex 16`.
export function createApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
