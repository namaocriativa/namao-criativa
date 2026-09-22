CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('namao_default_tenant', 'Namão', 'namao', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ClientAccount" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InviteRequest" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Package" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OfferTemplate" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ImageProject" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "VideoProject" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CreativeCharacter" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CreativeMovie" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CreativeStartEndClip" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CreativeUgcClip" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ContentCalendarPost" ADD COLUMN "tenantId" TEXT;

UPDATE "User" SET "tenantId" = 'namao_default_tenant' WHERE "role" IN ('ADMIN', 'OPERATOR');
UPDATE "Lead" SET "tenantId" = 'namao_default_tenant';
UPDATE "Customer" SET "tenantId" = 'namao_default_tenant';
UPDATE "ClientAccount" SET "tenantId" = 'namao_default_tenant';
UPDATE "Invite" SET "tenantId" = 'namao_default_tenant';
UPDATE "InviteRequest" SET "tenantId" = 'namao_default_tenant';
UPDATE "Package" SET "tenantId" = 'namao_default_tenant';
UPDATE "OfferTemplate" SET "tenantId" = 'namao_default_tenant';
UPDATE "ImageProject" SET "tenantId" = 'namao_default_tenant';
UPDATE "VideoProject" SET "tenantId" = 'namao_default_tenant';
UPDATE "CreativeCharacter" SET "tenantId" = 'namao_default_tenant';
UPDATE "CreativeMovie" SET "tenantId" = 'namao_default_tenant';
UPDATE "CreativeStartEndClip" SET "tenantId" = 'namao_default_tenant';
UPDATE "CreativeUgcClip" SET "tenantId" = 'namao_default_tenant';
UPDATE "ContentCalendarPost" SET "tenantId" = 'namao_default_tenant';

ALTER TABLE "Lead" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ClientAccount" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Invite" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "InviteRequest" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Package" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ImageProject" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "VideoProject" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CreativeCharacter" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CreativeMovie" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CreativeStartEndClip" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CreativeUgcClip" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ContentCalendarPost" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "AppSetting" ADD COLUMN "id" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "tenantId" TEXT;
UPDATE "AppSetting" SET "id" = 'aset_' || "key", "tenantId" = 'namao_default_tenant';
ALTER TABLE "AppSetting" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "AppSetting" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AppSetting" DROP CONSTRAINT "AppSetting_pkey";
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "AppSetting_tenantId_key_key" ON "AppSetting"("tenantId", "key");

ALTER TABLE "OfferTemplate" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX "OfferTemplate_tenantId_key" ON "OfferTemplate"("tenantId");

CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX "ClientAccount_tenantId_idx" ON "ClientAccount"("tenantId");
CREATE INDEX "Invite_tenantId_idx" ON "Invite"("tenantId");
CREATE INDEX "InviteRequest_tenantId_idx" ON "InviteRequest"("tenantId");
CREATE INDEX "Package_tenantId_idx" ON "Package"("tenantId");
CREATE INDEX "AppSetting_tenantId_idx" ON "AppSetting"("tenantId");
CREATE INDEX "ImageProject_tenantId_idx" ON "ImageProject"("tenantId");
CREATE INDEX "VideoProject_tenantId_idx" ON "VideoProject"("tenantId");
CREATE INDEX "CreativeCharacter_tenantId_idx" ON "CreativeCharacter"("tenantId");
CREATE INDEX "CreativeMovie_tenantId_idx" ON "CreativeMovie"("tenantId");
CREATE INDEX "CreativeStartEndClip_tenantId_idx" ON "CreativeStartEndClip"("tenantId");
CREATE INDEX "CreativeUgcClip_tenantId_idx" ON "CreativeUgcClip"("tenantId");
CREATE INDEX "ContentCalendarPost_tenantId_idx" ON "ContentCalendarPost"("tenantId");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InviteRequest" ADD CONSTRAINT "InviteRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfferTemplate" ADD CONSTRAINT "OfferTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImageProject" ADD CONSTRAINT "ImageProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreativeCharacter" ADD CONSTRAINT "CreativeCharacter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreativeMovie" ADD CONSTRAINT "CreativeMovie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreativeStartEndClip" ADD CONSTRAINT "CreativeStartEndClip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreativeUgcClip" ADD CONSTRAINT "CreativeUgcClip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentCalendarPost" ADD CONSTRAINT "ContentCalendarPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
