-- DropTable
DROP TABLE IF EXISTS "LandingGeneration";

-- DropTable
DROP TABLE IF EXISTS "LandingJob";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "generateConfig";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "landingBuiltAt";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "activeLandingJobId";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "generateConfig";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "landingBuiltAt";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "activeLandingJobId";

-- CreateTable
CREATE TABLE "SiteSkillJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "log" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "model" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "repo" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSkillJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteSkillJob_leadId_idx" ON "SiteSkillJob"("leadId");

-- CreateIndex
CREATE INDEX "SiteSkillJob_customerId_idx" ON "SiteSkillJob"("customerId");

-- CreateIndex
CREATE INDEX "SiteSkillJob_status_idx" ON "SiteSkillJob"("status");

-- CreateIndex
CREATE INDEX "SiteSkillJob_tenantId_idx" ON "SiteSkillJob"("tenantId");

-- AddForeignKey
ALTER TABLE "SiteSkillJob" ADD CONSTRAINT "SiteSkillJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSkillJob" ADD CONSTRAINT "SiteSkillJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSkillJob" ADD CONSTRAINT "SiteSkillJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
