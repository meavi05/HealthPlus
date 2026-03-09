ALTER TABLE medicines ADD COLUMN admin_updated_by_user_id INTEGER;
ALTER TABLE medicines ADD COLUMN admin_updated_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_medicines_admin_updated_by_user_id
ON medicines(admin_updated_by_user_id);
