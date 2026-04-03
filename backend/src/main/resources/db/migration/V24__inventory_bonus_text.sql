ALTER TABLE medicine_inventory_details
ADD COLUMN bonus_text TEXT DEFAULT '';

UPDATE medicine_inventory_details
SET bonus_text = CAST(bonus AS TEXT)
WHERE (bonus_text IS NULL OR bonus_text = '') AND bonus > 0;
