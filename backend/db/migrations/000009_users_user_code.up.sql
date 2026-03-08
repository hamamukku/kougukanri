ALTER TABLE users
ADD COLUMN user_code TEXT;

UPDATE users
SET user_code = username
WHERE user_code IS NULL OR btrim(user_code) = '';

ALTER TABLE users
ALTER COLUMN user_code SET NOT NULL;

ALTER TABLE users
ADD CONSTRAINT users_user_code_not_blank CHECK (btrim(user_code) <> '');

ALTER TABLE users
ADD CONSTRAINT users_user_code_key UNIQUE (user_code);
