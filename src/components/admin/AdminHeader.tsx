import { AdminView } from './types';

interface AdminHeaderProps {
  adminView: AdminView;
  onViewChange: (view: AdminView) => void;
}

export default function AdminHeader({ adminView, onViewChange }: AdminHeaderProps) {
  return (
    <div className="bg-white border border-[#dfeafb] rounded-2xl p-4 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-800">Admin Dashboard</h2>
      <p className="text-sm text-slate-500">Manage users, orders, and your inventory item master.</p>
      <div className="mt-4 inline-flex rounded-xl border border-[#d9e6fb] bg-[#f6faff] p-1">
        <button
          type="button"
          onClick={() => onViewChange('overview')}
          className={`px-3 py-1.5 text-sm rounded-lg ${adminView === 'overview' ? 'bg-white border border-[#d5e5ff] text-[#2d7ff9]' : 'text-slate-600'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => onViewChange('item_master')}
          className={`px-3 py-1.5 text-sm rounded-lg ${adminView === 'item_master' ? 'bg-white border border-[#d5e5ff] text-[#2d7ff9]' : 'text-slate-600'}`}
        >
          Item Master
        </button>
      </div>
    </div>
  );
}
