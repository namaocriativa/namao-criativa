-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "characterId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "characterId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_characterId_idx" ON "Lead"("characterId");

-- CreateIndex
CREATE INDEX "Customer_characterId_idx" ON "Customer"("characterId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CreativeCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
