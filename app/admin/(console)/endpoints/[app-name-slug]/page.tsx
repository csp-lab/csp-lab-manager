import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { EndpointControls, EndpointMembers } from "@/components/admin/endpoint-controls";
import { ReportExplorer } from "@/components/admin/report-explorer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requestOrigin } from "@/lib/http";
import { defaultReportRange, reportBoundIso } from "@/lib/report-fields";
import { listAssigneeIds, listReports, listUsers } from "@/lib/queries";
import { canManageEndpoints } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { DEFAULT_REPORT_LIMIT } from "@/lib/validations/forms";

export const instant = false;

export default function Page({ params }: { params: Promise<{ "app-name-slug": string }> }) {
  return (
    <Suspense fallback={<p className="text-[15px] text-secondary">Loading reports…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ "app-name-slug": string }> }) {
  await connection();
  const user = await requireUser();
  const { "app-name-slug": slug } = await params;
  const range = defaultReportRange();
  const now = new Date();
  const data = await listReports(user, slug, {
    sort: "newest",
    from: reportBoundIso(range.from, now),
    to: reportBoundIso(range.to, now),
    limit: DEFAULT_REPORT_LIMIT,
  });
  if (!data) notFound();
  const manage = canManageEndpoints(user.role);
  const users = manage ? await listUsers() : [];
  const assignedUserIds = manage ? await listAssigneeIds(data.endpoint.id) : [];
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/endpoints">Endpoints</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{data.endpoint.appName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{data.endpoint.appName}</h1>
          <p className="mt-1 font-mono text-[13px] text-muted">{data.endpoint.appNameSlug}</p>
        </div>
        {manage ? (
          <EndpointMembers slug={slug} users={users} assignedUserIds={assignedUserIds} />
        ) : null}
      </header>
      {manage ? (
        <EndpointControls slug={slug} apiKey={data.endpoint.apiKey} origin={await requestOrigin()} />
      ) : null}
      <ReportExplorer
        slug={slug}
        canDelete={manage}
        initialFrom={range.from}
        initialTo={range.to}
        initial={{
          reports: data.reports,
          directives: data.directives,
          domains: data.domains,
          capped: data.capped,
        }}
      />
    </>
  );
}
