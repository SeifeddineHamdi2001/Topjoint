-- Allow longer thickness labels for combo products (e.g. "0.8 + 0.5")
ALTER TABLE "ProductThickness" ALTER COLUMN "mm" TYPE VARCHAR(30);
ALTER TABLE "OrderItem" ALTER COLUMN "thickness" TYPE VARCHAR(30);
