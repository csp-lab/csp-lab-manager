-- AlterTable
ALTER TABLE "endpoints" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "endpoints" ADD COLUMN "lastReportAt" TIMESTAMP(3);

-- Backfill counters from existing reports
UPDATE "endpoints" AS e
SET "reportCount" = counts.n,
    "lastReportAt" = counts.latest
FROM (
  SELECT "endpointId", COUNT(*)::integer AS n, MAX("createdAt") AS latest
  FROM "reports"
  GROUP BY "endpointId"
) AS counts
WHERE e."id" = counts."endpointId";

-- DropIndex
DROP INDEX "endpoints_appNameSlug_idx";

-- DropIndex
DROP INDEX "endpoints_apiKey_idx";

-- CreateIndex
CREATE INDEX "endpoint_access_endpointId_idx" ON "endpoint_access"("endpointId");

-- CreateIndex
CREATE INDEX "reports_endpointId_violatedDirective_createdAt_idx" ON "reports"("endpointId", "violatedDirective", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_endpointId_blockedDomain_createdAt_idx" ON "reports"("endpointId", "blockedDomain", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_endpointId_disposition_createdAt_idx" ON "reports"("endpointId", "disposition", "createdAt" DESC);

-- DropIndex
DROP INDEX "reports_endpointId_violatedDirective_idx";

-- DropIndex
DROP INDEX "reports_endpointId_blockedDomain_idx";

-- DropIndex
DROP INDEX "reports_endpointId_disposition_idx";
