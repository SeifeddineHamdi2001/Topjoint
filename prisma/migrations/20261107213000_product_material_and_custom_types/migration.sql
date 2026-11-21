-- Add optional material column and expand application column length
ALTER TABLE "Product" ADD COLUMN "material" VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE "Product" ALTER COLUMN "application" TYPE VARCHAR(40);
