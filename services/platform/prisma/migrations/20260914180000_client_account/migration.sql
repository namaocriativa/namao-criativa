-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientAccount_email_key" ON "ClientAccount"("email");
CREATE INDEX "ClientAccount_leadId_idx" ON "ClientAccount"("leadId");
CREATE INDEX "ClientAccount_customerId_idx" ON "ClientAccount"("customerId");

INSERT INTO "ClientAccount" ("id", "email", "passwordHash", "name", "leadId", "customerId", "createdAt", "updatedAt")
SELECT "id", "email", "passwordHash", "name", "leadId", "customerId", "createdAt", "updatedAt"
FROM "User"
WHERE "role" = 'CLIENT';

ALTER TABLE "ChatSession" ADD COLUMN "clientAccountId" TEXT;

UPDATE "ChatSession" AS session
SET "clientAccountId" = session."userId"
WHERE session."userId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "ClientAccount" AS account WHERE account."id" = session."userId");

DROP INDEX IF EXISTS "ChatSession_userId_channel_idx";
ALTER TABLE "ChatSession" DROP CONSTRAINT IF EXISTS "ChatSession_userId_fkey";
ALTER TABLE "ChatSession" DROP COLUMN IF EXISTS "userId";

CREATE INDEX "ChatSession_clientAccountId_channel_idx" ON "ChatSession"("clientAccountId", "channel");

ALTER TABLE "InstagramConnection" DROP CONSTRAINT IF EXISTS "InstagramConnection_userId_fkey";
DELETE FROM "InstagramConnection"
WHERE "userId" NOT IN (SELECT "id" FROM "ClientAccount");
ALTER TABLE "InstagramConnection" RENAME COLUMN "userId" TO "clientAccountId";
DROP INDEX IF EXISTS "InstagramConnection_userId_idx";
CREATE INDEX "InstagramConnection_clientAccountId_idx" ON "InstagramConnection"("clientAccountId");

DELETE FROM "User" WHERE "role" NOT IN ('ADMIN', 'OPERATOR');

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_leadId_fkey";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_customerId_fkey";
DROP INDEX IF EXISTS "User_leadId_idx";
DROP INDEX IF EXISTS "User_customerId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "leadId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "customerId";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'OPERATOR';
ALTER TABLE "User" ADD CONSTRAINT "User_role_studio_check" CHECK ("role" IN ('ADMIN', 'OPERATOR'));

ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
