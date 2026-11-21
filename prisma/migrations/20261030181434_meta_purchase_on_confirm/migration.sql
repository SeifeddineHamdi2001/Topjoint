-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "metaPurchaseSentAt" TIMESTAMPTZ(3),
ADD COLUMN     "metaVisitor" JSONB;
