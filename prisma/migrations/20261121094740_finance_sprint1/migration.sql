-- CreateEnum
CREATE TYPE "Wallet" AS ENUM ('BUSINESS', 'FAMILY');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'EWALLET');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "ObligationKind" AS ENUM ('LOAN', 'BILL', 'SAVING');

-- CreateTable
CREATE TABLE "fin_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "wallet" "Wallet" NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wallet" "Wallet" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "transferGroupId" TEXT,
    "idempotencyKey" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_channels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "priceMultiplier" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_daily_sales" (
    "id" TEXT NOT NULL,
    "salesDate" DATE NOT NULL,
    "channelId" TEXT NOT NULL,
    "grossSales" DECIMAL(15,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "platformFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_menu_costs" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "hpp" DECIMAL(15,2) NOT NULL,
    "packagingCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_menu_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_obligations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wallet" "Wallet" NOT NULL,
    "kind" "ObligationKind" NOT NULL,
    "monthlyAmount" DECIMAL(15,2) NOT NULL,
    "dueDay" INTEGER,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fin_accounts_name_wallet_key" ON "fin_accounts"("name", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "fin_categories_name_wallet_key" ON "fin_categories"("name", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_idempotencyKey_key" ON "fin_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "fin_transactions_transactionDate_idx" ON "fin_transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "fin_transactions_accountId_transactionDate_idx" ON "fin_transactions"("accountId", "transactionDate");

-- CreateIndex
CREATE INDEX "fin_transactions_transferGroupId_idx" ON "fin_transactions"("transferGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "fin_channels_code_key" ON "fin_channels"("code");

-- CreateIndex
CREATE INDEX "fin_daily_sales_salesDate_idx" ON "fin_daily_sales"("salesDate");

-- CreateIndex
CREATE UNIQUE INDEX "fin_daily_sales_salesDate_channelId_key" ON "fin_daily_sales"("salesDate", "channelId");

-- CreateIndex
CREATE INDEX "fin_menu_costs_menuId_idx" ON "fin_menu_costs"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "fin_menu_costs_menuId_effectiveFrom_key" ON "fin_menu_costs"("menuId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "fin_obligations_name_wallet_key" ON "fin_obligations"("name", "wallet");

-- CreateIndex
CREATE INDEX "fin_audit_logs_entity_entityId_idx" ON "fin_audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "fin_audit_logs_createdAt_idx" ON "fin_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fin_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_daily_sales" ADD CONSTRAINT "fin_daily_sales_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "fin_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
