/*
  Warnings:

  - You are about to drop the column `avatar_url` on the `profiles` table. All the data in the column will be lost.
  - Added the required column `image` to the `profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `image_url` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "avatar_url",
ADD COLUMN     "image" TEXT NOT NULL,
ADD COLUMN     "image_url" TEXT NOT NULL;
