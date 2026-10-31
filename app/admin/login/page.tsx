import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { safeNextPath } from "@/lib/http";
import { readSessionUser } from "@/lib/session";

export const instant = false;

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense fallback={<div className="grid-bg min-h-screen" />}>
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginGate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const user = await readSessionUser(await headers());
  if (user) redirect("/admin/endpoints");
  const params = await searchParams;
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm nextPath={safeNextPath(params.next)} />
    </div>
  );
}
