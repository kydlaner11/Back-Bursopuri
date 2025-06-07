/*
  Warnings:

  - You are about to drop the column `image` on the `profiles` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "image",
DROP COLUMN "image_url";
