import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { canManageEndpoints } from "@/lib/rbac";
import { DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT, MIN_REPORT_LIMIT } from "@/lib/validations/forms";

export type ReportQuery = {
  from?: string;
  to?: string;
  directive?: string;
  domain?: string;
  disposition?: "enforce" | "report";
  unique?: boolean;
  sort: "newest" | "oldest" | "domain";
  limit?: number;
};

const REPORT_DELETE_BATCH = 1000;

type Db = Prisma.TransactionClient | typeof prisma;

type ReportRow = {
  id: string;
  documentUri: string;
  referrer: string | null;
  violatedDirective: string;
  effectiveDirective: string | null;
  originalPolicy: string | null;
  disposition: string;
  blockedUri: string;
  blockedDomain: string;
  lineNumber: number | null;
  columnNumber: number | null;
  sourceFile: string | null;
  statusCode: number | null;
  scriptSample: string | null;
  rawJson: Prisma.JsonValue;
  createdAt: Date;
};

function reportLimit(value: number | undefined) {
  if (value === undefined || !Number.isInteger(value) || value < MIN_REPORT_LIMIT || value > MAX_REPORT_LIMIT) {
    return DEFAULT_REPORT_LIMIT;
  }
  return value;
}

function endpointWhere(user: SessionUser): Prisma.EndpointWhereInput {
  if (canManageEndpoints(user.role)) return {};
  return { accessList: { some: { userId: user.id } } };
}

async function bumpReportCount(db: Db, endpointId: string, createdAt: Date) {
  await db.$executeRaw`
    UPDATE "endpoints"
    SET "reportCount" = "reportCount" + 1,
        "lastReportAt" = CASE
          WHEN "lastReportAt" IS NULL OR "lastReportAt" < ${createdAt} THEN ${createdAt}
          ELSE "lastReportAt"
        END
    WHERE "id" = ${endpointId}
  `;
}

async function rewindReportCount(db: Db, endpointId: string, removed: number) {
  if (removed <= 0) return;
  await db.$executeRaw`
    UPDATE "endpoints" AS e
    SET "reportCount" = GREATEST(e."reportCount" - ${removed}, 0),
        "lastReportAt" = (
          SELECT MAX(r."createdAt") FROM "reports" AS r WHERE r."endpointId" = e."id"
        )
    WHERE e."id" = ${endpointId}
  `;
}

export async function recordReport(data: Prisma.ReportUncheckedCreateInput) {
  await prisma.$transaction(async (tx) => {
    const created = await tx.report.create({ data, select: { createdAt: true } });
    await bumpReportCount(tx, data.endpointId, created.createdAt);
  });
}

export async function removeReports(endpointId: string, where: Prisma.ReportWhereInput) {
  await prisma.$transaction(async (tx) => {
    const removed = await tx.report.deleteMany({ where });
    await rewindReportCount(tx, endpointId, removed.count);
  });
}

export async function deleteAllReports(endpointId: string) {
  // shortcut: 1000-row batches, raise if a clear holds the endpoint row too long.
  for (;;) {
    const removed = await prisma.$transaction(async (tx) => {
      const count = await tx.$executeRaw`
        DELETE FROM "reports"
        WHERE "id" IN (
          SELECT "id" FROM "reports" WHERE "endpointId" = ${endpointId} LIMIT ${REPORT_DELETE_BATCH}
        )
      `;
      await rewindReportCount(tx, endpointId, count);
      return count;
    });
    if (removed === 0) return;
  }
}

export async function listEndpoints(user: SessionUser) {
  const rows = await prisma.endpoint.findMany({
    where: endpointWhere(user),
    orderBy: { appName: "asc" },
    select: { id: true, appName: true, appNameSlug: true, reportCount: true, lastReportAt: true },
  });
  const hourAgo = Date.now() - 60 * 60 * 1000;
  return rows.map((row) => ({
    id: row.id,
    appName: row.appName,
    appNameSlug: row.appNameSlug,
    reportCount: row.reportCount,
    live: row.lastReportAt !== null && row.lastReportAt.getTime() >= hourAgo,
  }));
}

export async function getEndpoint(user: SessionUser, slug: string) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { appNameSlug: slug, ...endpointWhere(user) },
    select: { id: true, appName: true, appNameSlug: true, apiKey: true },
  });
  if (!endpoint) return null;
  return {
    id: endpoint.id,
    appName: endpoint.appName,
    appNameSlug: endpoint.appNameSlug,
    apiKey: canManageEndpoints(user.role) ? endpoint.apiKey : null,
  };
}

export async function listAssigneeIds(endpointId: string) {
  const rows = await prisma.endpointAccess.findMany({
    where: { endpointId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

async function findUniqueReports(
  filter: {
    endpointId: string;
    directive?: string;
    domain?: string;
    disposition?: string;
    from?: Date;
    to?: Date;
  },
  sort: ReportQuery["sort"],
  limit: number,
) {
  const filters = [Prisma.sql`"endpointId" = ${filter.endpointId}`];
  if (filter.directive) filters.push(Prisma.sql`"violatedDirective" = ${filter.directive}`);
  if (filter.domain) filters.push(Prisma.sql`"blockedDomain" = ${filter.domain}`);
  if (filter.disposition) filters.push(Prisma.sql`"disposition" = ${filter.disposition}`);
  if (filter.from) filters.push(Prisma.sql`"createdAt" >= ${filter.from}`);
  if (filter.to) filters.push(Prisma.sql`"createdAt" <= ${filter.to}`);
  const pick = sort === "oldest" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const outer =
    sort === "domain"
      ? Prisma.sql`"blockedDomain" ASC, "createdAt" DESC`
      : sort === "oldest"
        ? Prisma.sql`"createdAt" ASC`
        : Prisma.sql`"createdAt" DESC`;
  return prisma.$queryRaw<ReportRow[]>`
    SELECT "id", "documentUri", "referrer", "violatedDirective", "effectiveDirective",
           "originalPolicy", "disposition", "blockedUri", "blockedDomain",
           "lineNumber", "columnNumber", "sourceFile", "statusCode", "scriptSample",
           "rawJson", "createdAt"
    FROM (
      SELECT DISTINCT ON ("documentUri", "violatedDirective", "blockedUri", "disposition")
             "id", "documentUri", "referrer", "violatedDirective", "effectiveDirective",
             "originalPolicy", "disposition", "blockedUri", "blockedDomain",
             "lineNumber", "columnNumber", "sourceFile", "statusCode", "scriptSample",
             "rawJson", "createdAt"
      FROM "reports"
      WHERE ${Prisma.join(filters, " AND ")}
      ORDER BY "documentUri", "violatedDirective", "blockedUri", "disposition", "createdAt" ${pick}
    ) AS "picked"
    ORDER BY ${outer}
    LIMIT ${limit}
  `;
}

export async function listReports(user: SessionUser, slug: string, query: ReportQuery) {
  const endpoint = await getEndpoint(user, slug);
  if (!endpoint) return null;
  let from: Date | undefined;
  let to: Date | undefined;
  if (query.from) {
    const parsed = new Date(query.from);
    if (!Number.isNaN(parsed.getTime())) from = parsed;
  }
  if (query.to) {
    const parsed = new Date(query.to);
    if (!Number.isNaN(parsed.getTime())) to = parsed;
  }
  const createdAt: Prisma.DateTimeFilter = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
  const where: Prisma.ReportWhereInput = {
    endpointId: endpoint.id,
    ...(query.directive ? { violatedDirective: query.directive } : {}),
    ...(query.domain ? { blockedDomain: query.domain } : {}),
    ...(query.disposition ? { disposition: query.disposition } : {}),
    ...(from || to ? { createdAt } : {}),
  };
  const orderBy: Prisma.ReportOrderByWithRelationInput[] =
    query.sort === "domain"
      ? [{ blockedDomain: "asc" }, { createdAt: "desc" }]
      : [{ createdAt: query.sort === "oldest" ? "asc" : "desc" }];

  const limit = reportLimit(query.limit);
  // shortcut: facets follow the selected time window and rerun on each refresh. Split them off the poll if a wide window is refreshed every few seconds.
  const facetWhere: Prisma.ReportWhereInput = {
    endpointId: endpoint.id,
    ...(from || to ? { createdAt } : {}),
  };
  const [reports, directives, domains] = await Promise.all([
    query.unique
      ? findUniqueReports(
          {
            endpointId: endpoint.id,
            directive: query.directive,
            domain: query.domain,
            disposition: query.disposition,
            from,
            to,
          },
          query.sort,
          limit,
        )
      : prisma.report.findMany({ where, orderBy, take: limit }),
    prisma.report.findMany({
      where: facetWhere,
      distinct: ["violatedDirective"],
      select: { violatedDirective: true },
      orderBy: { violatedDirective: "asc" },
    }),
    prisma.report.findMany({
      where: facetWhere,
      distinct: ["blockedDomain"],
      select: { blockedDomain: true },
      orderBy: { blockedDomain: "asc" },
    }),
  ]);

  return {
    endpoint,
    reports: reports.map((report) => ({
      id: report.id,
      documentUri: report.documentUri,
      referrer: report.referrer,
      violatedDirective: report.violatedDirective,
      effectiveDirective: report.effectiveDirective,
      originalPolicy: report.originalPolicy,
      disposition: report.disposition,
      blockedUri: report.blockedUri,
      blockedDomain: report.blockedDomain,
      lineNumber: report.lineNumber,
      columnNumber: report.columnNumber,
      sourceFile: report.sourceFile,
      statusCode: report.statusCode,
      scriptSample: report.scriptSample,
      rawJson: report.rawJson,
      createdAt: report.createdAt.toISOString(),
    })),
    directives: directives.map((row) => row.violatedDirective),
    domains: domains.map((row) => row.blockedDomain),
    capped: reports.length >= limit,
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });
  return users.map((user) => ({
    ...user,
    username: user.username ?? "",
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function countSuperadmins() {
  return prisma.user.count({ where: { role: "SUPERADMIN" } });
}
