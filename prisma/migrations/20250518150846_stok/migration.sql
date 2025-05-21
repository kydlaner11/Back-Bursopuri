-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "jumlah_stok" INTEGER,
ADD COLUMN     "tersedia" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "status_stok" SET DEFAULT false;
