-- CreateEnum
CREATE TYPE "SupportAuthor" AS ENUM ('MERCHANT', 'PLATFORM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SupportAttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "subscriptionCurrentPeriodEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "support_message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "author" "SupportAuthor" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "readByMerchantAt" TIMESTAMP(3),
    "readByPlatformAt" TIMESTAMP(3),
    "subscriptionClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "SupportAttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payment_claim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operator" "PaymentOperator" NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceNormalized" TEXT NOT NULL,
    "amountXaf" INTEGER NOT NULL,
    "planTier" TEXT NOT NULL,
    "receiptKey" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "coversThrough" TIMESTAMP(3),

    CONSTRAINT "subscription_payment_claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_message_tenantId_createdAt_idx" ON "support_message"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "support_message_author_readByPlatformAt_createdAt_idx" ON "support_message"("author", "readByPlatformAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_message_tenantId_id_key" ON "support_message"("tenantId", "id");

-- CreateIndex
CREATE INDEX "support_attachment_tenantId_messageId_idx" ON "support_attachment"("tenantId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payment_claim_referenceNormalized_key" ON "subscription_payment_claim"("referenceNormalized");

-- CreateIndex
CREATE INDEX "subscription_payment_claim_status_submittedAt_idx" ON "subscription_payment_claim"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "subscription_payment_claim_tenantId_submittedAt_idx" ON "subscription_payment_claim"("tenantId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payment_claim_tenantId_id_key" ON "subscription_payment_claim"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_tenantId_messageId_fkey" FOREIGN KEY ("tenantId", "messageId") REFERENCES "support_message"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
