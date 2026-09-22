ALTER TABLE "Package" ADD COLUMN "promoPrice" DOUBLE PRECISION;
ALTER TABLE "Package" DROP COLUMN "whatsappMessage";
ALTER TABLE "Package" DROP COLUMN "emailSubject";
ALTER TABLE "Package" DROP COLUMN "emailBody";

CREATE TABLE "OfferTemplate" (
    "id" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "whatsappMessage" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferTemplate_pkey" PRIMARY KEY ("id")
);
