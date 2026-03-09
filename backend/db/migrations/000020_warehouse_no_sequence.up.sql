CREATE SEQUENCE IF NOT EXISTS warehouse_no_seq START WITH 1 INCREMENT BY 1 MINVALUE 1;

UPDATE warehouses
SET warehouse_no = NULL
WHERE warehouse_no IS NOT NULL
  AND BTRIM(warehouse_no) = '';

DO $$
DECLARE
    invalid_warehouse_nos TEXT;
    max_no BIGINT;
BEGIN
    SELECT string_agg(name || ':' || BTRIM(warehouse_no), ', ' ORDER BY name)
    INTO invalid_warehouse_nos
    FROM warehouses
    WHERE warehouse_no IS NOT NULL
      AND BTRIM(warehouse_no) !~ '^[0-9]+$';

    IF invalid_warehouse_nos IS NOT NULL THEN
        RAISE EXCEPTION 'warehouse_no must contain only digits before sequence migration: %', invalid_warehouse_nos;
    END IF;

    UPDATE warehouses
    SET warehouse_no = LPAD((BTRIM(warehouse_no)::numeric)::text, 5, '0')
    WHERE warehouse_no IS NOT NULL;

    SELECT COALESCE(MAX(warehouse_no::bigint), 0)
    INTO max_no
    FROM warehouses
    WHERE warehouse_no IS NOT NULL;

    IF max_no > 0 THEN
        PERFORM setval('warehouse_no_seq', max_no, true);
    ELSE
        PERFORM setval('warehouse_no_seq', 1, false);
    END IF;

    UPDATE warehouses
    SET warehouse_no = LPAD(nextval('warehouse_no_seq')::text, 5, '0')
    WHERE warehouse_no IS NULL;
END
$$;

ALTER TABLE warehouses
ALTER COLUMN warehouse_no SET DEFAULT LPAD(nextval('warehouse_no_seq')::text, 5, '0');

ALTER TABLE warehouses
ALTER COLUMN warehouse_no SET NOT NULL;

ALTER TABLE warehouses
ADD CONSTRAINT warehouses_warehouse_no_format CHECK (warehouse_no ~ '^[0-9]{5}$');
