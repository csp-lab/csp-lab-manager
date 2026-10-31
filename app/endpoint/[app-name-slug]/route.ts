import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitIngestion } from "@/lib/rate-limit";
import { recordReport } from "@/lib/queries";
import { blockedDomain, safeEqual } from "@/lib/report-fields";
import { cspReportPayloadSchema } from "@/lib/validations/csp";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function acceptedContentType(value: string | null) {
  const base = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  return base === "application/csp-report" || base === "application/json";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ "app-name-slug": string }> },
) {
  if (!acceptedContentType(request.headers.get("content-type"))) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  }

  const { "app-name-slug": slug } = await context.params;
  try {
    const limit = await limitIngestion(`${clientIp(request)}:${slug}`);
    if (!limit.success) {
      return new NextResponse(null, { status: 429, headers: { "Retry-After": "10" } });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable" }, { status: 503 });
  }

  const apiKey = new URL(request.url).searchParams.get("apiKey") ?? "";
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpoint = await prisma.endpoint.findUnique({
    where: { appNameSlug: slug },
    select: { id: true, apiKey: true },
  });
  if (!endpoint || !safeEqual(endpoint.apiKey, apiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = cspReportPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  const report = parsed.data["csp-report"];
  const referrer = report.referrer.trim();

  await recordReport({
    endpointId: endpoint.id,
    documentUri: report["document-uri"],
    referrer: referrer || null,
    violatedDirective: report["violated-directive"],
    effectiveDirective: report["effective-directive"],
    originalPolicy: report["original-policy"],
    disposition: report.disposition,
    blockedUri: report["blocked-uri"],
    blockedDomain: blockedDomain(report["blocked-uri"]),
    lineNumber: report["line-number"],
    columnNumber: report["column-number"],
    sourceFile: report["source-file"],
    statusCode: report["status-code"],
    scriptSample: report["script-sample"] || null,
    rawJson: body as Prisma.InputJsonValue,
  });

  return new NextResponse(null, { status: 204 });
}
