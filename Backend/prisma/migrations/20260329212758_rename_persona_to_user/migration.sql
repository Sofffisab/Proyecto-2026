/*
  Warnings:

  - You are about to drop the `persona` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "persona";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "mail" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "photo" BYTEA,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mail_key" ON "User"("mail");

-- CreateIndex
CREATE UNIQUE INDEX "User_user_key" ON "User"("user");
