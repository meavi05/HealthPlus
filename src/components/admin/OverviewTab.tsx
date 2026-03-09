import { PrescriptionRow } from './types';
import { formatCurrency } from './utils';

interface OverviewTabProps {
  users: any[];
  orders: any[];
  prescriptions: PrescriptionRow[];
  onUpdatePrescriptionStatus: (id: number, status: string) => void;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

export default function OverviewTab({ users, orders, prescriptions, onUpdatePrescriptionStatus }: OverviewTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Total Users" value={users.length} />
        <MetricCard label="Total Orders" value={orders.length} />
        <MetricCard label="Pending Rx" value={prescriptions.filter((p) => p.status !== 'approved' && p.status !== 'rejected').length} />
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
          <h3 className="font-semibold mb-3">Orders</h3>
          <ul className="space-y-2 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="border rounded p-2">
                <p className="font-medium">Order #{order.id} — {formatCurrency(order.total_price)}</p>
                <p className="text-slate-500">{order.user_email} • {order.status} • {order.payment_status}</p>
              </li>
            ))}
          </ul>
        </div>
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
                <button type="button" onClick={() => onUpdatePrescriptionStatus(prescription.id, 'in_review')} className="px-2 py-1 text-xs border rounded">In Review</button>
                <button type="button" onClick={() => onUpdatePrescriptionStatus(prescription.id, 'approved')} className="px-2 py-1 text-xs border rounded text-green-700">Approve</button>
                <button type="button" onClick={() => onUpdatePrescriptionStatus(prescription.id, 'rejected')} className="px-2 py-1 text-xs border rounded text-red-700">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
