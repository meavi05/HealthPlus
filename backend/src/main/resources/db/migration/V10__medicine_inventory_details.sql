CREATE TABLE IF NOT EXISTS medicine_inventory_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  hsn TEXT,
  manufacturer TEXT,
  pack TEXT,
  qty_fr TEXT,
  batch TEXT,
  expiry TEXT,
  mrp REAL,
  rate REAL,
  dis1 REAL DEFAULT 0,
  dis2 REAL DEFAULT 0,
  amount REAL,
  quantity_added INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'ocr',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_medicine_id
ON medicine_inventory_details(medicine_id);
