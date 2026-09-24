ALTER TABLE "CreativeMovieShotCast"
ADD COLUMN "assetId" TEXT;

CREATE INDEX "CreativeMovieShotCast_assetId_idx"
ON "CreativeMovieShotCast"("assetId");

ALTER TABLE "CreativeMovieShotCast"
ADD CONSTRAINT "CreativeMovieShotCast_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "CreativeCharacterAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
