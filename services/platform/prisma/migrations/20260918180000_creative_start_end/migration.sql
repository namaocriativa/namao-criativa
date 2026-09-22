-- CreateTable
CREATE TABLE "CreativeStartEndClip" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '5s',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT NOT NULL DEFAULT '',
    "firstFramePath" TEXT NOT NULL DEFAULT '',
    "firstFrameName" TEXT NOT NULL DEFAULT '',
    "firstFrameMime" TEXT,
    "lastFramePath" TEXT NOT NULL DEFAULT '',
    "lastFrameName" TEXT NOT NULL DEFAULT '',
    "lastFrameMime" TEXT,
    "localPath" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeStartEndClip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeStartEndClip_createdByUserId_idx" ON "CreativeStartEndClip"("createdByUserId");
CREATE INDEX "CreativeStartEndClip_updatedAt_idx" ON "CreativeStartEndClip"("updatedAt");

ALTER TABLE "CreativeStartEndClip" ADD CONSTRAINT "CreativeStartEndClip_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
