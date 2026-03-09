import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AgencyBillRow, AgencyRow, BillMedicineRow, MedicineRow, ReceiptResult } from './types';
import { formatCurrency, formatDate } from './utils';
import BillScannerModal from './BillScannerModal';

interface ItemMasterTabProps {
  inventoryUploadLoading: boolean;
  inventoryUploadError: string | null;
  inventoryApplyLoading: boolean;
  inventoryApplyError: string | null;
  receiptResult: ReceiptResult | null;
  itemMasterQuery: string;
  itemMasterLoading: boolean;
  itemMasterMedicines: MedicineRow[];
  allMedicines: MedicineRow[];
  allMedicinesLoading: boolean;
  agencyQuery: string;
  agenciesLoading: boolean;
  agencies: AgencyRow[];
  selectedAgency: AgencyRow | null;
  agencyBillsLoading: boolean;
  agencyBills: AgencyBillRow[];
  selectedBill: AgencyBillRow | null;
  selectedBillId: number | null;
  billDetailsLoading: boolean;
  billMedicines: BillMedicineRow[];
  billSummary: { line_items?: number; total_units_added?: number } | null;
  onInventoryFileChange: (file: File | null) => void;
  onUploadInventoryReceipt: () => void;
  onItemMasterQueryChange: (query: string) => void;
  onAgencyQueryChange: (query: string) => void;
  onSelectAgency: (agency: AgencyRow) => void;
  onSelectBill: (bill: AgencyBillRow) => void;
  onApplyInventoryReview: (payload: Record<string, unknown>) => Promise<unknown>;
  onAddManualInventoryEntry: (payload: Record<string, unknown>) => Promise<unknown>;
  onFetchAgencyBillsForLinkage: (agencyId: number) => Promise<AgencyBillRow[]>;
  onBackToAgencyList: () => void;
  onBackToAgencyBills: () => void;
  onOpenBillMedicine: (line: BillMedicineRow) => void;
  onOpenMedicineDetails: (medicine: MedicineRow) => void;
}

interface ReviewRowForm {
  product: string;
  hsn: string;
  mfr: string;
  pack: string;
  qty_fr: string;
  medicine_category: string;
  medicine_type: string;
  medicine_description: string;
  medicine_uses: string;
  medicine_doses: string;
  bonus: string;
  batch: string;
  exp: string;
  mrp: string;
  rate: string;
  gst: string;
  dis1: string;
  dis2: string;
  amount: string;
}

export default function ItemMasterTab({
  inventoryUploadLoading,
  inventoryUploadError,
  inventoryApplyLoading,
  inventoryApplyError,
  receiptResult,
  itemMasterQuery,
  itemMasterLoading,
  itemMasterMedicines,
  allMedicines,
  allMedicinesLoading,
  agencyQuery,
  agenciesLoading,
  agencies,
  selectedAgency,
  agencyBillsLoading,
  agencyBills,
  selectedBill,
  selectedBillId,
  billDetailsLoading,
  billMedicines,
  billSummary,
  onInventoryFileChange,
  onUploadInventoryReceipt,
  onItemMasterQueryChange,
  onAgencyQueryChange,
  onSelectAgency,
  onSelectBill,
  onApplyInventoryReview,
  onAddManualInventoryEntry,
  onFetchAgencyBillsForLinkage,
  onBackToAgencyList,
  onBackToAgencyBills,
  onOpenBillMedicine,
  onOpenMedicineDetails,
}: ItemMasterTabProps) {
  const [itemMasterTab, setItemMasterTab] = useState<'agencies' | 'medicines'>('agencies');
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedUploadFileName, setSelectedUploadFileName] = useState<string>('');
  const [reviewAgency, setReviewAgency] = useState({ name: '', gstin: '', phone: '', address: '' });
  const [reviewBill, setReviewBill] = useState({ invoice_no: '', bill_number: '', invoice_date: '', bill_total: '' });
  const [reviewRows, setReviewRows] = useState<ReviewRowForm[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualLinkageType, setManualLinkageType] = useState<'none' | 'agency' | 'bill'>('none');
  const [manualLinkageAgencyId, setManualLinkageAgencyId] = useState<number | ''>('');
  const [manualLinkageBillId, setManualLinkageBillId] = useState<number | ''>('');
  const [manualLinkageBills, setManualLinkageBills] = useState<AgencyBillRow[]>([]);
  const [manualLinkageBillsLoading, setManualLinkageBillsLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    medicine_id: '',
    medicine_name: '',
    brand: '',
    description: '',
    category: '',
    medicine_type: '',
    medicine_uses: '',
    medicine_doses: '',
    hsn: '',
    manufacturer: '',
    pack: '',
    qty_fr: '',
    batch: '',
    expiry: '',
    mrp: '',
    rate: '',
    dis1: '',
    dis2: '',
    amount: '',
    quantity_added: '',
    bonus: '',
    source: 'manual',
    invoice_no: '',
    bill_number: '',
    invoice_date: '',
    bill_total: '',
  });
  const showAgencyListPage = !selectedAgency;
  const showAgencyDetailsPage = !!selectedAgency && !selectedBill;
  const showBillDetailsPage = !!selectedAgency && !!selectedBill;

  useEffect(() => {
    if (receiptResult?.mode === 'preview') {
      setReviewAgency({
        name: String(receiptResult.agency?.name || ''),
        gstin: String(receiptResult.agency?.gstin || ''),
        phone: String(receiptResult.agency?.phone || ''),
        address: String(receiptResult.agency?.address || ''),
      });
      setReviewBill({
        invoice_no: String(receiptResult.bill?.invoice_no || ''),
        bill_number: String(receiptResult.bill?.bill_number || ''),
        invoice_date: String(receiptResult.bill?.invoice_date || ''),
        bill_total: String(receiptResult.bill?.bill_total ?? ''),
      });
      const rows = Array.isArray(receiptResult.rows) ? receiptResult.rows : [];
      setReviewRows(
        rows.map((row: any) => ({
          product: String(row.product || row.name || ''),
          hsn: String(row.hsn || ''),
          mfr: String(row.mfr || row.manufacturer || row.brand || ''),
          pack: String(row.pack || ''),
          qty_fr: String(row.qty_fr || ''),
          medicine_category: String(row.medicine_category || row.category || ''),
          medicine_type: String(row.medicine_type || ''),
          medicine_description: String(row.medicine_description || row.description || ''),
          medicine_uses: String(row.medicine_uses || ''),
          medicine_doses: String(row.medicine_doses || ''),
          bonus: String(row.bonus ?? 0),
          batch: String(row.batch || ''),
          exp: String(row.exp || row.expiry || ''),
          mrp: String(row.mrp ?? 0),
          rate: String(row.rate ?? row.effective_unit_rate ?? 0),
          gst: String(row.gst ?? 0),
          dis1: String(row.dis1 ?? 0),
          dis2: String(row.dis2 ?? 0),
          amount: String(row.amount ?? 0),
        }))
      );
    }
    if (receiptResult?.mode === 'applied') {
      setReviewRows([]);
    }
  }, [receiptResult]);

  const handleManualAgencyChange = (value: string) => {
    const agencyId = value ? Number(value) : '';
    setManualLinkageAgencyId(agencyId);
    setManualLinkageBillId('');
    setManualLinkageBills([]);
    if (!value) return;
    setManualLinkageBillsLoading(true);
    onFetchAgencyBillsForLinkage(Number(value))
      .then((rows) => setManualLinkageBills(rows))
      .catch(() => setManualLinkageBills([]))
      .finally(() => setManualLinkageBillsLoading(false));
  };

  const handleManualSubmit = () => {
    setManualSaving(true);
    setManualError(null);
    const payload: Record<string, unknown> = {
      medicine_id: manualForm.medicine_id ? Number(manualForm.medicine_id) : 0,
      medicine_name: manualForm.medicine_name,
      brand: manualForm.brand,
      description: manualForm.description,
      category: manualForm.category,
      medicine_category: manualForm.category,
      medicine_type: manualForm.medicine_type,
      medicine_description: manualForm.description,
      medicine_uses: manualForm.medicine_uses,
      medicine_doses: manualForm.medicine_doses,
      hsn: manualForm.hsn,
      manufacturer: manualForm.manufacturer,
      pack: manualForm.pack,
      qty_fr: manualForm.qty_fr,
      batch: manualForm.batch,
      expiry: manualForm.expiry,
      mrp: Number(manualForm.mrp || 0),
      rate: Number(manualForm.rate || 0),
      dis1: Number(manualForm.dis1 || 0),
      dis2: Number(manualForm.dis2 || 0),
      amount: Number(manualForm.amount || 0),
      quantity_added: Number(manualForm.quantity_added || 0),
      bonus: Number(manualForm.bonus || 0),
      source: manualForm.source || 'manual',
      linkage_type: manualLinkageType,
      agency_id: manualLinkageAgencyId || 0,
      bill_id: manualLinkageBillId || 0,
      invoice_no: manualForm.invoice_no,
      bill_number: manualForm.bill_number,
      invoice_date: manualForm.invoice_date,
      bill_total: Number(manualForm.bill_total || 0),
    };
    onAddManualInventoryEntry(payload)
      .then(() => {
        setShowManualEntryForm(false);
        setManualForm({
          medicine_id: '',
          medicine_name: '',
          brand: '',
          description: '',
          category: '',
          medicine_type: '',
          medicine_uses: '',
          medicine_doses: '',
          hsn: '',
          manufacturer: '',
          pack: '',
          qty_fr: '',
          batch: '',
          expiry: '',
          mrp: '',
          rate: '',
          dis1: '',
          dis2: '',
          amount: '',
          quantity_added: '',
          bonus: '',
          source: 'manual',
          invoice_no: '',
          bill_number: '',
          invoice_date: '',
          bill_total: '',
        });
        setManualLinkageType('none');
        setManualLinkageAgencyId('');
        setManualLinkageBillId('');
        setManualLinkageBills([]);
      })
      .catch((error: Error) => setManualError(error.message || 'Unable to add inventory entry'))
      .finally(() => setManualSaving(false));
  };

  const addReviewRow = () => {
    setReviewRows((rows) => [
      ...rows,
      {
        product: '',
        hsn: '',
        mfr: '',
        pack: '',
        qty_fr: '',
        medicine_category: '',
        medicine_type: '',
        medicine_description: '',
        medicine_uses: '',
        medicine_doses: '',
        bonus: '0',
        batch: '',
        exp: '',
        mrp: '0',
        rate: '0',
        gst: '0',
        dis1: '0',
        dis2: '0',
        amount: '0',
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#f7fbff] to-white rounded-2xl border border-[#d7e8ff] p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Inventory Intake via OCR</h3>
        <p className="text-sm text-slate-500">Upload a medical agency bill. Agency and bill details are auto-linked.</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            id="inventory-bill-upload"
            type="file"
            accept="image/*,.pdf,.csv,.txt"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              onInventoryFileChange(file);
              setSelectedUploadFileName(file?.name || '');
            }}
            className="hidden"
          />
          <label htmlFor="inventory-bill-upload" className="px-3 py-2 text-sm rounded-lg border border-[#d8e6fa] bg-white text-slate-700 cursor-pointer">
            Choose File
          </label>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="px-3 py-2 text-sm rounded-lg border border-[#cfe0ff] bg-[#f5f9ff] text-[#1d5fc7]"
          >
            Scan Bill
          </button>
          <button
            type="button"
            onClick={onUploadInventoryReceipt}
            disabled={inventoryUploadLoading}
            className="px-3 py-2 text-sm rounded-lg bg-[#2d7ff9] text-white disabled:opacity-60"
          >
            {inventoryUploadLoading ? 'Running OCR Preview…' : 'Preview OCR'}
          </button>
        </div>
        {selectedUploadFileName && (
          <p className="text-xs text-slate-600">Selected file: <strong>{selectedUploadFileName}</strong></p>
        )}
        {inventoryUploadError && <p className="text-sm text-red-600">{inventoryUploadError}</p>}
        {receiptResult && (
          <div className="border rounded-xl p-3 bg-white text-xs text-slate-600 space-y-2">
            <p>
              {receiptResult.mode === 'preview' ? 'Preview ready:' : 'Last applied:'} <strong>{receiptResult.agency?.name || '-'}</strong> • Bill <strong>{receiptResult.bill?.invoice_no || receiptResult.bill?.bill_number || '-'}</strong>
            </p>
            {receiptResult.mode === 'preview' && (
              <>
                <p className="text-xs text-slate-500">Review and correct extracted values before applying.</p>
                <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Agency Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-slate-700">Agency Name
                      <input value={reviewAgency.name} onChange={(e) => setReviewAgency((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">GSTIN
                      <input value={reviewAgency.gstin} onChange={(e) => setReviewAgency((s) => ({ ...s, gstin: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">Phone
                      <input value={reviewAgency.phone} onChange={(e) => setReviewAgency((s) => ({ ...s, phone: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">Address
                      <input value={reviewAgency.address} onChange={(e) => setReviewAgency((s) => ({ ...s, address: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                  </div>
                </div>
                <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Bill Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-slate-700">Invoice No
                      <input value={reviewBill.invoice_no} onChange={(e) => setReviewBill((s) => ({ ...s, invoice_no: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Number
                      <input value={reviewBill.bill_number} onChange={(e) => setReviewBill((s) => ({ ...s, bill_number: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">Invoice Date
                      <input value={reviewBill.invoice_date} onChange={(e) => setReviewBill((s) => ({ ...s, invoice_date: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Total
                      <input value={reviewBill.bill_total} onChange={(e) => setReviewBill((s) => ({ ...s, bill_total: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                    </label>
                  </div>
                </div>
                <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">Medicine Rows ({reviewRows.length})</p>
                    <button type="button" onClick={addReviewRow} className="text-[11px] rounded border px-2 py-1">Add Row</button>
                  </div>
                  <div className="space-y-2 max-h-[44vh] overflow-auto pr-1">
                    {reviewRows.map((row, index) => (
                      <div key={`review-row-${index}`} className="rounded border border-[#d7e7ff] bg-white p-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-slate-700">Row #{index + 1}</p>
                          <button
                            type="button"
                            onClick={() => setReviewRows((rows) => rows.filter((_, idx) => idx !== index))}
                            className="text-[11px] rounded border border-red-300 bg-red-50 text-red-700 px-2 py-0.5"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['product', 'Product'],
                            ['hsn', 'HSN'],
                            ['mfr', 'Manufacturer'],
                            ['pack', 'Pack'],
                            ['qty_fr', 'Qty+F/R'],
                            ['medicine_category', 'Category'],
                            ['medicine_type', 'Medicine Type'],
                            ['medicine_description', 'Description'],
                            ['medicine_uses', 'Uses'],
                            ['medicine_doses', 'Doses'],
                            ['bonus', 'Bonus'],
                            ['batch', 'Batch'],
                            ['exp', 'Expiry'],
                            ['mrp', 'MRP'],
                            ['rate', 'Effective Price'],
                            ['gst', 'GST %'],
                            ['dis1', 'Dis1 %'],
                            ['dis2', 'Dis2 %'],
                            ['amount', 'Total Amount'],
                          ].map(([field, label]) => (
                            <label key={`${field}-${index}`} className="text-[11px] text-slate-700">
                              {label}
                              <input
                                value={(row as any)[field]}
                                onChange={(e) =>
                                  setReviewRows((rows) =>
                                    rows.map((entry, idx) => (idx === index ? { ...entry, [field]: e.target.value } : entry))
                                  )
                                }
                                className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {inventoryApplyError && <p className="text-sm text-red-600">{inventoryApplyError}</p>}
                <button
                  type="button"
                  onClick={() => {
                    onApplyInventoryReview({
                      agency: reviewAgency,
                      bill: {
                        ...reviewBill,
                        bill_total: Number(reviewBill.bill_total || 0),
                      },
                      rows: reviewRows.map((row) => ({
                        product: row.product,
                        hsn: row.hsn,
                        mfr: row.mfr,
                        pack: row.pack,
                        qty_fr: row.qty_fr,
                        medicine_category: row.medicine_category,
                        medicine_type: row.medicine_type,
                        medicine_description: row.medicine_description,
                        medicine_uses: row.medicine_uses,
                        medicine_doses: row.medicine_doses,
                        bonus: Number(row.bonus || 0),
                        batch: row.batch,
                        exp: row.exp,
                        mrp: Number(row.mrp || 0),
                        rate: Number(row.rate || 0),
                        gst: Number(row.gst || 0),
                        dis1: Number(row.dis1 || 0),
                        dis2: Number(row.dis2 || 0),
                        amount: Number(row.amount || 0),
                      })),
                    }).catch(() => {});
                  }}
                  disabled={inventoryApplyLoading}
                  className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-60"
                >
                  {inventoryApplyLoading ? 'Applying...' : 'Apply to Inventory'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="border-t border-dashed border-[#d7e8ff] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Add Medicine to Inventory (Manual)</p>
            <button
              type="button"
              onClick={() => setShowManualEntryForm((value) => !value)}
              className="text-xs rounded-lg border border-[#c9ddff] bg-white px-3 py-1.5 text-[#1d5fc7]"
            >
              {showManualEntryForm ? 'Hide Form' : 'Add Entry'}
            </button>
          </div>

          {showManualEntryForm && (
            <div className="mt-3 rounded-xl border border-[#dce8fa] bg-white p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="text-xs text-slate-700">Select Existing Medicine
                  <select
                    value={manualForm.medicine_id}
                    onChange={(e) => setManualForm((s) => ({ ...s, medicine_id: e.target.value }))}
                    className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="">Create/Use by name below</option>
                    {allMedicines.map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>{medicine.name} ({medicine.brand || 'Unspecified'})</option>
                    ))}
                  </select>
                  {allMedicinesLoading && <span className="text-[11px] text-slate-500">Loading medicines...</span>}
                </label>
                <label className="text-xs text-slate-700">Medicine Name (required if no existing selected)
                  <input value={manualForm.medicine_name} onChange={(e) => setManualForm((s) => ({ ...s, medicine_name: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Brand
                  <input value={manualForm.brand} onChange={(e) => setManualForm((s) => ({ ...s, brand: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Category
                  <input value={manualForm.category} onChange={(e) => setManualForm((s) => ({ ...s, category: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Medicine Type (Standard/Ethical or Generic)
                  <input value={manualForm.medicine_type} onChange={(e) => setManualForm((s) => ({ ...s, medicine_type: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" placeholder="standard/ethical or generic" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Description
                  <input value={manualForm.description} onChange={(e) => setManualForm((s) => ({ ...s, description: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Uses
                  <input value={manualForm.medicine_uses} onChange={(e) => setManualForm((s) => ({ ...s, medicine_uses: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Doses (Usually Prescribed by Doctor)
                  <input value={manualForm.medicine_doses} onChange={(e) => setManualForm((s) => ({ ...s, medicine_doses: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="text-xs text-slate-700">Qty Added
                  <input value={manualForm.quantity_added} onChange={(e) => setManualForm((s) => ({ ...s, quantity_added: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Bonus
                  <input value={manualForm.bonus} onChange={(e) => setManualForm((s) => ({ ...s, bonus: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Rate
                  <input value={manualForm.rate} onChange={(e) => setManualForm((s) => ({ ...s, rate: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">MRP
                  <input value={manualForm.mrp} onChange={(e) => setManualForm((s) => ({ ...s, mrp: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="text-xs text-slate-700">HSN
                  <input value={manualForm.hsn} onChange={(e) => setManualForm((s) => ({ ...s, hsn: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Manufacturer
                  <input value={manualForm.manufacturer} onChange={(e) => setManualForm((s) => ({ ...s, manufacturer: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Pack
                  <input value={manualForm.pack} onChange={(e) => setManualForm((s) => ({ ...s, pack: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Qty+F/R
                  <input value={manualForm.qty_fr} onChange={(e) => setManualForm((s) => ({ ...s, qty_fr: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Batch
                  <input value={manualForm.batch} onChange={(e) => setManualForm((s) => ({ ...s, batch: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Expiry
                  <input value={manualForm.expiry} onChange={(e) => setManualForm((s) => ({ ...s, expiry: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Dis1
                  <input value={manualForm.dis1} onChange={(e) => setManualForm((s) => ({ ...s, dis1: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Dis2
                  <input value={manualForm.dis2} onChange={(e) => setManualForm((s) => ({ ...s, dis2: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Amount
                  <input value={manualForm.amount} onChange={(e) => setManualForm((s) => ({ ...s, amount: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Source
                  <input value={manualForm.source} onChange={(e) => setManualForm((s) => ({ ...s, source: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="rounded-lg border border-[#e3edf9] bg-[#f9fbff] p-2.5">
                <p className="text-xs font-semibold text-slate-700 mb-2">Linkage</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'none'} onChange={() => setManualLinkageType('none')} /> No linkage</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'agency'} onChange={() => setManualLinkageType('agency')} /> Link to agency (create bill)</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'bill'} onChange={() => setManualLinkageType('bill')} /> Link to existing bill</label>
                </div>

                {(manualLinkageType === 'agency' || manualLinkageType === 'bill') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Agency
                      <select
                        value={manualLinkageAgencyId}
                        onChange={(e) => handleManualAgencyChange(e.target.value)}
                        className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                      >
                        <option value="">Select agency</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>{agency.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {manualLinkageType === 'agency' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Invoice No
                      <input value={manualForm.invoice_no} onChange={(e) => setManualForm((s) => ({ ...s, invoice_no: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Number
                      <input value={manualForm.bill_number} onChange={(e) => setManualForm((s) => ({ ...s, bill_number: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Invoice Date
                      <input value={manualForm.invoice_date} onChange={(e) => setManualForm((s) => ({ ...s, invoice_date: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Total
                      <input value={manualForm.bill_total} onChange={(e) => setManualForm((s) => ({ ...s, bill_total: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                  </div>
                )}

                {manualLinkageType === 'bill' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Bill
                      <select
                        value={manualLinkageBillId}
                        onChange={(e) => setManualLinkageBillId(e.target.value ? Number(e.target.value) : '')}
                        className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                      >
                        <option value="">Select bill</option>
                        {manualLinkageBills.map((bill) => (
                          <option key={bill.id} value={bill.id}>{bill.invoice_no || bill.bill_number || `Bill #${bill.id}`}</option>
                        ))}
                      </select>
                      {manualLinkageBillsLoading && <span className="text-[11px] text-slate-500">Loading bills...</span>}
                    </label>
                  </div>
                )}
              </div>

              {manualError && <p className="text-sm text-red-600">{manualError}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={manualSaving}
                  className="rounded-lg bg-[#2d7ff9] text-white px-4 py-2 text-sm disabled:opacity-60"
                >
                  {manualSaving ? 'Adding...' : 'Add to Inventory'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showScanner && (
        <BillScannerModal
          onClose={() => setShowScanner(false)}
          onCaptured={(file) => {
            onInventoryFileChange(file);
            setSelectedUploadFileName(file.name);
          }}
        />
      )}

      <div className="bg-white rounded-2xl border border-[#dce8fa] p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f4f8ff] p-1 mb-3">
          <button
            type="button"
            onClick={() => setItemMasterTab('agencies')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${itemMasterTab === 'agencies' ? 'bg-white text-[#1d5fc7] border border-[#cfe0ff]' : 'text-slate-600'}`}
          >
            Agency Details
          </button>
          <button
            type="button"
            onClick={() => setItemMasterTab('medicines')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${itemMasterTab === 'medicines' ? 'bg-white text-[#1d5fc7] border border-[#cfe0ff]' : 'text-slate-600'}`}
          >
            All Medicines
          </button>
        </div>

        {itemMasterTab === 'agencies' && (
          <div className="p-2 sm:p-3">
            {showAgencyListPage && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">Agencies</h3>
                  <input
                    type="text"
                    value={agencyQuery}
                    onChange={(e) => onAgencyQueryChange(e.target.value)}
                    placeholder="Search agency by name, GSTIN, address..."
                    className="w-full sm:w-80 border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[36rem] overflow-auto">
                  {agenciesLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading agencies...</p>
                  ) : agencies.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No agencies found yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {agencies.map((agency) => (
                        <button
                          key={agency.id}
                          type="button"
                          onClick={() => onSelectAgency(agency)}
                          className="w-full text-left rounded-xl border border-[#dfebff] bg-white hover:bg-[#f6faff] px-3 py-2 transition-colors"
                        >
                          <p className="font-semibold text-sm text-slate-800">{agency.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showAgencyDetailsPage && selectedAgency && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onBackToAgencyList}
                  className="inline-flex items-center gap-1 text-sm text-[#1d5fc7] hover:underline"
                >
                  <ArrowLeft size={14} /> Back to agencies
                </button>

                <div className="rounded-xl border border-[#dce8fa] bg-[#f8fbff] p-3">
                  <h3 className="font-semibold text-slate-800">{selectedAgency.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <p>GSTIN: <strong>{selectedAgency.gstin || '-'}</strong></p>
                    <p>Phone: <strong>{selectedAgency.phone || '-'}</strong></p>
                    <p className="md:col-span-2">Address: <strong>{selectedAgency.address || '-'}</strong></p>
                    <p>Bills: <strong>{selectedAgency.bill_count ?? 0}</strong></p>
                    <p>Mapped Rows: <strong>{selectedAgency.mapped_rows ?? 0}</strong></p>
                  </div>
                </div>

                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[34rem] overflow-auto">
                  <p className="text-sm font-semibold text-slate-800 px-2 pb-2">Bills</p>
                  {agencyBillsLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading bills...</p>
                  ) : agencyBills.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No bills found for this agency.</p>
                  ) : (
                    <div className="space-y-2">
                      {agencyBills.map((bill) => (
                        <button
                          key={bill.id}
                          type="button"
                          onClick={() => onSelectBill(bill)}
                          className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                            bill.total_mismatch
                              ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                              : selectedBillId === bill.id
                                ? 'border-[#0ea5a4] bg-[#ecfdf9]'
                                : 'border-[#dfebff] bg-white hover:bg-[#f6faff]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm text-slate-800">{bill.invoice_no || bill.bill_number || `Bill #${bill.id}`}</p>
                            {bill.total_mismatch ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold">Mismatch</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Date: {bill.invoice_date || formatDate(bill.created_at)}</p>
                          <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap gap-3">
                            <span>OCR Total: <strong>{formatCurrency(bill.ocr_total ?? bill.bill_total)}</strong></span>
                            <span>Calculated: <strong>{formatCurrency(bill.calculated_total)}</strong></span>
                            <span>Rows: <strong>{bill.mapped_rows ?? 0}</strong></span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showBillDetailsPage && selectedAgency && selectedBill && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onBackToAgencyBills}
                  className="inline-flex items-center gap-1 text-sm text-[#1d5fc7] hover:underline"
                >
                  <ArrowLeft size={14} /> Back to {selectedAgency.name}
                </button>

                <div className="rounded-xl border border-[#dce8fa] bg-[#f8fbff] p-3">
                  <h3 className="font-semibold text-slate-800">{selectedBill.invoice_no || selectedBill.bill_number || `Bill #${selectedBill.id}`}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <p>Agency: <strong>{selectedAgency.name}</strong></p>
                    <p>Date: <strong>{selectedBill.invoice_date || formatDate(selectedBill.created_at)}</strong></p>
                    <p>OCR Total: <strong>{formatCurrency(selectedBill.ocr_total ?? selectedBill.bill_total)}</strong></p>
                    <p>Calculated Total: <strong>{formatCurrency(selectedBill.calculated_total)}</strong></p>
                    <p>Mapped Rows: <strong>{selectedBill.mapped_rows ?? 0}</strong></p>
                  </div>
                  {selectedBill.total_mismatch ? (
                    <p className="text-xs text-amber-800 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1 mt-2">
                      Bill total mismatch detected. OCR total and calculated total are different.
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500 mt-2">
                    {billSummary ? `${billSummary.line_items ?? 0} lines • ${billSummary.total_units_added ?? 0} units added` : ''}
                  </p>
                </div>

                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[34rem] overflow-auto">
                  <p className="text-sm font-semibold text-slate-800 px-2 pb-2">Medicines From This Bill</p>
                  {billDetailsLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading bill medicines...</p>
                  ) : billMedicines.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No mapped medicines for selected bill.</p>
                  ) : (
                    <div className="space-y-2">
                      {billMedicines.map((line) => (
                        <button
                          key={line.id}
                          type="button"
                          onClick={() => onOpenBillMedicine(line)}
                          className="w-full text-left rounded-xl border border-[#deebff] bg-white p-2.5 hover:bg-[#f4f8ff]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{line.medicine_name}</p>
                            <p className="text-xs text-slate-500">Batch {line.batch || '-'}</p>
                          </div>
                          <div className="mt-1 text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <span>Qty: <strong>{line.quantity_added ?? 0}</strong></span>
                            <span>Bonus: <strong>{line.bonus ?? 0}</strong></span>
                            <span>Effective Price: <strong>{formatCurrency(line.effective_rate)}</strong></span>
                            <span>Total Amount: <strong>{formatCurrency(line.amount)}</strong></span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {itemMasterTab === 'medicines' && (
          <div className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="font-semibold text-slate-800">Mapped Medicines</h3>
              <input
                type="text"
                value={itemMasterQuery}
                onChange={(e) => onItemMasterQueryChange(e.target.value)}
                placeholder="Search medicine, brand, batch, HSN..."
                className="w-full sm:w-72 border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {itemMasterLoading ? (
              <p className="text-sm text-slate-500">Loading mapped medicines...</p>
            ) : itemMasterMedicines.length === 0 ? (
              <p className="text-sm text-slate-500">No mapped medicines found for this filter.</p>
            ) : (
              <div className="space-y-2 max-h-[52rem] overflow-auto pr-1">
                {itemMasterMedicines.map((medicine) => (
                  <button
                    key={medicine.id}
                    type="button"
                    onClick={() => onOpenMedicineDetails(medicine)}
                    className="w-full text-left border rounded-xl p-3 bg-slate-50 hover:bg-[#edf4ff] hover:border-[#9fc4ff] transition-colors"
                  >
                    <p className="font-medium text-slate-800">{medicine.name}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {medicine.brand || 'Unspecified'} • {medicine.category || 'General'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <span className="text-slate-600">Effective Price: <strong>{formatCurrency(medicine.price)}</strong></span>
                      <span className="text-slate-600">MRP: <strong>{formatCurrency(medicine.mrp)}</strong></span>
                      <span className="text-slate-600">Stock: <strong>{medicine.stock ?? 0}</strong></span>
                      <span className="text-slate-600">Mapped rows: <strong>{medicine.mapped_rows ?? 0}</strong></span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
