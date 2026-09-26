-- CreateTable
CREATE TABLE "InstagramSkillJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "log" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "model" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "days" INTEGER NOT NULL DEFAULT 30,
    "report" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramSkillJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramSkillJob_leadId_idx" ON "InstagramSkillJob"("leadId");

-- CreateIndex
CREATE INDEX "InstagramSkillJob_customerId_idx" ON "InstagramSkillJob"("customerId");

-- CreateIndex
CREATE INDEX "InstagramSkillJob_status_idx" ON "InstagramSkillJob"("status");

-- CreateIndex
CREATE INDEX "InstagramSkillJob_tenantId_idx" ON "InstagramSkillJob"("tenantId");

-- AddForeignKey
ALTER TABLE "InstagramSkillJob" ADD CONSTRAINT "InstagramSkillJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramSkillJob" ADD CONSTRAINT "InstagramSkillJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramSkillJob" ADD CONSTRAINT "InstagramSkillJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
