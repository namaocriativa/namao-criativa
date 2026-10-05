-- CreateTable
CREATE TABLE "CreativeVideoLivreClip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "brief" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "characterId" TEXT,
    "characterAssetId" TEXT NOT NULL DEFAULT '',
    "videoHookId" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '8s',
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "resolution" TEXT NOT NULL DEFAULT '360p',
    "model" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT NOT NULL DEFAULT '',
    "videoProjectId" TEXT NOT NULL DEFAULT '',
    "localPath" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeVideoLivreClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeVideoLivreClip_createdByUserId_idx" ON "CreativeVideoLivreClip"("createdByUserId");

-- CreateIndex
CREATE INDEX "CreativeVideoLivreClip_characterId_idx" ON "CreativeVideoLivreClip"("characterId");

-- CreateIndex
CREATE INDEX "CreativeVideoLivreClip_updatedAt_idx" ON "CreativeVideoLivreClip"("updatedAt");

-- CreateIndex
CREATE INDEX "CreativeVideoLivreClip_tenantId_idx" ON "CreativeVideoLivreClip"("tenantId");

-- AddForeignKey
ALTER TABLE "CreativeVideoLivreClip" ADD CONSTRAINT "CreativeVideoLivreClip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoLivreClip" ADD CONSTRAINT "CreativeVideoLivreClip_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoLivreClip" ADD CONSTRAINT "CreativeVideoLivreClip_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
