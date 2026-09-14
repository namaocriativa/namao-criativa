-- CreateTable
CREATE TABLE "StudioUserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioUserActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioUserActivity_userId_createdAt_idx" ON "StudioUserActivity"("userId", "createdAt");

ALTER TABLE "StudioUserActivity" ADD CONSTRAINT "StudioUserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
