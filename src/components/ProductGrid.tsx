import { useState } from 'react';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
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
}: ProductGridProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleCardClick = (medicine: Medicine) => {
    console.log('Clicked:', medicine.name);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h3 className="text-xl font-semibold mb-6">Popular Medicines</h3>
      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading medicines...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {medicines.map((medicine) => (
              <div
                key={medicine.id}
                className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all cursor-pointer ${hoveredId === medicine.id ? 'shadow-lg scale-105' : 'hover:shadow-md'}`}
                onClick={() => handleCardClick(medicine)}
                onMouseEnter={() => setHoveredId(medicine.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  <img
                    src={`https://picsum.photos/seed/${medicine.name}/400/300`}
                    alt={medicine.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h4 className="text-lg font-medium text-gray-900">{medicine.name}</h4>
                <p className="text-sm text-gray-500 mt-1">{medicine.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-lg font-bold text-gray-900">${medicine.price}</p>
                  <button
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
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
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {currentPage} of {Math.ceil(totalMedicines / limit)}</span>
            <button
              onClick={onNextPage}
              disabled={currentPage === Math.ceil(totalMedicines / limit)}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
