-- 1. Tabel brand
CREATE TABLE "fin_brands" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fin_brands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fin_brands_code_key" ON "fin_brands"("code");

-- 2. Isi 4 brand
INSERT INTO "fin_brands" ("id", "code", "name", "sortOrder") VALUES
  (gen_random_uuid()::text, 'BURSOPURI', 'Bursopuri', 1),
  (gen_random_uuid()::text, 'PANGPUR',   'Pangpur',   2),
  (gen_random_uuid()::text, 'HOKBO',     'Hokbo',     3),
  (gen_random_uuid()::text, 'OEWY',      'Oewy',      4);

-- 3. Kolom brandId: nullable dulu, isi data lama dengan Bursopuri, lalu wajibkan
ALTER TABLE "fin_daily_sales" ADD COLUMN "brandId" TEXT;
UPDATE "fin_daily_sales"
   SET "brandId" = (SELECT "id" FROM "fin_brands" WHERE "code" = 'BURSOPURI');
ALTER TABLE "fin_daily_sales" ALTER COLUMN "brandId" SET NOT NULL;

-- 4. Unique lama diganti unique baru (termasuk brand)
DROP INDEX "fin_daily_sales_salesDate_channelId_key";
CREATE UNIQUE INDEX "fin_daily_sales_salesDate_channelId_brandId_key"
    ON "fin_daily_sales"("salesDate", "channelId", "brandId");

-- 5. Relasi
ALTER TABLE "fin_daily_sales"
    ADD CONSTRAINT "fin_daily_sales_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "fin_brands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;