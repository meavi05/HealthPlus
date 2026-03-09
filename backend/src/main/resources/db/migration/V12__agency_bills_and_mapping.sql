CREATE TABLE IF NOT EXISTS inventory_agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_agencies_name
ON inventory_agencies(name);

CREATE TABLE IF NOT EXISTS agency_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  invoice_no TEXT,
  bill_number TEXT,
  invoice_date TEXT,
  bill_total REAL,
  file_name TEXT,
  raw_metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES inventory_agencies(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_bills_agency_id
ON agency_bills(agency_id);

ALTER TABLE medicine_inventory_details ADD COLUMN agency_bill_id INTEGER REFERENCES agency_bills(id);
CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_agency_bill_id
ON medicine_inventory_details(agency_bill_id);
