-- CreateTable
CREATE TABLE "LandingGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "pageSpec" JSONB NOT NULL,
    "componentIds" TEXT NOT NULL,
    "themeStyle" TEXT NOT NULL,
    "category" TEXT,
    "visualScore" INTEGER,
    "screenshotPath" TEXT,
    "humanRating" INTEGER,
    "conversion" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandingGeneration_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandingGeneration_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LandingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LandingGeneration_jobId_key" ON "LandingGeneration"("jobId");
CREATE INDEX "LandingGeneration_leadId_idx" ON "LandingGeneration"("leadId");
CREATE INDEX "LandingGeneration_themeStyle_idx" ON "LandingGeneration"("themeStyle");
CREATE INDEX "LandingGeneration_category_idx" ON "LandingGeneration"("category");
