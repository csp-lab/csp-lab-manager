import { connection } from "next/server";
import { redirect } from "next/navigation";
import { EndpointForm } from "@/components/admin/endpoint-form";
import { createApiKey } from "@/lib/api-key";
import { canManageEndpoints } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Page() {
  await connection();
  const user = await requireUser();
  if (!canManageEndpoints(user.role)) redirect("/admin/endpoints");
  return (
    <>
      <header>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Create endpoint</h1>
        <p className="mt-1 text-[15px] text-secondary">Slug comes from the app name. API key must be at least 16 characters.</p>
      </header>
      <EndpointForm apiKey={createApiKey()} />
    </>
  );
}
