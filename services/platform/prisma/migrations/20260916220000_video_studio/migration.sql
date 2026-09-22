-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT,
    "thoughts" TEXT,
    "model" TEXT,
    "settings" JSONB,
    "providerInteractionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAsset" (
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

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoProject_createdByUserId_idx" ON "VideoProject"("createdByUserId");
CREATE INDEX "VideoProject_updatedAt_idx" ON "VideoProject"("updatedAt");
CREATE INDEX "VideoMessage_projectId_createdAt_idx" ON "VideoMessage"("projectId", "createdAt");
CREATE INDEX "VideoAsset_projectId_createdAt_idx" ON "VideoAsset"("projectId", "createdAt");
CREATE INDEX "VideoAsset_messageId_idx" ON "VideoAsset"("messageId");
CREATE INDEX "VideoAsset_kind_idx" ON "VideoAsset"("kind");

ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoMessage" ADD CONSTRAINT "VideoMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "VideoMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
