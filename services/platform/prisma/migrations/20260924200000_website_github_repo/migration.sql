ALTER TABLE "Lead"
ADD COLUMN "websiteRepo" TEXT,
ADD COLUMN "websiteFramework" TEXT;

ALTER TABLE "Customer"
ADD COLUMN "websiteRepo" TEXT,
ADD COLUMN "websiteFramework" TEXT;
