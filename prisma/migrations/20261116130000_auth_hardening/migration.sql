-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RevokedToken" (
    "jti" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "LoginLimit" (
    "key" VARCHAR(255) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "lockedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "LoginLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginLimit_windowStart_idx" ON "LoginLimit"("windowStart");
