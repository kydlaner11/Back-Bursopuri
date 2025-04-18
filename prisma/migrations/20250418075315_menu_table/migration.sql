-- CreateTable
CREATE TABLE "Menu" (
    "id_menu" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "harga" INTEGER NOT NULL,
    "kategori" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "status_stok" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id_menu")
);
