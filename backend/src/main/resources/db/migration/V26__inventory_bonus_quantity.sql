ALTER TABLE medicine_inventory_details ADD COLUMN bonus_qty INTEGER NOT NULL DEFAULT 0;

UPDATE medicine_inventory_details
SET bonus_qty = CASE
  WHEN instr(COALESCE(qty_fr, ''), '+') > 0 THEN CAST(substr(COALESCE(qty_fr, ''), instr(COALESCE(qty_fr, ''), '+') + 1) AS INTEGER)
  WHEN instr(COALESCE(qty_fr, ''), '/') > 0 THEN CAST(substr(COALESCE(qty_fr, ''), instr(COALESCE(qty_fr, ''), '/') + 1) AS INTEGER)
  ELSE 0
END;
