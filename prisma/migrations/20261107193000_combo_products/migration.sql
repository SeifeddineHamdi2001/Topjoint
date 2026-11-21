-- Combo products: a separate article made of one culasse gasket + one chemise gasket.

ALTER TABLE "Product" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'standard';
ALTER TABLE "Product" ADD COLUMN "comboCulasseId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "comboChemiseId" INTEGER;

CREATE INDEX "Product_kind_active_idx" ON "Product"("kind", "active");
CREATE INDEX "Product_comboCulasseId_idx" ON "Product"("comboCulasseId");
CREATE INDEX "Product_comboChemiseId_idx" ON "Product"("comboChemiseId");

-- Deleting a component must not delete the combo article: the link becomes null
-- and the admin can reattach the component later.
ALTER TABLE "Product" ADD CONSTRAINT "Product_comboCulasseId_fkey"
    FOREIGN KEY ("comboCulasseId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_comboChemiseId_fkey"
    FOREIGN KEY ("comboChemiseId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
