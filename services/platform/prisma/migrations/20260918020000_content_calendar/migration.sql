-- CreateTable
CREATE TABLE "ContentCalendarPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "leadId" TEXT,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendarTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT NOT NULL DEFAULT '',
    "externalId" TEXT NOT NULL DEFAULT '',
    "permalink" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendarAsset" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCalendarAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentCalendarPost_scheduledAt_status_idx" ON "ContentCalendarPost"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "ContentCalendarPost_status_idx" ON "ContentCalendarPost"("status");

-- CreateIndex
CREATE INDEX "ContentCalendarPost_leadId_idx" ON "ContentCalendarPost"("leadId");

-- CreateIndex
CREATE INDEX "ContentCalendarPost_customerId_idx" ON "ContentCalendarPost"("customerId");

-- CreateIndex
CREATE INDEX "ContentCalendarPost_createdByUserId_idx" ON "ContentCalendarPost"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCalendarTarget_postId_platform_key" ON "ContentCalendarTarget"("postId", "platform");

-- CreateIndex
CREATE INDEX "ContentCalendarTarget_status_idx" ON "ContentCalendarTarget"("status");

-- CreateIndex
CREATE INDEX "ContentCalendarAsset_postId_idx" ON "ContentCalendarAsset"("postId");

-- AddForeignKey
ALTER TABLE "ContentCalendarPost" ADD CONSTRAINT "ContentCalendarPost_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarPost" ADD CONSTRAINT "ContentCalendarPost_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarPost" ADD CONSTRAINT "ContentCalendarPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarTarget" ADD CONSTRAINT "ContentCalendarTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentCalendarPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarAsset" ADD CONSTRAINT "ContentCalendarAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentCalendarPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
