-- CreateTable
CREATE TABLE "CreativeCharacter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appearance" TEXT NOT NULL,
    "personality" TEXT NOT NULL DEFAULT '',
    "identityPrompt" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeCharacterAsset" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeCharacterAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreativeCharacter_createdByUserId_idx" ON "CreativeCharacter"("createdByUserId");
CREATE INDEX "CreativeCharacter_updatedAt_idx" ON "CreativeCharacter"("updatedAt");
CREATE INDEX "CreativeCharacterAsset_characterId_createdAt_idx" ON "CreativeCharacterAsset"("characterId", "createdAt");
CREATE INDEX "CreativeCharacterAsset_kind_idx" ON "CreativeCharacterAsset"("kind");

ALTER TABLE "CreativeCharacter" ADD CONSTRAINT "CreativeCharacter_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeCharacterAsset" ADD CONSTRAINT "CreativeCharacterAsset_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
