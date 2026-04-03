CREATE TABLE IF NOT EXISTS ocr_receipt_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_hash TEXT NOT NULL UNIQUE,
  file_name TEXT,
  content_type TEXT,
  extracted_json TEXT NOT NULL,
  extraction_source TEXT NOT NULL DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_receipt_cache_last_used_at
ON ocr_receipt_cache(last_used_at);

CREATE TABLE IF NOT EXISTS medicine_profile_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  product_name TEXT,
  manufacturer TEXT,
  pack TEXT,
  medicine_category TEXT,
  medicine_type TEXT,
  medicine_description TEXT,
  medicine_uses TEXT,
  medicine_doses TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicine_profile_cache_name_mfr
ON medicine_profile_cache(product_name, manufacturer);
