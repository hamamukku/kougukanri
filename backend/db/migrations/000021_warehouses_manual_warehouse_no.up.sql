ALTER TABLE warehouses
ALTER COLUMN warehouse_no DROP DEFAULT;

DROP SEQUENCE IF EXISTS warehouse_no_seq;
