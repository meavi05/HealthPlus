/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import AppHeader from './components/AppHeader';
import ProductGrid from './components/ProductGrid';
import OrdersModal from './components/OrdersModal';
import CartModal from './components/CartModal';
import ProfileModal from './components/ProfileModal';
import MyHealthModal from './components/MyHealthModal';
import AdminPanel from './components/AdminPanel';

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
  role?: 'ROLE_ADMIN' | 'ROLE_USER';
}


interface OrderItem {
  id: number;
  medicineName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  userId: number;
  totalPrice: number;
  status?: string;
  createdAt?: string;
  paymentStatus?: string;
  transactionRef?: string;
  items: OrderItem[];
}

interface RegisteredPaymentMethod {
  id: number;
  provider: 'gpay' | 'phonepe';
}

interface Suggestion {
  id: number;
  name: string;
}

interface MedicineRoutine {
  id?: number;
  medicine_name: string;
  last_taken_date: string;
  next_due_date: string;
  status?: string;
}

interface PurchasedMedicine {
  medicine_id: number;
  medicine_name: string;
  last_purchased_at: string;
  purchase_count: number;
}

export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(8);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderActionId, setOrderActionId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'gpay' | 'phonepe'>('gpay');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<RegisteredPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [isRegisteringPaymentMethod, setIsRegisteringPaymentMethod] = useState(false);
  const [paymentRegistrationError, setPaymentRegistrationError] = useState<string | null>(null);
  const [location, setLocation] = useState('Delhi 110001');
  const [activeTab, setActiveTab] = useState('Medicines');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [showMyHealthModal, setShowMyHealthModal] = useState(false);
  const [isUploadingPrescription, setIsUploadingPrescription] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [myHealthSection, setMyHealthSection] = useState<'prescription' | 'routine'>('prescription');
  const [routines, setRoutines] = useState<MedicineRoutine[]>([]);
  const [purchasedMedicines, setPurchasedMedicines] = useState<PurchasedMedicine[]>([]);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [activeView, setActiveView] = useState<'store' | 'admin'>('store');

  const cartStorageKey = useMemo(() => (user ? `cart_${user.id}` : 'cart_guest'), [user]);

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


  useEffect(() => {
    const syncView = () => {
      setActiveView(window.location.hash === '#/admin' ? 'admin' : 'store');
    };
    syncView();
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  const fetchOrders = () => {
    setShowOrders(true);

    if (!user) {
      setOrders([]);
      setOrdersError('Please log in to view your orders.');
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    fetch('/api/orders/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Unable to load orders right now.');
        }
        return res.json();
      })
      .then((data) => {
        const normalizedOrders: Order[] = Array.isArray(data)
          ? data.map((order: any) => ({
              id: Number(order.id),
              userId: Number(order.userId ?? order.user_id ?? user?.id ?? 0),
              totalPrice: Number(order.totalPrice ?? order.total_price ?? 0),
              status: order.status,
              createdAt: order.createdAt ?? order.created_at,
              paymentStatus: order.paymentStatus ?? order.payment_status,
              transactionRef: order.transactionRef ?? order.transaction_ref,
              items: Array.isArray(order.items)
                ? order.items.map((item: any) => ({
                    id: Number(item.id),
                    medicineName: item.medicineName ?? item.medicine_name ?? 'Medicine',
                    quantity: Number(item.quantity ?? 0),
                    price: Number(item.price ?? 0),
                  }))
                : [],
            }))
          : [];
        setOrders(normalizedOrders);
      })
      .catch(() => {
        setOrders([]);
        setOrdersError('Unable to load orders right now. Please try again.');
      })
      .finally(() => setOrdersLoading(false));
  };


  const cancelOrder = (orderId: number) => {
    if (!user || typeof user.id !== 'number') return;

    setOrderActionId(orderId);
    setOrdersError(null);

    fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to cancel order');
        }
      })
      .then(() => fetchOrders())
      .catch((error: Error) => setOrdersError(error.message || 'Unable to cancel order'))
      .finally(() => setOrderActionId(null));
  };

  const refundOrder = (orderId: number) => {
    if (!user || typeof user.id !== 'number') return;

    setOrderActionId(orderId);
    setOrdersError(null);

    fetch(`/api/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to refund order');
        }
      })
      .then(() => fetchOrders())
      .catch((error: Error) => setOrdersError(error.message || 'Unable to refund order'))
      .finally(() => setOrderActionId(null));
  };

  const fetchProfile = () => {
    if (!user) return alert('Please log in to view profile');
    setShowProfile(true);
  };

  useEffect(() => {
    const savedCart = localStorage.getItem(cartStorageKey);
    setCart(savedCart ? JSON.parse(savedCart) : []);
  }, [cartStorageKey]);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

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


  const loadPaymentMethods = () => {
    if (!user || typeof user.id !== 'number') {
      setPaymentMethods([]);
      return;
    }

    setIsLoadingPaymentMethods(true);
    fetch('/api/users/me/payment-methods')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPaymentMethods(Array.isArray(data) ? data : []))
      .catch(() => setPaymentMethods([]))
      .finally(() => setIsLoadingPaymentMethods(false));
  };

  const registerPaymentMethod = (provider: 'gpay' | 'phonepe', upiId: string) => {
    if (!user || typeof user.id !== 'number') {
      setPaymentRegistrationError('Please log in to register payment options.');
      return;
    }

    setPaymentRegistrationError(null);
    setIsRegisteringPaymentMethod(true);

    fetch('/api/users/me/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, upi_vpa: upiId.trim() }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to register payment method');
        }
      })
      .then(() => {
        setPaymentMethod(provider);
        loadPaymentMethods();
      })
      .catch((error: Error) => setPaymentRegistrationError(error.message))
      .finally(() => setIsRegisteringPaymentMethod(false));
  };

  const placeOrder = () => {
    if (!user) {
      setOrderError('Please log in to place an order.');
      return;
    }

    if (typeof user.id !== 'number') {
      setOrderError('Order placement requires a linked account. Please re-login and try again.');
      return;
    }

    if (cart.length === 0) {
      setOrderError('Your cart is empty. Add medicines to continue.');
      return;
    }

    const isRegistered = paymentMethods.some((method) => method.provider === paymentMethod);
    if (!isRegistered) {
      setOrderError(`Please register ${paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'} before payment.`);
      return;
    }

    setIsPlacingOrder(true);
    setOrderError(null);

    fetch('/api/payments/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: paymentMethod,
        amount: totalPrice,
      }),
    })
      .then(async (intentRes) => {
        if (!intentRes.ok) {
          const body = await intentRes.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to create payment intent');
        }
        return intentRes.json();
      })
      .then((intent) => {
        setPaymentIntentId(Number(intent.id));
        return fetch(`/api/payments/intents/${intent.id}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'authorized', transaction_ref: intent.transaction_ref }),
        }).then(async (callbackRes) => {
          if (!callbackRes.ok) {
            const body = await callbackRes.json().catch(() => ({}));
            throw new Error(body.message || 'Payment authorization failed');
          }
          return intent;
        });
      })
      .then((intent) => {
        return fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method: paymentMethod,
            payment_intent_id: intent.id,
            items: cart.map((item) => ({ medicine_id: item.id, quantity: item.quantity, price: item.price })),
            total_price: totalPrice,
          }),
        });
      })
      .then(async (orderRes) => {
        if (!orderRes.ok) {
          const body = await orderRes.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to place order');
        }
        return orderRes.json();
      })
      .then(() => {
        setCart([]);
        setShowCart(false);
        setPaymentIntentId(null);
        setOrderError(null);
        alert(`Order placed successfully via ${paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'}!`);
      })
      .catch((error: Error) => {
        setOrderError(error.message || 'Failed to place order. Please try again.');
      })
      .finally(() => setIsPlacingOrder(false));
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

    fetch('/api/users/me', {
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

  useEffect(() => {
    if (showCart) {
      loadPaymentMethods();
    }
  }, [showCart, user]);

  useEffect(() => {
    if (activeView === 'admin' && user?.role !== 'ROLE_ADMIN') {
      window.location.hash = '/';
    }
  }, [activeView, user]);

  const loadRoutines = () => {
    if (!user || typeof user.id !== 'number') {
      setRoutines([]);
      return;
    }

    fetch('/api/my-health/routines')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to load routines');
        }
        return res.json();
      })
      .then((data) => setRoutines(Array.isArray(data) ? data : []))
      .catch((error: Error) => setRoutineError(error.message || 'Unable to load routines'));
  };

  const loadPurchasedMedicines = () => {
    if (!user || typeof user.id !== 'number') {
      setPurchasedMedicines([]);
      return;
    }

    fetch('/api/my-health/medicines')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to load purchased medicines');
        }
        return res.json();
      })
      .then((data) => setPurchasedMedicines(Array.isArray(data) ? data : []))
      .catch((error: Error) => setRoutineError(error.message || 'Unable to load purchased medicines'));
  };

  const openMyHealth = (section: 'prescription' | 'routine') => {
    if (!user || typeof user.id !== 'number') {
      setShowLogin(true);
      return;
    }

    setMyHealthSection(section);
    setPrescriptionError(null);
    setRoutineError(null);
    setShowMyHealthModal(true);

    if (section === 'routine') {
      loadRoutines();
      loadPurchasedMedicines();
    }
  };

  const uploadPrescription = (files: File[]) => {
    if (!user || typeof user.id !== 'number') {
      setPrescriptionError('Please log in to upload a prescription.');
      return;
    }

    setIsUploadingPrescription(true);
    setPrescriptionError(null);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    fetch('/api/my-health/prescriptions/upload', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to upload prescription');
        }
      })
      .then(() => {
        alert('Prescription uploaded successfully.');
      })
      .catch((error: Error) => {
        setPrescriptionError(error.message || 'Unable to upload prescription');
      })
      .finally(() => setIsUploadingPrescription(false));
  };

  const createRoutine = ({ medicineName, lastTakenDate }: { medicineName: string; lastTakenDate: string }) => {
    if (!user || typeof user.id !== 'number') {
      setRoutineError('Please log in to manage medicine routine.');
      return;
    }

    setIsSavingRoutine(true);
    setRoutineError(null);

    fetch('/api/my-health/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicine_name: medicineName,
        last_taken_date: lastTakenDate,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to save routine');
        }
      })
      .then(() => {
        loadRoutines();
        loadPurchasedMedicines();
      })
      .catch((error: Error) => setRoutineError(error.message || 'Unable to save routine'))
      .finally(() => setIsSavingRoutine(false));
  };

  const openAdmin = () => {
    if (user?.role === 'ROLE_ADMIN') {
      window.location.hash = '/admin';
      return;
    }
    alert('Admin access required');
  };

  const openStore = () => {
    window.location.hash = '/';
  };

  const openMedicineDetails = (medicineId: number) => {
    fetch(`/api/medicines/${medicineId}`)
      .then((res) => res.json())
      .then((data) => setSelectedMedicine(data))
      .catch(() => setSelectedMedicine(medicines.find((m) => m.id === medicineId) || null));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] via-white to-[#f7fbff]">
      <AppHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        user={user}
        totalItems={totalItems}
        onFetchOrders={fetchOrders}
        onMyHealthSelect={openMyHealth}
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
        onOpenAdmin={openAdmin}
      />


      {activeView === 'admin' ? (
        <>
          <section className="max-w-7xl mx-auto px-4 pt-2 pb-4">
            <div className="bg-white border border-[#dfeafb] rounded-3xl p-4 md:p-5 shadow-sm flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Administrator zone</p>
                <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Control center</h2>
              </div>
              <button type="button" onClick={openStore} className="px-3 py-2 rounded-lg bg-[#edf4ff] text-[#2365d1]">Back to Store</button>
            </div>
          </section>
          <AdminPanel show={true} />
        </>
      ) : (
      <>
      <section className="max-w-7xl mx-auto px-4 pt-2 pb-4">
        <div className="bg-white border border-[#dfeafb] rounded-3xl p-4 md:p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Healthcare companion</p>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Your daily care, beautifully organized.</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-[#edf4ff] text-[#2d7ff9]">Smart search</span>
            <span className="px-3 py-1.5 rounded-full bg-[#edf4ff] text-[#2d7ff9]">Quick refill</span>
            <span className="px-3 py-1.5 rounded-full bg-[#edf4ff] text-[#2d7ff9]">Order tracking</span>
          </div>
        </div>
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

      <OrdersModal
        show={showOrders}
        orders={orders}
        loading={ordersLoading}
        error={ordersError}
        actionOrderId={orderActionId}
        onClose={() => {
          setShowOrders(false);
          setOrdersError(null);
        }}
        onCancelOrder={cancelOrder}
        onRefundOrder={refundOrder}
      />

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
        paymentMethod={paymentMethod}
        isPlacingOrder={isPlacingOrder}
        orderError={orderError}
        isPaymentMethodRegistered={paymentMethods.some((method) => method.provider === paymentMethod)}
        isLoadingPaymentMethods={isLoadingPaymentMethods}
        isRegisteringPaymentMethod={isRegisteringPaymentMethod}
        paymentRegistrationError={paymentRegistrationError}
        onClose={() => {
          setShowCart(false);
          setOrderError(null);
          setPaymentIntentId(null);
          setPaymentRegistrationError(null);
        }}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onPaymentMethodChange={setPaymentMethod}
        onRegisterPaymentMethod={registerPaymentMethod}
        onPlaceOrder={placeOrder}
      />


      <MyHealthModal
        show={showMyHealthModal}
        activeSection={myHealthSection}
        isUploadingPrescription={isUploadingPrescription}
        prescriptionError={prescriptionError}
        routines={routines}
        purchasedMedicines={purchasedMedicines}
        routineError={routineError}
        isSavingRoutine={isSavingRoutine}
        onClose={() => {
          setShowMyHealthModal(false);
          setPrescriptionError(null);
          setRoutineError(null);
        }}
        onUploadPrescription={uploadPrescription}
        onCreateRoutine={createRoutine}
      />

      <ProfileModal show={showProfile} user={user} onClose={() => setShowProfile(false)} onSave={updateProfile} />
      </>
      )}
    </div>
  );
}
