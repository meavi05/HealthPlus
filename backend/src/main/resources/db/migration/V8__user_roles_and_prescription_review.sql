ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'ROLE_USER';

UPDATE users
SET role = 'ROLE_ADMIN'
WHERE lower(email) IN ('admin@healthplus.com');

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
