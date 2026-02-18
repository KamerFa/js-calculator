-- Add shopifyProductId to Bike table
ALTER TABLE "Bike" ADD COLUMN "shopifyProductId" TEXT;

-- Drop columns that now come from Shopify
ALTER TABLE "Bike" DROP COLUMN IF EXISTS "category";
ALTER TABLE "Bike" DROP COLUMN IF EXISTS "engineSize";
ALTER TABLE "Bike" DROP COLUMN IF EXISTS "year";

-- Set a default for existing rows (if any)
UPDATE "Bike" SET "shopifyProductId" = 'legacy_' || "id" WHERE "shopifyProductId" IS NULL;

-- Make shopifyProductId required
ALTER TABLE "Bike" ALTER COLUMN "shopifyProductId" SET NOT NULL;

-- Add unique constraint on shop + shopifyProductId
CREATE UNIQUE INDEX "Bike_shop_shopifyProductId_key" ON "Bike"("shop", "shopifyProductId");
