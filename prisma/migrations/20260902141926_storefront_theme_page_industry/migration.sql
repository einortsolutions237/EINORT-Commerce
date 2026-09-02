-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "industry" TEXT;

-- CreateTable
CREATE TABLE "storefront_theme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'flagship-fashion',
    "logoKey" TEXT,
    "draftTokens" JSONB NOT NULL,
    "publishedTokens" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_page" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storefront_theme_tenantId_key" ON "storefront_theme"("tenantId");

-- CreateIndex
CREATE INDEX "storefront_theme_tenantId_idx" ON "storefront_theme"("tenantId");

-- CreateIndex
CREATE INDEX "storefront_page_tenantId_pageType_idx" ON "storefront_page"("tenantId", "pageType");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_page_tenantId_pageType_key" ON "storefront_page"("tenantId", "pageType");
