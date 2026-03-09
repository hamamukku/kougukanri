ALTER TABLE warehouses
DROP CONSTRAINT IF EXISTS warehouses_warehouse_no_format;

ALTER TABLE warehouses
ALTER COLUMN warehouse_no DROP DEFAULT;

ALTER TABLE warehouses
ALTER COLUMN warehouse_no DROP NOT NULL;

DROP SEQUENCE IF EXISTS warehouse_no_seq;
