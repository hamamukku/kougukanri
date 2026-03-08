ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_user_code_key;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_username_key;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS users_user_code_key;
DROP INDEX IF EXISTS users_username_key;
DROP INDEX IF EXISTS users_email_key;

CREATE UNIQUE INDEX users_user_code_key ON users(user_code) WHERE is_active = TRUE;
CREATE UNIQUE INDEX users_username_key ON users(username) WHERE is_active = TRUE;
CREATE UNIQUE INDEX users_email_key ON users(email) WHERE is_active = TRUE;
