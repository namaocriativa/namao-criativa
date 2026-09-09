ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_owner_xor";
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_owner_xor" CHECK (
  ("leadId" IS NULL OR "customerId" IS NULL)
  AND (
    "channel" = 'namao'
    OR "leadId" IS NOT NULL
    OR "customerId" IS NOT NULL
  )
);

ALTER TABLE "ChatEvent" DROP CONSTRAINT "ChatEvent_owner_xor";
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_owner_xor" CHECK (
  "leadId" IS NULL OR "customerId" IS NULL
);
