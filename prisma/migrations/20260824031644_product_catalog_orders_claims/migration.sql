-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('ORDER_PLACED', 'PAYMENT_PENDING', 'PAYMENT_CLAIMED', 'CONFIRMED', 'DISPUTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WHATSAPP', 'MANUAL_TRANSFER', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentOperator" AS ENUM ('MTN_MOMO', 'ORANGE_MONEY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventActor" AS ENUM ('CUSTOMER', 'MERCHANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "basePriceXaf" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "option1Name" TEXT,
    "option2Name" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "option1Value" TEXT NOT NULL DEFAULT '',
    "option2Value" TEXT NOT NULL DEFAULT '',
    "priceXaf" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "state" "OrderState" NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "customerNote" TEXT,
    "subtotalXaf" INTEGER NOT NULL,
    "totalXaf" INTEGER NOT NULL,
    "trackingTokenHash" TEXT NOT NULL,
    "stockHeld" BOOLEAN NOT NULL DEFAULT false,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "unitPriceXaf" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalXaf" INTEGER NOT NULL,
    "imageKey" TEXT,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromState" "OrderState",
    "toState" "OrderState" NOT NULL,
    "actor" "EventActor" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_claim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "operator" "PaymentOperator" NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceNormalized" TEXT NOT NULL,
    "amountClaimedXaf" INTEGER NOT NULL,
    "screenshotKey" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "payment_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_payment_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "mtnMomoNumber" TEXT,
    "mtnMerchantCode" TEXT,
    "orangeMoneyNumber" TEXT,
    "orangeMerchantCode" TEXT,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payoutNotice" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_tenantId_idx" ON "category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "category_tenantId_id_key" ON "category"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "category_tenantId_slug_key" ON "category"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "product_tenantId_active_idx" ON "product"("tenantId", "active");

-- CreateIndex
CREATE INDEX "product_tenantId_categoryId_idx" ON "product"("tenantId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "product_tenantId_id_key" ON "product"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_tenantId_slug_key" ON "product"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "product_variant_tenantId_productId_idx" ON "product_variant"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_tenantId_id_key" ON "product_variant"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_tenantId_productId_option1Value_option2Valu_key" ON "product_variant"("tenantId", "productId", "option1Value", "option2Value");

-- CreateIndex
CREATE INDEX "product_image_tenantId_productId_idx" ON "product_image"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_image_tenantId_productId_position_key" ON "product_image"("tenantId", "productId", "position");

-- CreateIndex
CREATE INDEX "order_tenantId_state_placedAt_idx" ON "order"("tenantId", "state", "placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_tenantId_id_key" ON "order"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "order_tenantId_orderNumber_key" ON "order"("tenantId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "order_trackingTokenHash_key" ON "order"("trackingTokenHash");

-- CreateIndex
CREATE INDEX "order_item_tenantId_orderId_idx" ON "order_item"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "order_event_tenantId_orderId_createdAt_idx" ON "order_event"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_claim_tenantId_status_submittedAt_idx" ON "payment_claim"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "payment_claim_tenantId_orderId_idx" ON "payment_claim"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_claim_tenantId_id_key" ON "payment_claim"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_claim_tenantId_referenceNormalized_key" ON "payment_claim"("tenantId", "referenceNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_payment_settings_tenantId_key" ON "merchant_payment_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "category"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "product"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "product"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claim" ADD CONSTRAINT "payment_claim_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "order"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
