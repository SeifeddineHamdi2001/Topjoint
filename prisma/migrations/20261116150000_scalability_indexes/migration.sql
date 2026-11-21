-- CreateIndex
CREATE INDEX "Product_active_createdAt_idx" ON "Product"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Product_active_priceMillimes_idx" ON "Product"("active", "priceMillimes");

-- CreateIndex
CREATE INDEX "Product_active_stock_idx" ON "Product"("active", "stock");

-- CreateIndex
CREATE INDEX "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Order_status_lastCallAt_idx" ON "Order"("status", "lastCallAt");

-- CreateIndex
CREATE INDEX "Order_phone_idx" ON "Order"("phone");
