/*
  Warnings:

  - You are about to drop the column `orderId` on the `Conversion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Conversion" DROP COLUMN "orderId",
ADD COLUMN     "orderHistory" TEXT[];
