/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import AppHeader from './components/AppHeader';
import ProductGrid from './components/ProductGrid';
import OrdersModal from './components/OrdersModal';
import CartModal from './components/CartModal';
import ProfileModal from './components/ProfileModal';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  brand?: string;
  category?: string;
  mrp?: number;
  discount_percent?: number;
  requires_prescription?: boolean;
  rating?: number;
  image_url?: string;
  delivery_eta?: string;
}

interface CartItem extends Medicine {
  quantity: number;
}

interface ProfileUser {
  id: number | string;
  name: string;
  email?: string;
  profile_picture?: string;
}


interface Suggestion {
  id: number;
  name: string;
}

export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(8);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [location, setLocation] = useState('Delhi 110001');
  const [activeTab, setActiveTab] = useState('Medicines');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/medicines?page=${currentPage}&limit=${limit}`)
      .then((res) => res.json())
      .then((data) => {
        setMedicines(data.medicines);
        setTotalMedicines(data.total);
        setIsLoading(false);
      });
  }, [currentPage, limit]);

  useEffect(() => {
    fetch('/api/medicines/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.map((item: { name: string }) => item.name).slice(0, 8)))
      .catch(() => setCategories(['Fever', 'Diabetes', 'Cardiac', 'Wellness']));

    fetch('/api/medicines/brands')
      .then((res) => res.json())
      .then((data) => setBrands(data.map((item: { name: string }) => item.name).slice(0, 6)))
      .catch(() => setBrands(['Dolo', 'Cipla', 'Sun Pharma', 'Himalaya']));
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      fetch(`/api/medicines/suggest?q=${encodeURIComponent(searchTerm)}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data || []))
        .catch(() => setSuggestions([]));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const filteredMedicines = medicines.filter((medicine) =>
    medicine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchOrders = () => {
    if (!user) return alert('Please log in to view orders');
    fetch(`/api/orders/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setShowOrders(true);
      });
  };

  const fetchProfile = () => {
    if (!user) return alert('Please log in to view profile');
    setShowProfile(true);
  };

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (medicine: Medicine) => {
    setAddingToCart(medicine.id);
    setTimeout(() => {
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === medicine.id);
        if (existingItem) {
          return prevCart.map((item) =>
            item.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prevCart, { ...medicine, quantity: 1 }];
      });
      setAddingToCart(null);
    }, 300);
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      setCart((prevCart) =>
        prevCart.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const removeFromCart = (id: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = () => {
    if (!user) return alert('Please log in to place an order');
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        items: cart.map((item) => ({ medicine_id: item.id, quantity: item.quantity, price: item.price })),
        total_price: totalPrice,
      }),
    }).then((res) => {
      if (res.ok) {
        setCart([]);
        setShowCart(false);
        alert('Order placed successfully!');
      } else {
        alert('Failed to place order');
      }
    });
  };

  const updateProfile = (updatedUser: ProfileUser) => {
    if (!user) return;

    // OAuth-only identities (e.g., Google sub) may not map to numeric local DB users.
    if (typeof user.id !== 'number') {
      setUser(updatedUser);
      setShowProfile(false);
      alert('Profile updated locally for this session.');
      return;
    }

    fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).then((res) => {
      if (res.ok) {
        setUser(updatedUser);
        setShowProfile(false);
        alert('Profile updated!');
      } else {
        alert('Failed to update profile');
      }
    });
  };

  const openMedicineDetails = (medicineId: number) => {
    fetch(`/api/medicines/${medicineId}`)
      .then((res) => res.json())
      .then((data) => setSelectedMedicine(data))
      .catch(() => setSelectedMedicine(medicines.find((m) => m.id === medicineId) || null));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        user={user}
        totalItems={totalItems}
        onFetchOrders={fetchOrders}
        onFetchProfile={fetchProfile}
        onOpenLogin={() => setShowLogin(true)}
        onOpenCart={() => setShowCart(true)}
        location={location}
        onLocationChange={setLocation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        suggestions={suggestions}
        onSuggestionSelect={(value) => {
          setSearchTerm(value);
          setSuggestions([]);
        }}
      />

      <section className="bg-gradient-to-r from-teal-50 to-emerald-50 py-10 border-b border-teal-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-3">India&apos;s Trusted Digital Pharmacy Experience</h2>
          <p className="text-gray-600">Medicines • Lab Tests • Doctor Consultations • Health Products</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h4 className="font-semibold mb-2">Popular Categories</h4>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="text-xs bg-gray-100 px-2 py-1 rounded-full">{category}</span>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h4 className="font-semibold mb-2">Top Brands</h4>
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => (
              <span key={brand} className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full">{brand}</span>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h4 className="font-semibold mb-2">Daily Offers</h4>
          <p className="text-sm text-gray-600">Save up to 25% on selected brands. Free delivery above ₹499.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-2 grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white rounded-lg border p-3">✅ Genuine products from licensed pharmacies</div>
        <div className="bg-white rounded-lg border p-3">🚚 Fast delivery in major cities</div>
        <div className="bg-white rounded-lg border p-3">🧪 Book lab tests and track reports</div>
      </section>

      <ProductGrid
        medicines={filteredMedicines}
        isLoading={isLoading}
        currentPage={currentPage}
        totalMedicines={totalMedicines}
        limit={limit}
        onPreviousPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(totalMedicines / limit)))}
        onAddToCart={addToCart}
        addingToCart={addingToCart}
        onViewDetails={openMedicineDetails}
      />

      <OrdersModal show={showOrders} orders={orders} onClose={() => setShowOrders(false)} />

      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full mx-4 relative">
            <button type="button" onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close login">
              <X size={20} />
            </button>
            <h3 className="text-xl font-semibold mb-4">Login / Register</h3>
            <div className="flex flex-col gap-4">
              <a href="/api/auth/google" className="bg-red-500 text-white py-2 rounded-lg text-center">Login with Google</a>
              <a href="/api/auth/facebook" className="bg-blue-600 text-white py-2 rounded-lg text-center">Login with Facebook</a>
            </div>
          </div>
        </div>
      )}

      {selectedMedicine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 relative">
            <button type="button" className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={() => setSelectedMedicine(null)} aria-label="Close details">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-semibold">{selectedMedicine.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{selectedMedicine.brand} • {selectedMedicine.category}</p>
            <p className="mt-4 text-gray-700">{selectedMedicine.description}</p>
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div>Price: <strong>₹{selectedMedicine.price}</strong></div>
              <div>MRP: <strong>₹{selectedMedicine.mrp || selectedMedicine.price}</strong></div>
              <div>Rating: <strong>{selectedMedicine.rating || 4.0} / 5</strong></div>
              <div>Delivery: <strong>{selectedMedicine.delivery_eta || 'Tomorrow'}</strong></div>
            </div>
            {selectedMedicine.requires_prescription && (
              <p className="mt-4 text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 text-sm">Prescription required for this medicine.</p>
            )}
          </div>
        </div>
      )}

      <CartModal
        show={showCart}
        cart={cart}
        totalPrice={totalPrice}
        onClose={() => setShowCart(false)}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onPlaceOrder={placeOrder}
      />

      <ProfileModal show={showProfile} user={user} onClose={() => setShowProfile(false)} onSave={updateProfile} />
    </div>
  );
}
