-- CreateTable
CREATE TABLE "CreativeUgcClip" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '8s',
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT NOT NULL DEFAULT '',
    "firstFramePath" TEXT NOT NULL DEFAULT '',
    "firstFrameName" TEXT NOT NULL DEFAULT '',
    "firstFrameMime" TEXT,
    "productPath" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL DEFAULT '',
    "productMime" TEXT,
    "localPath" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeUgcClip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeUgcClip_createdByUserId_idx" ON "CreativeUgcClip"("createdByUserId");
CREATE INDEX "CreativeUgcClip_characterId_idx" ON "CreativeUgcClip"("characterId");
CREATE INDEX "CreativeUgcClip_updatedAt_idx" ON "CreativeUgcClip"("updatedAt");

ALTER TABLE "CreativeUgcClip" ADD CONSTRAINT "CreativeUgcClip_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreativeUgcClip" ADD CONSTRAINT "CreativeUgcClip_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
