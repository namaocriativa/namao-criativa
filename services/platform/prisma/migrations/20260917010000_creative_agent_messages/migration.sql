ALTER TABLE "ImageMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'generation';
ALTER TABLE "ImageMessage" ADD COLUMN "status" TEXT;
ALTER TABLE "ImageMessage" ADD COLUMN "usage" JSONB;
ALTER TABLE "ImageMessage" ADD COLUMN "toolName" TEXT;
ALTER TABLE "ImageMessage" ADD COLUMN "toolPayload" JSONB;
CREATE INDEX "ImageMessage_projectId_kind_idx" ON "ImageMessage"("projectId", "kind");

ALTER TABLE "VideoMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'generation';
ALTER TABLE "VideoMessage" ADD COLUMN "status" TEXT;
ALTER TABLE "VideoMessage" ADD COLUMN "usage" JSONB;
ALTER TABLE "VideoMessage" ADD COLUMN "toolName" TEXT;
ALTER TABLE "VideoMessage" ADD COLUMN "toolPayload" JSONB;
CREATE INDEX "VideoMessage_projectId_kind_idx" ON "VideoMessage"("projectId", "kind");
