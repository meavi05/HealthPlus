-- Canonical pack metadata for inventory lot rows.
-- base_uom: smallest unit for stock math (TAB/CAP/ML/GM/...)
-- pack_uom: entered pack container unit (STRIP/BOTTLE/BOX/...)

ALTER TABLE medicine_inventory_details ADD COLUMN base_uom TEXT NOT NULL DEFAULT 'UNIT';
ALTER TABLE medicine_inventory_details ADD COLUMN pack_uom TEXT NOT NULL DEFAULT 'UNIT';

CREATE INDEX IF NOT EXISTS idx_mid_base_uom
ON medicine_inventory_details(base_uom);

CREATE INDEX IF NOT EXISTS idx_mid_pack_uom
ON medicine_inventory_details(pack_uom);
