-- CreateTable
CREATE TABLE "ContentCalendarReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "leadId" TEXT,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_scheduledAt_idx" ON "ContentCalendarReminder"("scheduledAt");

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_status_idx" ON "ContentCalendarReminder"("status");

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_leadId_idx" ON "ContentCalendarReminder"("leadId");

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_customerId_idx" ON "ContentCalendarReminder"("customerId");

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_createdByUserId_idx" ON "ContentCalendarReminder"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContentCalendarReminder_tenantId_idx" ON "ContentCalendarReminder"("tenantId");

-- AddForeignKey
ALTER TABLE "ContentCalendarReminder" ADD CONSTRAINT "ContentCalendarReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarReminder" ADD CONSTRAINT "ContentCalendarReminder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarReminder" ADD CONSTRAINT "ContentCalendarReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarReminder" ADD CONSTRAINT "ContentCalendarReminder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
