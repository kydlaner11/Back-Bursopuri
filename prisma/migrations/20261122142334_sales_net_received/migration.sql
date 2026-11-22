-- AlterTable
ALTER TABLE "fin_daily_sales" ADD COLUMN     "isGrossEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "netReceived" DECIMAL(15,2) NOT NULL DEFAULT 0;
UPDATE "fin_daily_sales" SET "netReceived" = "grossSales" - "platformFee";
