UPDATE medicines
SET mrp = ROUND((
  SELECT mid.mrp
  FROM medicine_inventory_details mid
  WHERE mid.medicine_id = medicines.id
    AND mid.mrp IS NOT NULL
    AND mid.mrp > 0
  ORDER BY mid.id DESC
  LIMIT 1
), 2)
WHERE EXISTS (
  SELECT 1
  FROM medicine_inventory_details midx
  WHERE midx.medicine_id = medicines.id
    AND midx.mrp IS NOT NULL
    AND midx.mrp > 0
);
