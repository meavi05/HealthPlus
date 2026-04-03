import { useState } from 'react';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  pack?: string;
  stock_display?: string;
  brand?: string;
  category?: string;
  mrp?: number;
  discount_percent?: number;
  requires_prescription?: boolean;
  rating?: number;
  image_url?: string;
  delivery_eta?: string;
}

interface ProductGridProps {
  medicines: Medicine[];
  isLoading: boolean;
  currentPage: number;
  totalMedicines: number;
  limit: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onAddToCart: (medicine: Medicine) => void;
  addingToCart: number | null;
  onViewDetails: (medicineId: number) => void;
}

export default function ProductGrid({
  medicines,
  isLoading,
  currentPage,
  totalMedicines,
  limit,
  onPreviousPage,
  onNextPage,
  onAddToCart,
  addingToCart,
  onViewDetails,
}: ProductGridProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h3 className="text-2xl font-semibold mb-6 text-slate-800">Recommended for you</h3>
      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading medicines...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {medicines.map((medicine) => (
              <div
                key={medicine.id}
                className={`bg-white/95 p-4 rounded-3xl shadow-sm border border-[#e2ecfb] transition-all cursor-pointer ${hoveredId === medicine.id ? 'shadow-lg -translate-y-1' : 'hover:shadow-md'}`}
                onClick={() => onViewDetails(medicine.id)}
                onMouseEnter={() => setHoveredId(medicine.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="h-40 bg-[#eff5ff] rounded-2xl mb-4 flex items-center justify-center overflow-hidden relative">
                  <img
                    src={medicine.image_url || `https://picsum.photos/seed/${medicine.name}/400/300`}
                    alt={medicine.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {medicine.requires_prescription && (
                    <span className="absolute top-2 left-2 text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Rx Required</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{medicine.brand || 'HealthPlus'} • {medicine.category || 'General'}</p>
                <h4 className="text-lg font-semibold text-slate-800 mt-1">{medicine.name}</h4>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{medicine.description}</p>
                <p className="text-xs text-slate-500 mt-1">Stock: {medicine.stock_display || `${medicine.stock || 0}:0 strips`}</p>
                <p className="text-xs text-[#2d7ff9] mt-2">Delivery: {medicine.delivery_eta || 'Tomorrow'}</p>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-lg font-bold text-slate-800">₹{medicine.price.toFixed(2)}</p>
                    {medicine.mrp && medicine.mrp > medicine.price && (
                      <p className="text-xs text-slate-500">
                        <span className="line-through mr-1">₹{medicine.mrp.toFixed(2)}</span>
                        <span className="text-green-700">{medicine.discount_percent || 0}% off</span>
                      </p>
                    )}
                  </div>
                  <button
                    className="bg-[#2d7ff9] text-white px-4 py-2 rounded-full hover:bg-[#1f6fe6] transition-colors disabled:opacity-50"
                    disabled={addingToCart === medicine.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(medicine);
                    }}
                  >
                    {addingToCart === medicine.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={onPreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-[#dce8fb] rounded-full disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {currentPage} of {Math.ceil(totalMedicines / limit)}</span>
            <button
              onClick={onNextPage}
              disabled={currentPage === Math.ceil(totalMedicines / limit)}
              className="px-4 py-2 bg-white border border-[#dce8fb] rounded-full disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
