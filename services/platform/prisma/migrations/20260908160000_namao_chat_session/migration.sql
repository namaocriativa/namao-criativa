-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "userId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'landing';

-- CreateIndex
CREATE INDEX "ChatSession_userId_channel_idx" ON "ChatSession"("userId", "channel");
CREATE INDEX "ChatSession_channel_idx" ON "ChatSession"("channel");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
