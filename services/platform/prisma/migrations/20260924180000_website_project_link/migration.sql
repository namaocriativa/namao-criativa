ALTER TABLE "Lead"
ADD COLUMN "websiteProjectId" TEXT,
ADD COLUMN "websiteDeployType" TEXT;

ALTER TABLE "Customer"
ADD COLUMN "websiteProjectId" TEXT,
ADD COLUMN "websiteDeployType" TEXT;
