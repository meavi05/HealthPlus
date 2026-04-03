# Sales Entry Wireframe

## Desktop Layout

```
+--------------------------------------------------------------------------------------+
| Admin Header: [Overview] [Item Master] [Sales]                                      |
+--------------------------------------------------------------------------------------+
| Sales Entry (Left: 65-70%)                       | Recent Sales (Right: 30-35%)      |
|--------------------------------------------------------------------------------------|
| Invoice No | Sale Date | Notes                  | Search (invoice/patient/doctor)    |
|--------------------------------------------------------------------------------------|
| Patient Section                                                                      |
| - Search Existing patient + select                                                   |
| - If not selected: add new patient fields (name/phone/age/gender/address)          |
|--------------------------------------------------------------------------------------|
| Doctor Section (Referrer)                                                            |
| - Search Existing doctor + select                                                    |
| - If not selected: add new doctor fields (name/phone/specialization)               |
|--------------------------------------------------------------------------------------|
| Sale Items                                                                           |
| Row: Medicine | Qty | Unit Price | Disc% | GST% | Line Total | Remove              |
| - Near expiry badge + top available lots shown below selected medicine              |
| - Add Row button                                                                      |
|--------------------------------------------------------------------------------------|
| Totals: Subtotal | Discount | Tax | Grand Total                                     |
| Actions: [New Entry] [Save Sale / Update Sale]                                      |
+--------------------------------------------------------------------------------------+
```

## Mobile Layout

```
Header
Sales Entry Form
Patient
Doctor
Items
Totals
Recent Sales List
```

## Interaction Notes

- Selecting a medicine always displays nearest-expiry and lot availability.
- On save/update, backend consumes stock from earliest-expiry lots first.
- Editing an existing sale restores previous stock and reapplies updated lines atomically.
