-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "planSelectedAt" TIMESTAMP(3),
ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
