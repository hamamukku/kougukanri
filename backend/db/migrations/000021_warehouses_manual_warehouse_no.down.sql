CREATE SEQUENCE IF NOT EXISTS warehouse_no_seq START WITH 1 INCREMENT BY 1 MINVALUE 1;

DO $$
DECLARE
    max_no BIGINT;
BEGIN
    SELECT COALESCE(MAX(warehouse_no::bigint), 0)
    INTO max_no
    FROM warehouses;

    IF max_no > 0 THEN
        PERFORM setval('warehouse_no_seq', max_no, true);
    ELSE
        PERFORM setval('warehouse_no_seq', 1, false);
    END IF;
END
$$;

ALTER TABLE warehouses
ALTER COLUMN warehouse_no SET DEFAULT LPAD(nextval('warehouse_no_seq')::text, 5, '0');
