import { useEffect, useMemo, useState } from 'react';
import { SalesDoctorRow, SalesLotRow, SalesMedicineRow, SalesPatientRow, SalesSummaryRow } from './types';
import { formatCurrency, formatDate, parsePackSize } from './utils';

interface SaleFormItem {
  key: string;
  medicine_id: number | '';
  medicine_name: string;
  selected_batch: string;
  strips: number;
  units: number;
  strip_price: number;
  pack_size_override: number | '';
  discount_percent: number;
  gst_percent: number;
  near_expiry: boolean;
  near_expiry_days: number | null;
  nearest_expiry: string;
  lots: SalesLotRow[];
}

const emptyItem = (): SaleFormItem => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  medicine_id: '',
  medicine_name: '',
  selected_batch: '',
  strips: 0,
  units: 1,
  strip_price: 0,
  pack_size_override: '',
  discount_percent: 0,
  gst_percent: 0,
  near_expiry: false,
  near_expiry_days: null,
  nearest_expiry: '',
  lots: [],
});

export default function SalesTab() {
  const [salesQuery, setSalesQuery] = useState('');
  const [salesRows, setSalesRows] = useState<SalesSummaryRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineRows, setMedicineRows] = useState<SalesMedicineRow[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);

  const [patientLookup, setPatientLookup] = useState('');
  const [patientRows, setPatientRows] = useState<SalesPatientRow[]>([]);
  const [doctorLookup, setDoctorLookup] = useState('');
  const [doctorRows, setDoctorRows] = useState<SalesDoctorRow[]>([]);

  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [invoiceNo, setInvoiceNo] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientAddress, setPatientAddress] = useState('');

  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
  const [showNewDoctorForm, setShowNewDoctorForm] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorRegNo, setDoctorRegNo] = useState('');
  const [doctorSpecialization, setDoctorSpecialization] = useState('');

  const [items, setItems] = useState<SaleFormItem[]>([emptyItem()]);

  const fetchSales = (query: string) => {
    setSalesLoading(true);
    fetch(`/api/admin/sales?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load sales'))))
      .then((data) => setSalesRows(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setSalesLoading(false));
  };

  const fetchPatients = (query: string) => {
    fetch(`/api/admin/sales/patients?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load patients'))))
      .then((data) => setPatientRows(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message));
  };

  const fetchDoctors = (query: string) => {
    fetch(`/api/admin/sales/doctors?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load doctors'))))
      .then((data) => setDoctorRows(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message));
  };

  const fetchMedicines = (query: string) => {
    setMedicinesLoading(true);
    fetch(`/api/admin/sales/medicines?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load medicines for sale'))))
      .then((data) => setMedicineRows(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setMedicinesLoading(false));
  };

  const fetchLots = (medicineId: number): Promise<SalesLotRow[]> =>
    fetch(`/api/admin/sales/medicines/${medicineId}/lots`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load lots'))))
      .then((data) => (Array.isArray(data) ? data : []));

  useEffect(() => {
    const timeout = setTimeout(() => fetchSales(salesQuery), 200);
    return () => clearTimeout(timeout);
  }, [salesQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => fetchMedicines(medicineQuery), 200);
    return () => clearTimeout(timeout);
  }, [medicineQuery]);

  useEffect(() => {
    fetchSales('');
    fetchPatients('');
    fetchDoctors('');
    fetchMedicines('');
  }, []);

  useEffect(() => {
    if (showNewPatientForm) return;
    const value = patientLookup.trim().toLowerCase();
    if (!value) return;
    const matched = patientRows.find((row) => patientOptionLabel(row).toLowerCase() === value);
    if (matched) {
      setSelectedPatientId(matched.id);
    }
  }, [patientLookup, patientRows, showNewPatientForm]);

  useEffect(() => {
    if (showNewDoctorForm) return;
    const value = doctorLookup.trim().toLowerCase();
    if (!value) return;
    const matched = doctorRows.find((row) => doctorOptionLabel(row).toLowerCase() === value);
    if (matched) {
      setSelectedDoctorId(matched.id);
    }
  }, [doctorLookup, doctorRows, showNewDoctorForm]);

  const resetForm = () => {
    setEditingSaleId(null);
    setInvoiceNo('');
    setSaleDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setSelectedPatientId('');
    setPatientLookup('');
    setShowNewPatientForm(false);
    setPatientName('');
    setPatientPhone('');
    setPatientAge('');
    setPatientGender('');
    setPatientAddress('');
    setSelectedDoctorId('');
    setDoctorLookup('');
    setShowNewDoctorForm(false);
    setDoctorName('');
    setDoctorPhone('');
    setDoctorRegNo('');
    setDoctorSpecialization('');
    setItems([emptyItem()]);
    setSuccessMessage('');
    setError(null);
  };

  const toSafeInt = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  };

  const asNonBlankText = (value: unknown) => String(value ?? '').trim();
  const patientOptionLabel = (patient: SalesPatientRow) =>
    `${patient.name || ''}${patient.phone ? ` • ${patient.phone}` : ''}`.trim();
  const doctorOptionLabel = (doctor: SalesDoctorRow) =>
    `${doctor.name || ''}${doctor.reg_no ? ` • ${doctor.reg_no}` : ''}${doctor.specialization ? ` (${doctor.specialization})` : ''}`.trim();

  const round2 = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

  const resolvePackSizeFromMetadata = (
    item: Pick<SaleFormItem, 'medicine_id' | 'lots'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ): number | null => {
    const medicine = selectedMedicine ?? medicineRows.find((row) => row.id === item.medicine_id);
    const lots = selectedLots ?? item.lots;

    const medicinePackText = asNonBlankText(medicine?.pack);
    if (medicinePackText) return Math.max(1, parsePackSize(medicinePackText));

    const medicinePackSize = Number(medicine?.stock_pack_size || 0);
    if (medicinePackSize > 1) return toSafeInt(medicinePackSize) || 1;

    const firstLotWithPack = lots.find((lot) => asNonBlankText(lot?.pack));
    if (firstLotWithPack) return Math.max(1, parsePackSize(firstLotWithPack.pack));

    const lotPackSize = Number(lots[0]?.pack_size || 0);
    if (lotPackSize > 1) return toSafeInt(lotPackSize) || 1;

    return null;
  };

  const resolvePackSize = (
    item: Pick<SaleFormItem, 'medicine_id' | 'lots' | 'pack_size_override'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ) => {
    const overridePackSize = toSafeInt(Number(item.pack_size_override || 0));
    if (overridePackSize > 0) return overridePackSize;

    const metadataPackSize = resolvePackSizeFromMetadata(item, selectedMedicine, selectedLots);
    if (metadataPackSize != null) return metadataPackSize;

    return 1;
  };

  const isPackSizeMissing = (
    item: Pick<SaleFormItem, 'medicine_id' | 'lots' | 'pack_size_override'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ) => resolvePackSizeFromMetadata(item, selectedMedicine, selectedLots) == null && toSafeInt(Number(item.pack_size_override || 0)) <= 0;

  const normalizeUomLabel = (value: unknown, fallback: string) => {
    const text = asNonBlankText(value).toUpperCase();
    if (text) return text;
    return fallback;
  };

  const resolveUomLabels = (
    item: Pick<SaleFormItem, 'medicine_id' | 'lots' | 'pack_size_override'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ) => {
    const medicine = selectedMedicine ?? medicineRows.find((row) => row.id === item.medicine_id);
    const lots = selectedLots ?? item.lots;
    const packSize = resolvePackSize(item, selectedMedicine, selectedLots);
    const primaryLot = lots[0];
    const packUom = normalizeUomLabel(
      primaryLot?.pack_uom ?? medicine?.stock_pack_uom,
      packSize > 1 ? 'STRIP' : 'UNIT'
    );
    const baseUom = normalizeUomLabel(
      primaryLot?.base_uom ?? medicine?.stock_base_uom,
      packSize > 1 ? 'TAB' : 'UNIT'
    );
    return {
      packUom,
      baseUom,
    };
  };

  const splitQuantity = (quantity: number, packSize: number) => {
    const total = toSafeInt(quantity);
    if (packSize <= 1) {
      return { strips: 0, units: total };
    }
    return {
      strips: Math.floor(total / packSize),
      units: total % packSize,
    };
  };

  const normalizeSplit = (strips: number, units: number, packSize: number) => {
    const safeStrips = toSafeInt(strips);
    const safeUnits = toSafeInt(units);
    if (packSize <= 1) {
      return { strips: 0, units: safeStrips + safeUnits };
    }
    const total = safeStrips * packSize + safeUnits;
    return splitQuantity(total, packSize);
  };

  const itemQuantity = (
    item: Pick<SaleFormItem, 'strips' | 'units' | 'medicine_id' | 'lots' | 'pack_size_override'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ) => {
    const packSize = resolvePackSize(item, selectedMedicine, selectedLots);
    const normalized = normalizeSplit(item.strips, item.units, packSize);
    return normalized.strips * packSize + normalized.units;
  };

  const itemUnitPrice = (
    item: Pick<SaleFormItem, 'strip_price' | 'medicine_id' | 'lots' | 'pack_size_override'>,
    selectedMedicine?: SalesMedicineRow,
    selectedLots?: SalesLotRow[]
  ) => {
    const stripPrice = Math.max(0, Number(item.strip_price || 0));
    const packSize = resolvePackSize(item, selectedMedicine, selectedLots);
    return stripPrice / Math.max(1, packSize);
  };

  const updateItemSplit = (index: number, nextStrips: number, nextUnits: number) => {
    setItems((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const packSize = resolvePackSize(row);
        const normalized = normalizeSplit(nextStrips, nextUnits, packSize);
        return { ...row, strips: normalized.strips, units: normalized.units };
      })
    );
  };

  const updatePackSizeOverride = (index: number, nextValue: number | '') => {
    setItems((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const override = nextValue === '' ? '' : Math.max(1, toSafeInt(nextValue));
        const packSize = resolvePackSize({ ...row, pack_size_override: override });
        const normalized = normalizeSplit(row.strips, row.units, packSize);
        return {
          ...row,
          pack_size_override: override,
          strips: normalized.strips,
          units: normalized.units,
        };
      })
    );
  };

  const applyMedicineSelection = async (index: number, medicineId: number) => {
    const selected = medicineRows.find((row) => row.id === medicineId);
    const lots = await fetchLots(medicineId);
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const currentTotalQty = itemQuantity(item);
        const nextPackSize = resolvePackSize(item, selected, lots);
        const nextSplit = splitQuantity(currentTotalQty, nextPackSize);
        return {
          ...item,
          medicine_id: medicineId,
          medicine_name: selected?.name || item.medicine_name,
          selected_batch: asNonBlankText(lots[0]?.batch),
          strips: nextSplit.strips,
          units: nextSplit.units,
          strip_price: selected?.price ?? item.strip_price ?? 0,
          pack_size_override: '',
          near_expiry: Boolean(selected?.near_expiry || lots[0]?.near_expiry),
          near_expiry_days:
            selected?.near_expiry_days == null
              ? (lots[0]?.near_expiry_days ?? null)
              : selected.near_expiry_days,
          nearest_expiry: selected?.nearest_expiry || (typeof lots[0]?.expiry === 'string' ? lots[0].expiry : ''),
          lots,
        };
      })
    );
  };

  const lineTotal = (item: SaleFormItem) => {
    const base = itemQuantity(item) * itemUnitPrice(item);
    const afterDiscount = base * (1 - Math.max(0, item.discount_percent) / 100);
    return afterDiscount * (1 + Math.max(0, item.gst_percent) / 100);
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + itemQuantity(item) * itemUnitPrice(item), 0);
    const discount = items.reduce(
      (sum, item) => sum + itemQuantity(item) * itemUnitPrice(item) * (Math.max(0, item.discount_percent) / 100),
      0
    );
    const tax = items.reduce((sum, item) => {
      const base = itemQuantity(item) * itemUnitPrice(item);
      const afterDiscount = base * (1 - Math.max(0, item.discount_percent) / 100);
      return sum + afterDiscount * (Math.max(0, item.gst_percent) / 100);
    }, 0);
    return {
      subtotal,
      discount,
      tax,
      grand: subtotal - discount + tax,
    };
  }, [items, medicineRows]);

  const hydrateItemsForEditing = async (rows: SaleFormItem[]) => {
    const hydrated = await Promise.all(
      rows.map(async (row) => {
        if (!row.medicine_id) return row;
        const medicine = medicineRows.find((m) => m.id === row.medicine_id);
        const lots = await fetchLots(row.medicine_id);
        const packSize = resolvePackSize(row, medicine, lots);
        const normalized = normalizeSplit(row.strips, row.units, packSize);
        const normalizedBatch =
          row.selected_batch && lots.some((lot) => String(lot.batch || '').trim() === row.selected_batch)
            ? row.selected_batch
            : asNonBlankText(lots[0]?.batch);
        return {
          ...row,
          selected_batch: normalizedBatch,
          strips: normalized.strips,
          units: normalized.units,
          strip_price: round2(Math.max(0, row.strip_price) * packSize),
          near_expiry: Boolean(medicine?.near_expiry || lots[0]?.near_expiry),
          near_expiry_days:
            medicine?.near_expiry_days == null ? (lots[0]?.near_expiry_days ?? null) : medicine.near_expiry_days,
          nearest_expiry: medicine?.nearest_expiry || (typeof lots[0]?.expiry === 'string' ? lots[0].expiry : ''),
          lots,
        };
      })
    );
    setItems(hydrated.length ? hydrated : [emptyItem()]);
  };

  const loadSaleForEdit = (saleId: number) => {
    setError(null);
    setSuccessMessage('');
    fetch(`/api/admin/sales/${saleId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load sale'))))
      .then(async (data) => {
        const sale = data?.sale || {};
        const saleItems = Array.isArray(data?.items) ? data.items : [];
        setEditingSaleId(Number(sale.id || saleId));
        setInvoiceNo(String(sale.invoice_no || ''));
        setSaleDate(String(sale.sale_date || new Date().toISOString().slice(0, 10)));
        setNotes(String(sale.notes || ''));

        const patientId = Number(sale.patient_id || 0);
        setSelectedPatientId(patientId > 0 ? patientId : '');
        setPatientLookup(patientId > 0 ? `${String(sale.patient_name || '')}${sale.patient_phone ? ` • ${String(sale.patient_phone || '')}` : ''}`.trim() : '');
        setShowNewPatientForm(false);
        setPatientName(patientId > 0 ? '' : String(sale.patient_name || ''));
        setPatientPhone(patientId > 0 ? '' : String(sale.patient_phone || ''));
        setPatientAge(patientId > 0 ? '' : String(sale.patient_age || ''));
        setPatientGender(patientId > 0 ? '' : String(sale.patient_gender || ''));
        setPatientAddress(patientId > 0 ? '' : String(sale.patient_address || ''));

        const doctorId = Number(sale.doctor_id || 0);
        setSelectedDoctorId(doctorId > 0 ? doctorId : '');
        setDoctorLookup(
          doctorId > 0
            ? `${String(sale.doctor_name || '')}${sale.doctor_reg_no ? ` • ${String(sale.doctor_reg_no || '')}` : ''}${sale.doctor_specialization ? ` (${String(sale.doctor_specialization || '')})` : ''}`.trim()
            : ''
        );
        setShowNewDoctorForm(false);
        setDoctorName(doctorId > 0 ? '' : String(sale.doctor_name || ''));
        setDoctorPhone(doctorId > 0 ? '' : String(sale.doctor_phone || ''));
        setDoctorRegNo(doctorId > 0 ? '' : String(sale.doctor_reg_no || ''));
        setDoctorSpecialization(doctorId > 0 ? '' : String(sale.doctor_specialization || ''));

        const grouped = new Map<string, SaleFormItem>();
        for (const item of saleItems) {
          const medicineId = Number(item.medicine_id || 0);
          const unitPrice = Number(item.unit_price || 0);
          const discountPercent = Number(item.discount_percent || 0);
          const gstPercent = Number(item.gst_percent || 0);
          const batch = String(item.batch || '').trim();
          const key = `${medicineId}-${unitPrice}-${discountPercent}-${gstPercent}-${batch}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.units += Number(item.quantity || 0);
          } else {
            grouped.set(key, {
              key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              medicine_id: medicineId > 0 ? medicineId : '',
              medicine_name: String(item.medicine_name || ''),
              selected_batch: batch,
              strips: 0,
              units: Number(item.quantity || 0),
              strip_price: unitPrice,
              pack_size_override: '',
              discount_percent: discountPercent,
              gst_percent: gstPercent,
              near_expiry: false,
              near_expiry_days: null,
              nearest_expiry: '',
              lots: [],
            });
          }
        }
        await hydrateItemsForEditing(Array.from(grouped.values()));
      })
      .catch((err: Error) => setError(err.message));
  };

  const saveSale = () => {
    setError(null);
    setSuccessMessage('');

    const saleItems = items.filter((item) => Number(item.medicine_id) > 0 && itemQuantity(item) > 0);
    if (saleItems.length === 0) {
      setError('Add at least one valid medicine row.');
      return;
    }
    for (const item of saleItems) {
      if (isPackSizeMissing(item)) {
        setError(`Pack size missing for "${item.medicine_name || 'selected medicine'}". Enter pack size to calculate base-unit price.`);
        return;
      }
      if (Number(item.strip_price || 0) <= 0) {
        setError(`Pack price should be greater than 0 for "${item.medicine_name || 'selected medicine'}".`);
        return;
      }
    }

    const normalizedItems = saleItems
      .map((item) => {
        const packSize = resolvePackSize(item);
        const split = normalizeSplit(item.strips, item.units, packSize);
        return {
          strips: split.strips,
          tablets: split.units,
          pack_size: packSize,
          batch: item.selected_batch,
          medicine_id: Number(item.medicine_id),
          unit_price: itemUnitPrice(item),
          discount_percent: Number(item.discount_percent || 0),
          gst_percent: Number(item.gst_percent || 0),
        };
      });

    const payload: Record<string, unknown> = {
      invoice_no: invoiceNo.trim(),
      sale_date: saleDate,
      notes: notes.trim(),
      patient_id: selectedPatientId || null,
      doctor_id: selectedDoctorId || null,
      items: normalizedItems,
    };

    if (showNewPatientForm && !selectedPatientId && patientName.trim()) {
      payload.patient = {
        name: patientName.trim(),
        phone: patientPhone.trim(),
        age: Number(patientAge || 0),
        gender: patientGender.trim(),
        address: patientAddress.trim(),
      };
    }
    if (showNewDoctorForm && !selectedDoctorId && doctorName.trim()) {
      payload.doctor = {
        name: doctorName.trim(),
        phone: doctorPhone.trim(),
        reg_no: doctorRegNo.trim(),
        specialization: doctorSpecialization.trim(),
      };
    }

    setSaving(true);
    fetch(editingSaleId ? `/api/admin/sales/${editingSaleId}` : '/api/admin/sales', {
      method: editingSaleId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Failed to save sale');
        }
        return body;
      })
      .then(() => {
        const successText = editingSaleId ? 'Sale entry updated successfully.' : 'Sale entry created successfully.';
        resetForm();
        setSuccessMessage(successText);
        fetchSales(salesQuery);
        fetchMedicines(medicineQuery);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
      <div className="rounded-2xl border border-[#dce8fa] bg-gradient-to-b from-white to-[#f8fbff] shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Sales Entry</h3>
            <p className="text-sm text-slate-500">Create or modify sale and adjust stock from near-expiry lots first.</p>
          </div>
          <div className="flex items-center gap-2">
            {editingSaleId ? <span className="text-xs rounded bg-[#eaf2ff] text-[#2d7ff9] px-2 py-1">Editing #{editingSaleId}</span> : null}
            <button type="button" onClick={resetForm} className="text-xs rounded-lg border border-[#d7e6ff] bg-white px-3 py-1.5">
              New Entry
            </button>
            <button
              type="button"
              onClick={saveSale}
              disabled={saving}
              className="text-xs rounded-lg bg-[#2d7ff9] text-white px-3 py-1.5 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingSaleId ? 'Update Sale' : 'Save Sale'}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs text-slate-700">Invoice No
            <input
              value={invoiceNo}
              readOnly
              placeholder="Auto-generated (A000001...)"
              className="mt-1 w-full border border-[#d8e6fa] bg-slate-50 text-slate-600 rounded-lg px-2.5 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-slate-500">Assigned automatically on new sale.</span>
          </label>
          <label className="text-xs text-slate-700">Sale Date
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-700 sm:col-span-1">Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note"
              className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[#dce8fa] bg-white p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Patient</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
            <label className="text-xs text-slate-700">Existing Patient
              <input
                value={patientLookup}
                list="sales-patient-options"
                onChange={(e) => {
                  const value = e.target.value;
                  setPatientLookup(value);
                  fetchPatients(value);
                  const matched = patientRows.find((row) => patientOptionLabel(row).toLowerCase() === value.trim().toLowerCase());
                  if (matched) {
                    setSelectedPatientId(matched.id);
                    setShowNewPatientForm(false);
                    setPatientName('');
                    setPatientPhone('');
                    setPatientAge('');
                    setPatientGender('');
                    setPatientAddress('');
                    return;
                  }
                  setSelectedPatientId('');
                }}
                placeholder="Type name or phone and select"
                className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs"
              />
              <datalist id="sales-patient-options">
                {patientRows.map((patient) => (
                  <option key={patient.id} value={patientOptionLabel(patient)} />
                ))}
              </datalist>
            </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewPatientForm((prev) => {
                  const next = !prev;
                  if (next) {
                    setSelectedPatientId('');
                    setPatientName('');
                    setPatientPhone('');
                    setPatientAge('');
                    setPatientGender('');
                    setPatientAddress('');
                  }
                  return next;
                });
              }}
              className={`h-[31px] min-w-[31px] rounded-lg border text-sm font-semibold ${
                showNewPatientForm
                  ? 'border-[#2d7ff9] bg-[#2d7ff9] text-white'
                  : 'border-[#d7e6ff] bg-white text-[#2d7ff9]'
              }`}
              title="Add new patient"
            >
              +
            </button>
          </div>
          {showNewPatientForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <label className="text-xs text-slate-700 sm:col-span-2">Patient Name
                <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Phone
                <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Age
                <input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Gender
                <input value={patientGender} onChange={(e) => setPatientGender(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700 sm:col-span-5">Address
                <input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#dce8fa] bg-white p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Doctor (Referrer)</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
            <label className="text-xs text-slate-700">Existing Doctor
              <input
                value={doctorLookup}
                list="sales-doctor-options"
                onChange={(e) => {
                  const value = e.target.value;
                  setDoctorLookup(value);
                  fetchDoctors(value);
                  const matched = doctorRows.find((row) => doctorOptionLabel(row).toLowerCase() === value.trim().toLowerCase());
                  if (matched) {
                    setSelectedDoctorId(matched.id);
                    setShowNewDoctorForm(false);
                    setDoctorName('');
                    setDoctorPhone('');
                    setDoctorRegNo('');
                    setDoctorSpecialization('');
                    return;
                  }
                  setSelectedDoctorId('');
                }}
                placeholder="Type name, reg no, phone, specialization"
                className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs"
              />
              <datalist id="sales-doctor-options">
                {doctorRows.map((doctor) => (
                  <option key={doctor.id} value={doctorOptionLabel(doctor)} />
                ))}
              </datalist>
            </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewDoctorForm((prev) => {
                  const next = !prev;
                  if (next) {
                    setSelectedDoctorId('');
                    setDoctorName('');
                    setDoctorPhone('');
                    setDoctorRegNo('');
                    setDoctorSpecialization('');
                  }
                  return next;
                });
              }}
              className={`h-[31px] min-w-[31px] rounded-lg border text-sm font-semibold ${
                showNewDoctorForm
                  ? 'border-[#2d7ff9] bg-[#2d7ff9] text-white'
                  : 'border-[#d7e6ff] bg-white text-[#2d7ff9]'
              }`}
              title="Add new doctor"
            >
              +
            </button>
          </div>
          {showNewDoctorForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <label className="text-xs text-slate-700">Doctor Name
                <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Phone
                <input value={doctorPhone} onChange={(e) => setDoctorPhone(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Reg No
                <input value={doctorRegNo} onChange={(e) => setDoctorRegNo(e.target.value)} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs text-slate-700">Specialization
                <input
                  value={doctorSpecialization}
                  onChange={(e) => setDoctorSpecialization(e.target.value)}
                  className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2 py-1.5 text-xs"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#dce8fa] bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-700">Sale Items</p>
            <input
              value={medicineQuery}
              onChange={(e) => setMedicineQuery(e.target.value)}
              placeholder="Search medicine..."
              className="border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {medicinesLoading ? <p className="text-sm text-slate-500">Loading medicines...</p> : null}
          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {items.map((item, index) => {
              const rowPackSize = resolvePackSize(item);
              const rowPackFromMetadata = resolvePackSizeFromMetadata(item);
              const rowPackNeedsInput = rowPackFromMetadata == null;
              const rowPackMissing = rowPackNeedsInput && toSafeInt(Number(item.pack_size_override || 0)) <= 0;
              const rowUoms = resolveUomLabels(item);
              const packQtyLabel = rowPackSize > 1 ? rowUoms.packUom : 'PACK';
              const baseQtyLabel = rowUoms.baseUom;
              return (
              <div
                key={item.key}
                className={`rounded-lg border p-2 bg-white ${
                  rowPackMissing ? 'border-red-300 bg-red-50/40' : 'border-[#d9e7fb]'
                }`}
              >
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                  <label className="text-[11px] text-slate-600 md:col-span-3">Medicine
                    <select
                      value={item.medicine_id}
                      onChange={(e) => {
                        const medicineId = Number(e.target.value || 0);
                        if (!medicineId) {
                          setItems((prev) => prev.map((row, idx) => (idx === index ? emptyItem() : row)));
                          return;
                        }
                        applyMedicineSelection(index, medicineId).catch((err: Error) => setError(err.message));
                      }}
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">Select</option>
                      {medicineRows.map((medicine) => (
                        <option key={medicine.id} value={medicine.id}>
                          {medicine.name} {medicine.brand ? `• ${medicine.brand}` : ''} • {medicine.stock_display || medicine.stock || 0}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[11px] text-slate-600">{packQtyLabel}
                    <input
                      type="number"
                      value={item.strips}
                      min={0}
                      onChange={(e) => updateItemSplit(index, Number(e.target.value || 0), item.units)}
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    />
                  </label>

                  <label className="text-[11px] text-slate-600">{baseQtyLabel}
                    <input
                      type="number"
                      value={item.units}
                      min={0}
                      max={rowPackSize > 1 ? rowPackSize - 1 : undefined}
                      onChange={(e) => updateItemSplit(index, item.strips, Number(e.target.value || 0))}
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    />
                  </label>

                  <label className="text-[11px] text-slate-600">Pack
                    <input
                      type="number"
                      value={item.pack_size_override}
                      min={1}
                      disabled={!rowPackNeedsInput}
                      placeholder={rowPackNeedsInput ? 'size' : String(rowPackSize)}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        updatePackSizeOverride(index, value ? Number(value) : '');
                      }}
                      className={`mt-1 w-full rounded-md px-2 py-1.5 text-xs border ${
                        rowPackMissing
                          ? 'border-red-300 bg-red-50 text-red-900'
                          : rowPackNeedsInput
                            ? 'border-[#d8e6fa] bg-white text-slate-700'
                            : 'border-[#d8e6fa] bg-slate-50 text-slate-500'
                      }`}
                    />
                  </label>

                  <label className="text-[11px] text-slate-600 md:col-span-2">Batch
                    <select
                      value={item.selected_batch}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, selected_batch: e.target.value } : row))
                        )
                      }
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="">Auto</option>
                      {item.lots.map((lot) => {
                        const lotBatch = String(lot.batch || '').trim();
                        const lotLabel = lotBatch || `Lot #${lot.id}`;
                        return (
                          <option key={`${lot.id}-${lotLabel}`} value={lotBatch}>
                            {lotLabel} • {lot.expiry || '-'} • {lot.available_display || lot.available_qty || 0}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="text-[11px] text-slate-600">{packQtyLabel} ₹
                    <input
                      type="number"
                      value={item.strip_price}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, strip_price: Number(e.target.value || 0) } : row))
                        )
                      }
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    />
                  </label>

                  <label className="text-[11px] text-slate-600">Dis %
                    <input
                      type="number"
                      value={item.discount_percent}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, discount_percent: Number(e.target.value || 0) } : row))
                        )
                      }
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    />
                  </label>

                  <label className="text-[11px] text-slate-600">GST %
                    <input
                      type="number"
                      value={item.gst_percent}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, gst_percent: Number(e.target.value || 0) } : row))
                        )
                      }
                      className="mt-1 w-full border border-[#d8e6fa] rounded-md px-2 py-1.5 text-xs bg-white"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => {
                        if (prev.length <= 1) {
                          return [emptyItem()];
                        }
                        return prev.filter((_, idx) => idx !== index);
                      })
                    }
                    className="h-8 w-8 md:ml-auto rounded-md border border-red-300 bg-red-50 text-red-700 text-base leading-none"
                    title={items.length <= 1 ? 'Clear row' : 'Remove row'}
                  >
                    -
                  </button>
                </div>
                {rowPackMissing ? <p className="mt-1 text-[11px] text-red-700">Enter pack size for this item.</p> : null}
                {index === items.length - 1 ? (
                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => {
                          const next = [...prev];
                          next.splice(index + 1, 0, emptyItem());
                          return next;
                        })
                      }
                      className="h-7 w-7 rounded-full border border-[#cfe0ff] bg-[#f4f8ff] text-[#2d7ff9] text-lg leading-none font-semibold"
                      title="Add row below"
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            )})}
          </div>
        </div>

        <div className="rounded-xl border border-[#dce8fa] bg-[#f8fbff] p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-xs text-slate-500">Subtotal</p>
            <p className="font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Discount</p>
            <p className="font-semibold text-slate-800">{formatCurrency(totals.discount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tax</p>
            <p className="font-semibold text-slate-800">{formatCurrency(totals.tax)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Grand Total</p>
            <p className="font-semibold text-[#0b5ed7]">{formatCurrency(totals.grand)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#dce8fa] bg-white shadow-sm p-4 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Recent Sales</h3>
          <p className="text-sm text-slate-500">Select an entry to edit and resave.</p>
        </div>
        <input
          value={salesQuery}
          onChange={(e) => setSalesQuery(e.target.value)}
          placeholder="Search invoice, patient, doctor"
          className="w-full border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
        />
        {salesLoading ? (
          <p className="text-sm text-slate-500">Loading sales...</p>
        ) : salesRows.length === 0 ? (
          <p className="text-sm text-slate-500">No sale entries found.</p>
        ) : (
          <div className="space-y-2 max-h-[72vh] overflow-auto pr-1">
            {salesRows.map((sale) => (
              <button
                key={sale.id}
                type="button"
                onClick={() => loadSaleForEdit(sale.id)}
                className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                  editingSaleId === sale.id ? 'border-[#2d7ff9] bg-[#eef5ff]' : 'border-[#e2ecfb] bg-[#fafcff] hover:bg-[#f2f7ff]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{sale.invoice_no || `Sale #${sale.id}`}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(sale.grand_total)}</p>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Patient: <strong>{sale.patient_name || '-'}</strong> • Doctor: <strong>{sale.doctor_name || '-'}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {sale.sale_date || '-'} • Qty {sale.total_qty ?? 0} • Updated {formatDate(sale.updated_at || sale.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
