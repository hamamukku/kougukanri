ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_user_code_key;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_user_code_not_blank;

ALTER TABLE users
DROP COLUMN IF EXISTS user_code;
