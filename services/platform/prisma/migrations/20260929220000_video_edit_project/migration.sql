-- CreateTable
CREATE TABLE "CreativeVideoEditProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "exportPath" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeVideoEditProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeVideoEditMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeVideoEditMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeVideoEditProject_createdByUserId_idx" ON "CreativeVideoEditProject"("createdByUserId");

-- CreateIndex
CREATE INDEX "CreativeVideoEditProject_updatedAt_idx" ON "CreativeVideoEditProject"("updatedAt");

-- CreateIndex
CREATE INDEX "CreativeVideoEditProject_tenantId_idx" ON "CreativeVideoEditProject"("tenantId");

-- CreateIndex
CREATE INDEX "CreativeVideoEditMedia_projectId_createdAt_idx" ON "CreativeVideoEditMedia"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreativeVideoEditProject" ADD CONSTRAINT "CreativeVideoEditProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoEditProject" ADD CONSTRAINT "CreativeVideoEditProject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoEditMedia" ADD CONSTRAINT "CreativeVideoEditMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeVideoEditProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
