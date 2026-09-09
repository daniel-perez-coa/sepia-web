-- A NULL stock means the product is produced on demand (unlimited).
-- Keep the legacy column temporarily so SQLite can migrate without dropping data.
ALTER TABLE catalog_products RENAME COLUMN stock TO stock_legacy;
ALTER TABLE catalog_products ADD COLUMN stock INTEGER;
UPDATE catalog_products SET stock = stock_legacy;
