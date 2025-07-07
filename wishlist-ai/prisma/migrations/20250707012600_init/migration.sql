/*
  Warnings:

  - Added the required column `ShopStatus` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('INSTALLED', 'UNINSTALLED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "ShopStatus" "ShopStatus" NOT NULL;
