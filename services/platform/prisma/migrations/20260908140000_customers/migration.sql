-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "instagram" TEXT,
    "facebook" TEXT,
    "linkedin" TEXT,
    "services" JSONB,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "metadata" JSONB,
    "generateConfig" JSONB,
    "landingSlug" TEXT,
    "landingStatus" TEXT NOT NULL DEFAULT 'none',
    "landingBuiltAt" TIMESTAMP(3),
    "activeLandingJobId" TEXT,
    "publicSiteId" TEXT,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedOrigin" TEXT,
    "vercelProjectId" TEXT,
    "vercelDeploymentId" TEXT,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_landingSlug_key" ON "Customer"("landingSlug");
CREATE UNIQUE INDEX "Customer_publicSiteId_key" ON "Customer"("publicSiteId");

-- Alter children: optional leadId + customerId
ALTER TABLE "LeadActivity" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "LeadActivity" ADD COLUMN "customerId" TEXT;
CREATE INDEX "LeadActivity_customerId_createdAt_idx" ON "LeadActivity"("customerId", "createdAt");

ALTER TABLE "ChatSession" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "ChatSession" ADD COLUMN "customerId" TEXT;
CREATE INDEX "ChatSession_customerId_idx" ON "ChatSession"("customerId");

ALTER TABLE "ChatEvent" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "ChatEvent" ADD COLUMN "customerId" TEXT;
CREATE INDEX "ChatEvent_customerId_idx" ON "ChatEvent"("customerId");

ALTER TABLE "LandingJob" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "LandingJob" ADD COLUMN "customerId" TEXT;
CREATE INDEX "LandingJob_customerId_idx" ON "LandingJob"("customerId");

ALTER TABLE "LandingGeneration" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "LandingGeneration" ADD COLUMN "customerId" TEXT;
CREATE INDEX "LandingGeneration_customerId_idx" ON "LandingGeneration"("customerId");

ALTER TABLE "User" ADD COLUMN "customerId" TEXT;
CREATE INDEX "User_customerId_idx" ON "User"("customerId");

ALTER TABLE "Invite" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "Invite" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Invite_customerId_idx" ON "Invite"("customerId");

ALTER TABLE "InstagramConnection" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "InstagramConnection" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "InstagramConnection_customerId_key" ON "InstagramConnection"("customerId");

ALTER TABLE "LeadSource" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "LeadSource" ADD COLUMN "customerId" TEXT;
CREATE INDEX "LeadSource_customerId_idx" ON "LeadSource"("customerId");

ALTER TABLE "LeadImage" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "LeadImage" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "LeadImage_customerId_sourceUrl_key" ON "LeadImage"("customerId", "sourceUrl");
CREATE INDEX "LeadImage_customerId_idx" ON "LeadImage"("customerId");

-- Customer FKs
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingJob" ADD CONSTRAINT "LandingJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandingGeneration" ADD CONSTRAINT "LandingGeneration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadImage" ADD CONSTRAINT "LeadImage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one owner on required-child tables
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "LandingJob" ADD CONSTRAINT "LandingJob_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "LandingGeneration" ADD CONSTRAINT "LandingGeneration_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
ALTER TABLE "LeadImage" ADD CONSTRAINT "LeadImage_owner_xor" CHECK (("leadId" IS NOT NULL AND "customerId" IS NULL) OR ("leadId" IS NULL AND "customerId" IS NOT NULL));
