import { useEffect, useState } from 'react';

interface AdminPanelProps {
  show: boolean;
}

interface PrescriptionRow {
  id: number;
  user_email: string;
  status: string;
  created_at: string;
  file_count: number;
}

interface ReceiptStep {
  stage: string;
  status: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ReceiptResult {
  message?: string;
  summary?: Record<string, unknown>;
  steps?: ReceiptStep[];
  rows?: Array<Record<string, unknown>>;
}

export default function AdminPanel({ show }: AdminPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inventoryReceiptFile, setInventoryReceiptFile] = useState<File | null>(null);
  const [inventoryUploadLoading, setInventoryUploadLoading] = useState(false);
  const [inventoryUploadError, setInventoryUploadError] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);

  const load = () => {
    Promise.all([
      fetch('/api/admin/users').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load users')))),
      fetch('/api/admin/orders').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load orders')))),
      fetch('/api/admin/medicines').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load medicines')))),
      fetch('/api/admin/prescriptions').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load prescriptions')))),
    ])
      .then(([usersData, ordersData, medicinesData, prescriptionsData]) => {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setMedicines(Array.isArray(medicinesData) ? medicinesData : []);
        setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (show) load();
  }, [show]);

  const updatePrescriptionStatus = (id: number, status: string) => {
    fetch(`/api/admin/prescriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update prescription');
        load();
      })
      .catch((err: Error) => setError(err.message));
  };

  const uploadInventoryReceipt = () => {
    if (!inventoryReceiptFile) {
      setInventoryUploadError('Please choose a bill receipt file first.');
      return;
    }

    setInventoryUploadLoading(true);
    setInventoryUploadError(null);
    setReceiptResult(null);

    const formData = new FormData();
    formData.append('file', inventoryReceiptFile);

    fetch('/api/admin/inventory/ocr-upload', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Failed to process inventory receipt');
        }
        setReceiptResult(body);
        setInventoryReceiptFile(null);
        load();
      })
      .catch((err: Error) => setInventoryUploadError(err.message))
      .finally(() => setInventoryUploadLoading(false));
  };

  if (!show) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-5 space-y-4">
      <div className="bg-white border border-[#dfeafb] rounded-2xl p-4 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Admin Dashboard</h2>
        <p className="text-sm text-slate-500">Manage users, orders, medicines and review prescriptions.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Inventory Intake via OCR</h3>
        <p className="text-sm text-slate-500">
          Upload a medical agency bill receipt (image/pdf) to OCR rows and insert/update inventory. CSV/TXT is also supported.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="file"
            accept="image/*,.pdf,.csv,.txt"
            onChange={(event) => setInventoryReceiptFile(event.target.files?.[0] || null)}
            className="text-sm"
          />
          <button
            type="button"
            onClick={uploadInventoryReceipt}
            disabled={inventoryUploadLoading}
            className="px-3 py-2 text-sm rounded bg-[#2d7ff9] text-white disabled:opacity-60"
          >
            {inventoryUploadLoading ? 'Processing OCR…' : 'Upload & Process'}
          </button>
        </div>

        {inventoryUploadError && <p className="text-sm text-red-600">{inventoryUploadError}</p>}

        {receiptResult && (
          <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">{receiptResult.message || 'Receipt processed'}</p>

            {Array.isArray(receiptResult.steps) && receiptResult.steps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Step-by-step outcomes</p>
                {receiptResult.steps.map((step, index) => (
                  <div key={`${step.stage}-${index}`} className="rounded border bg-white p-2 text-sm">
                    <p className="font-medium text-slate-700">{step.stage} • {step.status}</p>
                    <p className="text-slate-600">{step.message}</p>
                    {step.details && (
                      <pre className="mt-1 text-xs text-slate-500 overflow-x-auto">{JSON.stringify(step.details, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {receiptResult.summary && (
              <pre className="text-xs text-slate-600 overflow-x-auto">{JSON.stringify(receiptResult.summary, null, 2)}</pre>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 overflow-auto">
          <h3 className="font-semibold mb-3">Users</h3>
          <ul className="space-y-2 text-sm">
            {users.map((user) => (
              <li key={user.id} className="border rounded p-2">
                <p className="font-medium">{user.name || user.email}</p>
                <p className="text-slate-500">{user.email} • {user.role}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border p-4 overflow-auto">
          <h3 className="font-semibold mb-3">Medicines</h3>
          <ul className="space-y-2 text-sm">
            {medicines.map((medicine) => (
              <li key={medicine.id} className="border rounded p-2">
                <p className="font-medium">{medicine.name}</p>
                <p className="text-slate-500">₹{medicine.price} • Stock: {medicine.stock}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 overflow-auto">
        <h3 className="font-semibold mb-3">Orders</h3>
        <ul className="space-y-2 text-sm">
          {orders.map((order) => (
            <li key={order.id} className="border rounded p-2">
              <p className="font-medium">Order #{order.id} — ₹{order.total_price}</p>
              <p className="text-slate-500">{order.user_email} • {order.status} • {order.payment_status}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border p-4 overflow-auto">
        <h3 className="font-semibold mb-3">Prescription Review Queue</h3>
        <ul className="space-y-2 text-sm">
          {prescriptions.map((prescription) => (
            <li key={prescription.id} className="border rounded p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium">Prescription #{prescription.id} ({prescription.file_count} files)</p>
                <p className="text-slate-500">{prescription.user_email} • {prescription.status}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'in_review')} className="px-2 py-1 text-xs border rounded">In Review</button>
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'approved')} className="px-2 py-1 text-xs border rounded text-green-700">Approve</button>
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'rejected')} className="px-2 py-1 text-xs border rounded text-red-700">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
