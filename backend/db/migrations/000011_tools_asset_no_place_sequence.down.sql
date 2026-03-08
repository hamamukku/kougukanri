CREATE SEQUENCE IF NOT EXISTS tool_asset_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE tools
ALTER COLUMN asset_no SET DEFAULT ('T-' || LPAD(nextval('tool_asset_no_seq')::text, 6, '0'));
