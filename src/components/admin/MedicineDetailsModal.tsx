import { useEffect, useState } from 'react';
import { MedicineInventoryDetail, MedicineRow } from './types';
import { formatCurrency, formatDate, formatPackSplitStock, toPercent } from './utils';

interface MedicineDetailsModalProps {
  selectedMedicine: MedicineRow | null;
  selectedMedicineDetails: MedicineInventoryDetail[];
  isMedicineDetailsLoading: boolean;
  medicineDetailsError: string | null;
  onSaveInventoryDetail: (
    detailId: number,
    payload: {
      hsn: string;
      manufacturer: string;
      pack: string;
      qty_fr: string;
      medicine_category: string;
      medicine_type: string;
      medicine_description: string;
      medicine_uses: string;
      medicine_doses: string;
      batch: string;
      expiry: string;
      mrp: number;
      rate: number;
      gst: number;
      dis1: number;
      dis2: number;
      amount: number;
      quantity_added: number;
      bonus: number;
      source: string;
    }
  ) => Promise<unknown>;
  onDeleteInventoryDetail: (detailId: number) => Promise<unknown>;
  onDeleteMedicine: (medicineId: number) => Promise<unknown>;
  onClose: () => void;
}

function DetailChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-[#f8fbff] p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#eef5ff] px-2 py-1.5 border border-[#dfebff]">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}

export default function MedicineDetailsModal({
  selectedMedicine,
  selectedMedicineDetails,
  isMedicineDetailsLoading,
  medicineDetailsError,
  onSaveInventoryDetail,
  onDeleteInventoryDetail,
  onDeleteMedicine,
  onClose,
}: MedicineDetailsModalProps) {
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    hsn: '',
    manufacturer: '',
    pack: '',
    qty_fr: '',
    medicine_category: '',
    medicine_type: '',
    medicine_description: '',
    medicine_uses: '',
    medicine_doses: '',
    batch: '',
    expiry: '',
    mrp: '',
    rate: '',
    gst: '',
    dis1: '',
    dis2: '',
    amount: '',
    quantity_added: '',
    bonus: '',
    deal: '',
    source: '',
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingDetailId, setSavingDetailId] = useState<number | null>(null);
  const [deletingDetailId, setDeletingDetailId] = useState<number | null>(null);
  const [deletingMedicine, setDeletingMedicine] = useState(false);
  const latestDetail = selectedMedicineDetails[0];
  const latestMrp = latestDetail?.mrp ?? selectedMedicine?.mrp ?? 0;
  const latestEffective =
    latestDetail?.effective_rate ?? selectedMedicine?.price ?? latestDetail?.rate ?? 0;
  const latestPack = latestDetail?.pack ?? selectedMedicine?.pack ?? '';
  const hasDealBonusQty = (detail: MedicineInventoryDetail) => {
    const dealText = String(detail.deal ?? '').trim();
    const bonusText = String(detail.bonus ?? '').trim();
    const qtyText = String(detail.qty_fr ?? '').trim();
    const bonusNumeric = Number(bonusText.replace(/[^0-9.]/g, ''));
    const hasBonus = bonusText.length > 0 && (Number.isFinite(bonusNumeric) ? bonusNumeric > 0 : /[A-Za-z+\/]/.test(bonusText));
    return dealText.length > 0 || hasBonus || qtyText.includes('+') || qtyText.includes('/');
  };

  useEffect(() => {
    if (!selectedMedicine) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedMedicine]);

  if (!selectedMedicine) return null;

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl border border-[#dce8fa] shadow-xl relative max-h-[92dvh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#e3edf9] px-4 sm:px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800 truncate pr-3">{selectedMedicine.name}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 rounded-md px-2 py-1"
            aria-label="Close medicine details"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92dvh-58px)] px-4 sm:px-5 py-4 sm:py-5 overscroll-contain">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-56 h-44 rounded-xl overflow-hidden bg-[#edf4ff] border">
              <img
                src={selectedMedicine.image_url || `https://picsum.photos/seed/${selectedMedicine.name}/400/300`}
                alt={selectedMedicine.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-slate-800">{selectedMedicine.name}</h4>
              <p className="text-sm text-slate-500 mt-1">
                {selectedMedicine.brand || 'Unspecified'} • {selectedMedicine.category || 'General'}
              </p>
              <p className="text-sm text-slate-600 mt-3">{selectedMedicine.description || 'No description available.'}</p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <DetailChip label="MRP" value={formatCurrency(latestMrp)} />
                <DetailChip label="Effective Price" value={formatCurrency(latestEffective)} />
                <DetailChip label="Stock" value={formatPackSplitStock(selectedMedicine.stock, latestPack)} />
                <DetailChip label="Discount" value={toPercent(selectedMedicine.discount_percent)} />
              </div>
            </div>
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h5 className="text-sm font-semibold text-slate-700">Mapped Inventory Details (Editable)</h5>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Delete this medicine and all mapped inventory rows? This cannot be undone.')) return;
                  setDeletingMedicine(true);
                  onDeleteMedicine(selectedMedicine.id)
                    .catch((error: Error) => setSaveError(error.message || 'Unable to delete medicine'))
                    .finally(() => setDeletingMedicine(false));
                }}
                disabled={deletingMedicine}
                className="text-xs rounded-lg border border-red-300 text-red-700 bg-red-50 px-2.5 py-1 disabled:opacity-60"
              >
                {deletingMedicine ? 'Deleting...' : 'Delete Medicine'}
              </button>
            </div>
            {isMedicineDetailsLoading ? (
              <p className="text-sm text-slate-500">Loading inventory details...</p>
            ) : medicineDetailsError ? (
              <p className="text-sm text-red-600">{medicineDetailsError}</p>
            ) : selectedMedicineDetails.length === 0 ? (
              <p className="text-sm text-slate-500">No mapped inventory details found for this medicine yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <DetailChip label="Entries" value={selectedMedicineDetails.length} />
                  <DetailChip
                    label="Total Qty Added"
                    value={selectedMedicineDetails.reduce((sum, item) => sum + (item.quantity_added || 0), 0)}
                  />
                  <DetailChip
                    label="Total Bonus"
                    value={selectedMedicineDetails.reduce((sum, item) => sum + (item.bonus || 0), 0)}
                  />
                  <DetailChip
                    label="Latest Effective Price"
                    value={formatCurrency(selectedMedicineDetails[0]?.effective_rate ?? selectedMedicineDetails[0]?.rate)}
                  />
                  <DetailChip label="Latest MRP" value={formatCurrency(latestMrp)} />
                </div>

                <div className="space-y-2">
                  {selectedMedicineDetails.map((detail, index) => {
                    const isEditing = editingDetailId === detail.id;
                    const highlighted = hasDealBonusQty(detail);
                    return (
                      <div
                        key={detail.id}
                        className={`rounded-xl border p-3 ${
                          highlighted ? 'border-amber-200 bg-amber-50' : 'bg-gradient-to-r from-[#f8fbff] to-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          Batch {detail.batch || '-'}
                          <span className="text-xs font-normal text-slate-500 ml-2">#{selectedMedicineDetails.length - index}</span>
                        </p>
                          <div className="flex items-center gap-1">
                            {highlighted && (
                              <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-2 py-0.5">Deal/Bonus/QTY</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDetailId(detail.id);
                                setEditForm({
                                  hsn: detail.hsn || '',
                                  manufacturer: detail.manufacturer || '',
                                  pack: detail.pack || '',
                                  qty_fr: detail.qty_fr || '',
                                  medicine_category: detail.medicine_category || selectedMedicine.category || '',
                                  medicine_type: detail.medicine_type || '',
                                  medicine_description: detail.medicine_description || selectedMedicine.description || '',
                                  medicine_uses: detail.medicine_uses || '',
                                  medicine_doses: detail.medicine_doses || '',
                                  batch: detail.batch || '',
                                  expiry: detail.expiry || '',
                                  mrp: String(detail.mrp ?? 0),
                                  rate: String(detail.rate ?? 0),
                                  gst: String(detail.gst ?? 0),
                                  dis1: String(detail.dis1 ?? 0),
                                  dis2: String(detail.dis2 ?? 0),
                                  amount: String(detail.amount ?? 0),
                                  quantity_added: String(detail.quantity_added ?? 0),
                                  bonus: String(detail.bonus ?? 0),
                                  deal: detail.deal || '',
                                  source: detail.source || 'ocr',
                                });
                                setSaveError(null);
                              }}
                              className="text-xs rounded-lg border border-[#c9ddff] bg-white px-2.5 py-1 text-[#1d5fc7]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm('Delete this inventory row from bill and stock?')) return;
                                setDeletingDetailId(detail.id);
                                onDeleteInventoryDetail(detail.id)
                                  .catch((error: Error) => setSaveError(error.message || 'Unable to delete row'))
                                  .finally(() => setDeletingDetailId(null));
                              }}
                              disabled={deletingDetailId === detail.id}
                              className="text-xs rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-red-700 disabled:opacity-60"
                            >
                              {deletingDetailId === detail.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-1">
                          Updated by: <strong>{detail.admin_updated_by_name || detail.admin_updated_by_email || '-'}</strong> • Updated at: <strong>{formatDate(detail.admin_updated_at)}</strong>
                        </p>

                        {isEditing && (
                          <div className="mt-2 rounded-lg border border-[#dce8fa] bg-white p-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className="text-xs text-slate-700">HSN
                                <input value={editForm.hsn} onChange={(e) => setEditForm((s) => ({ ...s, hsn: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Manufacturer
                                <input value={editForm.manufacturer} onChange={(e) => setEditForm((s) => ({ ...s, manufacturer: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Pack
                                <input value={editForm.pack} onChange={(e) => setEditForm((s) => ({ ...s, pack: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Qty+F/R
                                <input value={editForm.qty_fr} onChange={(e) => setEditForm((s) => ({ ...s, qty_fr: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Category
                                <input value={editForm.medicine_category} onChange={(e) => setEditForm((s) => ({ ...s, medicine_category: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Medicine Type (Standard/Ethical or Generic)
                                <input value={editForm.medicine_type} onChange={(e) => setEditForm((s) => ({ ...s, medicine_type: e.target.value }))} placeholder="standard/ethical or generic" className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Batch
                                <input value={editForm.batch} onChange={(e) => setEditForm((s) => ({ ...s, batch: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Expiry
                                <input value={editForm.expiry} onChange={(e) => setEditForm((s) => ({ ...s, expiry: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">MRP
                                <input value={editForm.mrp} onChange={(e) => setEditForm((s) => ({ ...s, mrp: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Effective Price (Rate)
                                <input value={editForm.rate} onChange={(e) => setEditForm((s) => ({ ...s, rate: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">GST (%)
                                <input value={editForm.gst} onChange={(e) => setEditForm((s) => ({ ...s, gst: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Discount 1 (%)
                                <input value={editForm.dis1} onChange={(e) => setEditForm((s) => ({ ...s, dis1: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Discount 2 (%)
                                <input value={editForm.dis2} onChange={(e) => setEditForm((s) => ({ ...s, dis2: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Total Amount
                                <input value={editForm.amount} onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Quantity Added
                                <input value={editForm.quantity_added} onChange={(e) => setEditForm((s) => ({ ...s, quantity_added: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Bonus
                                <input value={editForm.bonus} onChange={(e) => setEditForm((s) => ({ ...s, bonus: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Deal
                                <input value={editForm.deal} onChange={(e) => setEditForm((s) => ({ ...s, deal: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700">Source
                                <input value={editForm.source} onChange={(e) => setEditForm((s) => ({ ...s, source: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs" />
                              </label>
                              <label className="text-xs text-slate-700 sm:col-span-2">Description
                                <textarea value={editForm.medicine_description} onChange={(e) => setEditForm((s) => ({ ...s, medicine_description: e.target.value }))} rows={2} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs resize-y" />
                              </label>
                              <label className="text-xs text-slate-700 sm:col-span-2">Uses
                                <textarea value={editForm.medicine_uses} onChange={(e) => setEditForm((s) => ({ ...s, medicine_uses: e.target.value }))} rows={2} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs resize-y" />
                              </label>
                              <label className="text-xs text-slate-700 sm:col-span-2">Doses (Usually Prescribed by Doctor)
                                <textarea value={editForm.medicine_doses} onChange={(e) => setEditForm((s) => ({ ...s, medicine_doses: e.target.value }))} rows={2} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-xs resize-y" />
                              </label>
                            </div>
                            {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
                            <div className="mt-2 flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingDetailId(null)} className="text-xs rounded-lg border px-2.5 py-1.5">Cancel</button>
                              <button
                                type="button"
                                disabled={savingDetailId === detail.id}
                                onClick={() => {
                                  setSavingDetailId(detail.id);
                                  setSaveError(null);
                                  onSaveInventoryDetail(detail.id, {
                                    hsn: editForm.hsn.trim(),
                                    manufacturer: editForm.manufacturer.trim(),
                                    pack: editForm.pack.trim(),
                                    qty_fr: editForm.qty_fr.trim(),
                                    medicine_category: editForm.medicine_category.trim(),
                                    medicine_type: editForm.medicine_type.trim(),
                                    medicine_description: editForm.medicine_description.trim(),
                                    medicine_uses: editForm.medicine_uses.trim(),
                                    medicine_doses: editForm.medicine_doses.trim(),
                                    batch: editForm.batch.trim(),
                                    expiry: editForm.expiry.trim(),
                                    mrp: Number(editForm.mrp || 0),
                                    rate: Number(editForm.rate || 0),
                                    gst: Number(editForm.gst || 0),
                                    dis1: Number(editForm.dis1 || 0),
                                    dis2: Number(editForm.dis2 || 0),
                                    amount: Number(editForm.amount || 0),
                                    quantity_added: Number(editForm.quantity_added || 0),
                                    bonus: Number(editForm.bonus || 0),
                                    deal: editForm.deal.trim(),
                                    source: editForm.source.trim(),
                                  })
                                    .then(() => setEditingDetailId(null))
                                    .catch((error: Error) => setSaveError(error.message || 'Unable to save changes'))
                                    .finally(() => setSavingDetailId(null));
                                }}
                                className="text-xs rounded-lg bg-[#2d7ff9] text-white px-2.5 py-1.5 disabled:opacity-60"
                              >
                                {savingDetailId === detail.id ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                          <MiniStat label="Exp" value={detail.expiry || '-'} />
                          <MiniStat label="Qty+F/R" value={detail.qty_fr || '-'} />
                          <MiniStat label="Qty Added" value={detail.quantity_added ?? '-'} />
                          <MiniStat label="Bonus" value={detail.bonus ?? 0} />
                          <MiniStat label="Deal" value={detail.deal || '-'} />
                          <MiniStat label="Pack" value={detail.pack || '-'} />
                          <MiniStat label="Category" value={detail.medicine_category || selectedMedicine.category || '-'} />
                          <MiniStat label="Type" value={detail.medicine_type || '-'} />
                          <MiniStat label="HSN" value={detail.hsn || '-'} />
                          <MiniStat label="Mfr" value={detail.manufacturer || '-'} />
                          <MiniStat label="Rate" value={formatCurrency(detail.rate)} />
                          <MiniStat label="GST" value={toPercent(detail.gst)} />
                          <MiniStat label="Effective Price" value={formatCurrency(detail.effective_rate ?? detail.rate)} />
                          <MiniStat label="MRP" value={formatCurrency(detail.mrp)} />
                          <MiniStat label="Dis1" value={toPercent(detail.dis1)} />
                          <MiniStat label="Dis2" value={toPercent(detail.dis2)} />
                          <MiniStat label="Total Amount" value={formatCurrency(detail.amount)} />
                          <MiniStat label="Source" value={detail.source || 'ocr'} />
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg bg-[#eef5ff] px-2 py-1.5 border border-[#dfebff]">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Description</p>
                            <p className="text-slate-700 mt-0.5">{detail.medicine_description || '-'}</p>
                          </div>
                          <div className="rounded-lg bg-[#eef5ff] px-2 py-1.5 border border-[#dfebff]">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Uses</p>
                            <p className="text-slate-700 mt-0.5">{detail.medicine_uses || '-'}</p>
                          </div>
                          <div className="rounded-lg bg-[#eef5ff] px-2 py-1.5 border border-[#dfebff]">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Doses</p>
                            <p className="text-slate-700 mt-0.5">{detail.medicine_doses || '-'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
