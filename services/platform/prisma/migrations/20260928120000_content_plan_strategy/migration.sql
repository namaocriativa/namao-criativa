-- AlterTable
ALTER TABLE "ContentPlan" ADD COLUMN "strategy" JSONB;
ALTER TABLE "ContentPlan" ADD COLUMN "brief" JSONB;
ALTER TABLE "ContentPlan" ADD COLUMN "referencePlanId" TEXT;
