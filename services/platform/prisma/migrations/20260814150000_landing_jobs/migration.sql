-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "landingSlug" TEXT;
ALTER TABLE "Lead" ADD COLUMN "landingStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Lead" ADD COLUMN "landingBuiltAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "activeLandingJobId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_landingSlug_key" ON "Lead"("landingSlug");

-- CreateTable
CREATE TABLE "LandingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "log" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandingJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LandingJob_leadId_idx" ON "LandingJob"("leadId");

-- CreateIndex
CREATE INDEX "LandingJob_status_idx" ON "LandingJob"("status");
