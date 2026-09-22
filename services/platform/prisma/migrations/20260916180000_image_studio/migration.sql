-- CreateTable
CREATE TABLE "ImageProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT,
    "thoughts" TEXT,
    "model" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImageProject_createdByUserId_idx" ON "ImageProject"("createdByUserId");
CREATE INDEX "ImageProject_updatedAt_idx" ON "ImageProject"("updatedAt");
CREATE INDEX "ImageMessage_projectId_createdAt_idx" ON "ImageMessage"("projectId", "createdAt");
CREATE INDEX "ImageAsset_projectId_createdAt_idx" ON "ImageAsset"("projectId", "createdAt");
CREATE INDEX "ImageAsset_messageId_idx" ON "ImageAsset"("messageId");
CREATE INDEX "ImageAsset_kind_idx" ON "ImageAsset"("kind");

ALTER TABLE "ImageProject" ADD CONSTRAINT "ImageProject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImageMessage" ADD CONSTRAINT "ImageMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImageProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImageProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ImageMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
