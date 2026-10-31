import { connection } from "next/server";
import { EndpointList } from "@/components/admin/endpoint-list";
import { listEndpoints } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Page() {
  await connection();
  const user = await requireUser();
  const endpoints = await listEndpoints(user);
  return (
    <>
      <header>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Endpoints</h1>
        <p className="mt-1 text-[15px] text-secondary">Violation reports grouped by application.</p>
      </header>
      <EndpointList endpoints={endpoints} />
    </>
  );
}
