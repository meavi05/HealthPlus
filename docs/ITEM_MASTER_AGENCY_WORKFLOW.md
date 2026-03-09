# Item Master Agency-Bill Mapping

## What is implemented

When an admin uploads a medical bill in **Item Master**:

1. Agency details are extracted from the bill header (name, GSTIN, phone, address).
2. If agency already exists, it is reused and updated with missing details.
3. If agency does not exist, a new agency is created.
4. Bill metadata (invoice no, bill number, date, total, file name) is saved under that agency.
5. Every mapped medicine inventory row from that upload is linked to that specific bill.

## Data model

New tables/columns:

- `inventory_agencies`
- `agency_bills`
- `medicine_inventory_details.agency_bill_id`

Migration file:

- `backend/src/main/resources/db/migration/V12__agency_bills_and_mapping.sql`

## Admin APIs

### 1) List agencies
`GET /api/admin/item-master/agencies?q=`

Returns agency cards with:
- `bill_count`
- `mapped_rows`
- `last_bill_at`

### 2) List bills by agency
`GET /api/admin/item-master/agencies/{agencyId}/bills`

Returns bill list with:
- invoice/bill references
- bill total
- mapped row count
- total units added

### 3) Bill details with medicine rows
`GET /api/admin/item-master/bills/{billId}`

Returns:
- bill + agency header details
- mapped medicine rows added from that bill
- summary (`line_items`, `total_units_added`)

## UI changes in Admin > Item Master

- New **Agency Ledger** area with drill-down:
  - Agency list (searchable)
  - Bill list for selected agency
  - Bill medicine details for selected bill
- Existing mapped medicine search remains available.
- Upload result card now shows agency + bill summary.

## Notes

- Agency dedupe: GSTIN match first, otherwise agency name match.
- Bill dedupe: agency + invoice no + invoice date.
- Inventory rows continue to update medicine stock and pricing while now also preserving bill-level traceability.
