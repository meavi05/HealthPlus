CREATE TABLE IF NOT EXISTS medicine_inventory_details_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT,
  brand TEXT,
  hsn TEXT,
  manufacturer TEXT,
  pack TEXT,
  qty_fr TEXT,
  batch TEXT,
  expiry TEXT,
  mrp REAL,
  rate REAL,
  gst REAL DEFAULT 0,
  dis1 REAL DEFAULT 0,
  dis2 REAL DEFAULT 0,
  amount REAL,
  deal TEXT,
  effective_cost_price REAL,
  quantity_added INTEGER NOT NULL DEFAULT 0,
  bonus TEXT DEFAULT '',
  source TEXT DEFAULT 'ocr',
  agency_bill_id INTEGER REFERENCES agency_bills(id),
  medicine_category TEXT,
  medicine_type TEXT,
  medicine_description TEXT,
  medicine_uses TEXT,
  medicine_doses TEXT,
  admin_updated_by_user_id INTEGER,
  admin_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

INSERT INTO medicine_inventory_details_new (
  id,
  medicine_id,
  medicine_name,
  brand,
  hsn,
  manufacturer,
  pack,
  qty_fr,
  batch,
  expiry,
  mrp,
  rate,
  gst,
  dis1,
  dis2,
  amount,
  deal,
  effective_cost_price,
  quantity_added,
  bonus,
  source,
  agency_bill_id,
  medicine_category,
  medicine_type,
  medicine_description,
  medicine_uses,
  medicine_doses,
  admin_updated_by_user_id,
  admin_updated_at,
  created_at,
  updated_at
)
SELECT
  id,
  medicine_id,
  medicine_name,
  brand,
  hsn,
  manufacturer,
  pack,
  qty_fr,
  batch,
  expiry,
  mrp,
  rate,
  gst,
  dis1,
  dis2,
  amount,
  deal,
  effective_cost_price,
  quantity_added,
  CASE
    WHEN bonus_text IS NOT NULL AND bonus_text <> '' THEN bonus_text
    WHEN bonus IS NOT NULL AND bonus > 0 THEN CAST(bonus AS TEXT)
    ELSE ''
  END AS bonus,
  source,
  agency_bill_id,
  medicine_category,
  medicine_type,
  medicine_description,
  medicine_uses,
  medicine_doses,
  admin_updated_by_user_id,
  admin_updated_at,
  created_at,
  updated_at
FROM medicine_inventory_details;

DROP TABLE medicine_inventory_details;
ALTER TABLE medicine_inventory_details_new RENAME TO medicine_inventory_details;

CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_medicine_id
ON medicine_inventory_details(medicine_id);

CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_agency_bill_id
ON medicine_inventory_details(agency_bill_id);

CREATE INDEX IF NOT EXISTS idx_mid_admin_updated_by_user_id
ON medicine_inventory_details(admin_updated_by_user_id);

CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_name_brand
ON medicine_inventory_details(medicine_name, brand);
