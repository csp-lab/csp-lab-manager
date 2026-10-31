export function createApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
