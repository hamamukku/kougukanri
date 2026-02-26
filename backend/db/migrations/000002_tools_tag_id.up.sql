ALTER TABLE tools
ADD COLUMN tag_id TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_tag_id_unique
ON tools(tag_id)
WHERE tag_id IS NOT NULL;
