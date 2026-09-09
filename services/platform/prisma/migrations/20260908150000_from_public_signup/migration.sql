-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "fromPublicSignup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "fromPublicSignup" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_fromPublicSignup_idx" ON "Lead"("fromPublicSignup");

-- CreateIndex
CREATE INDEX "Customer_fromPublicSignup_idx" ON "Customer"("fromPublicSignup");
