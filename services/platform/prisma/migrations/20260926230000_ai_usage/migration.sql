-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "candidatesTokens" INTEGER NOT NULL DEFAULT 0,
    "thoughtsTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "videoSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usdMicros" BIGINT NOT NULL DEFAULT 0,
    "fxUsdToBrl" DOUBLE PRECISION NOT NULL,
    "brlMicros" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "jobId" TEXT,
    "periodKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPriceRow" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "usdPerMillion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usdPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPriceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL DEFAULT '',
    "monthlyLimitUsdMicros" BIGINT NOT NULL,
    "warnPercent" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenantId_periodKey_idx" ON "AiUsageEvent"("tenantId", "periodKey");

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_periodKey_idx" ON "AiUsageEvent"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "AiUsageEvent_leadId_periodKey_idx" ON "AiUsageEvent"("leadId", "periodKey");

-- CreateIndex
CREATE INDEX "AiUsageEvent_customerId_periodKey_idx" ON "AiUsageEvent"("customerId", "periodKey");

-- CreateIndex
CREATE INDEX "AiUsageEvent_jobId_idx" ON "AiUsageEvent"("jobId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_occurredAt_idx" ON "AiUsageEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_feature_occurredAt_idx" ON "AiUsageEvent"("feature", "occurredAt");

-- CreateIndex
CREATE INDEX "AiPriceRow_model_unit_effectiveFrom_idx" ON "AiPriceRow"("model", "unit", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "AiBudget_tenantId_scope_scopeId_key" ON "AiBudget"("tenantId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "AiBudget_tenantId_idx" ON "AiBudget"("tenantId");

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBudget" ADD CONSTRAINT "AiBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed
INSERT INTO "AiPlatformSetting" ("key", "value", "updatedAt")
VALUES ('usdToBrl', '5.5', CURRENT_TIMESTAMP);

INSERT INTO "AiPriceRow" ("id", "model", "unit", "usdPerMillion", "usdPerUnit", "effectiveFrom", "createdAt") VALUES
('price_25pro_in', 'gemini-2.5-pro', 'input_token', 1.25, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25pro_out', 'gemini-2.5-pro', 'output_token', 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25pro_think', 'gemini-2.5-pro', 'thinking_token', 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25pro_cache', 'gemini-2.5-pro', 'cached_token', 0.315, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25flash_in', 'gemini-2.5-flash', 'input_token', 0.3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25flash_out', 'gemini-2.5-flash', 'output_token', 2.5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25flash_think', 'gemini-2.5-flash', 'thinking_token', 2.5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25flash_cache', 'gemini-2.5-flash', 'cached_token', 0.075, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25lite_in', 'gemini-2.5-flash-lite', 'input_token', 0.1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_25lite_out', 'gemini-2.5-flash-lite', 'output_token', 0.4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_20flash_in', 'gemini-2.0-flash', 'input_token', 0.1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_20flash_out', 'gemini-2.0-flash', 'output_token', 0.4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_20lite_in', 'gemini-2.0-flash-lite', 'input_token', 0.075, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_20lite_out', 'gemini-2.0-flash-lite', 'output_token', 0.3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_default_in', 'default', 'input_token', 0.3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_default_out', 'default', 'output_token', 2.5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_default_think', 'default', 'thinking_token', 2.5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_default_cache', 'default', 'cached_token', 0.075, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_img_25', 'gemini-2.5-flash-image', 'image', 0, 0.039, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_img_20', 'gemini-2.0-flash-preview-image-generation', 'image', 0, 0.039, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_img_default', 'default', 'image', 0, 0.039, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_veo3', 'veo-3.0-generate-preview', 'video_second', 0, 0.10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_veo3_fast', 'veo-3.0-fast-generate-preview', 'video_second', 0, 0.05, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_veo2', 'veo-2.0-generate-001', 'video_second', 0, 0.05, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('price_video_default', 'default', 'video_second', 0, 0.10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
