DROP INDEX IF EXISTS idx_tools_tag_id_unique;

ALTER TABLE tools
DROP COLUMN IF EXISTS tag_id;
