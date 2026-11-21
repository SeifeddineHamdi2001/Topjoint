-- Joint types, application (automobile / moto / marine), priced épaisseurs,
-- and order-level discounts.

-- 1. New application field on products.
ALTER TABLE "Product" ADD COLUMN "application" VARCHAR(20) NOT NULL DEFAULT 'automobile';

-- 2. Old catalogue categories map to the new joint types.
UPDATE "Product" SET "application" = 'moto' WHERE "category" = 'moto';
UPDATE "Product" SET "category" = 'culasse' WHERE "category" = 'moto';
UPDATE "Product" SET "category" = 'carter' WHERE "category" IN ('plats', 'autres');

-- 3. Discounts are stored on the order for the admin totals.
ALTER TABLE "Order" ADD COLUMN "discountMillimes" INTEGER NOT NULL DEFAULT 0;

-- 4. Each épaisseur gets its own row and price (seeded from the old free-text field).
CREATE TABLE "ProductThickness" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "mm" VARCHAR(10) NOT NULL,
    "priceMillimes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductThickness_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProductThickness" ("productId", "mm", "priceMillimes", "position")
SELECT DISTINCT ON (p."id", btrim(t."mm"))
    p."id",
    btrim(t."mm"),
    p."priceMillimes",
    (t."ord" - 1)::integer
FROM "Product" p
CROSS JOIN LATERAL string_to_table(p."thicknesses", ',') WITH ORDINALITY AS t("mm", "ord")
WHERE btrim(t."mm") <> ''
ORDER BY p."id", btrim(t."mm"), t."ord";

CREATE UNIQUE INDEX "ProductThickness_productId_mm_key" ON "ProductThickness"("productId", "mm");
CREATE INDEX "ProductThickness_productId_idx" ON "ProductThickness"("productId");
ALTER TABLE "ProductThickness" ADD CONSTRAINT "ProductThickness_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. The material now lives in the product description; épaisseurs live in ProductThickness.
ALTER TABLE "Product" DROP COLUMN "thicknesses";
ALTER TABLE "Product" DROP COLUMN "material";

CREATE INDEX "Product_application_active_idx" ON "Product"("application", "active");
