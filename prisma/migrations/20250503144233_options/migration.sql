/*
  Warnings:

  - You are about to drop the column `menuId` on the `MenuOption` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "MenuOption" DROP CONSTRAINT "MenuOption_menuId_fkey";

-- AlterTable
ALTER TABLE "MenuOption" DROP COLUMN "menuId",
ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_MenuToMenuOption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MenuToMenuOption_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MenuToMenuOption_B_index" ON "_MenuToMenuOption"("B");

-- AddForeignKey
ALTER TABLE "_MenuToMenuOption" ADD CONSTRAINT "_MenuToMenuOption_A_fkey" FOREIGN KEY ("A") REFERENCES "Menu"("id_menu") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MenuToMenuOption" ADD CONSTRAINT "_MenuToMenuOption_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
