"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validations/forms";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid login");
      return;
    }
    setPending(true);
    setError("");
    const result = await authClient.signIn.username({
      username: parsed.data.username,
      password: parsed.data.password,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Invalid username or password");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-md border border-line bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <Link href="/admin" className="wordmark">
        <span className="wordmark-mark" />
        CSP Lab Manager
      </Link>
      <h1 className="mt-6 text-[28px] leading-tight font-bold tracking-tight">Sign in</h1>
      <label className="mt-5 block text-[13px] text-muted">
        Username
        <input name="username" autoComplete="username" required className="mt-1 h-9 w-full rounded border border-line bg-white px-3 text-[15px] outline-none focus:border-terminal" />
      </label>
      <label className="mt-4 block text-[13px] text-muted">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="mt-1 h-9 w-full rounded border border-line bg-white px-3 text-[15px] outline-none focus:border-terminal" />
      </label>
      {error ? <p className="mt-3 text-[13px] text-brand">{error}</p> : null}
      <button type="submit" disabled={pending} className="mt-5 rounded bg-terminal px-4 py-2 font-mono text-[13px] text-white disabled:opacity-50">
        Sign in
      </button>
    </form>
  );
}
