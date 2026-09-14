ALTER TABLE "Lead" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "createdByUserId" TEXT;

CREATE INDEX "Lead_createdByUserId_idx" ON "Lead"("createdByUserId");
CREATE INDEX "Customer_createdByUserId_idx" ON "Customer"("createdByUserId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudioLeadShare" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioLeadShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioLeadShare_leadId_userId_key" ON "StudioLeadShare"("leadId", "userId");
CREATE UNIQUE INDEX "StudioLeadShare_customerId_userId_key" ON "StudioLeadShare"("customerId", "userId");
CREATE INDEX "StudioLeadShare_userId_idx" ON "StudioLeadShare"("userId");
CREATE INDEX "StudioLeadShare_leadId_idx" ON "StudioLeadShare"("leadId");
CREATE INDEX "StudioLeadShare_customerId_idx" ON "StudioLeadShare"("customerId");

ALTER TABLE "StudioLeadShare" ADD CONSTRAINT "StudioLeadShare_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioLeadShare" ADD CONSTRAINT "StudioLeadShare_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioLeadShare" ADD CONSTRAINT "StudioLeadShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
