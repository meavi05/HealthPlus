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
import CheckoutPage from './components/CheckoutPage';
import ProfileModal from './components/ProfileModal';
import MyHealthModal from './components/MyHealthModal';
import AdminPanel from './components/AdminPanel';

interface Medicine {
  id: number;
  name: string;
  description: string;
  medicine_description?: string;
  medicine_uses?: string;
  medicine_doses?: string;
  price: number;
  stock: number;
  pack?: string;
  stock_display?: string;
  brand?: string;
  category?: string;
  source?: string;
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
  mobile_number?: string;
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

interface DeliveryAddress {
  id?: number;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  isDefault?: boolean;
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
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileName, setMobileName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDebugValue, setOtpDebugValue] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
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
  const [activeView, setActiveView] = useState<'store' | 'admin' | 'checkout'>('store');
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
  });
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState<number | null>(null);
  const [isLoadingDeliveryAddresses, setIsLoadingDeliveryAddresses] = useState(false);
  const [isSavingDeliveryAddress, setIsSavingDeliveryAddress] = useState(false);
  const [deliveryAddressError, setDeliveryAddressError] = useState<string | null>(null);
  const round2 = (value: number) => Math.round(value * 100) / 100;

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
        const normalizedMedicines: Medicine[] = Array.isArray(data.medicines)
          ? data.medicines.map((medicine: any) => ({
              ...medicine,
              price: round2(Number(medicine.price ?? 0)),
              mrp: medicine.mrp != null ? round2(Number(medicine.mrp)) : undefined,
            }))
          : [];
        setMedicines(normalizedMedicines);
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
      if (window.location.hash === '#/admin') {
        setActiveView('admin');
        return;
      }
      if (window.location.hash === '#/checkout') {
        setActiveView('checkout');
        return;
      }
      setActiveView('store');
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
                    price: round2(Number(item.price ?? 0)),
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

  const sendMobileOtp = () => {
    setLoginLoading(true);
    setLoginError(null);
    fetch('/api/auth/mobile/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_number: mobileNumber }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Unable to send OTP');
        }
        setOtpSent(true);
        setOtpDebugValue(body.debug_otp ? String(body.debug_otp) : null);
      })
      .catch((error: Error) => setLoginError(error.message || 'Unable to send OTP'))
      .finally(() => setLoginLoading(false));
  };

  const verifyMobileOtp = () => {
    setLoginLoading(true);
    setLoginError(null);
    fetch('/api/auth/mobile/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile_number: mobileNumber,
        otp: mobileOtp,
        name: mobileName,
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Invalid OTP');
        }
        setUser(body);
        setShowLogin(false);
        setMobileOtp('');
        setOtpSent(false);
        setOtpDebugValue(null);
      })
      .catch((error: Error) => setLoginError(error.message || 'Unable to verify OTP'))
      .finally(() => setLoginLoading(false));
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

  const totalPrice = round2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
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

  const normalizeAddress = (address: any): DeliveryAddress => ({
    id: Number(address.id),
    fullName: address.fullName ?? address.full_name ?? '',
    phone: address.phone ?? '',
    line1: address.line1 ?? address.line_1 ?? '',
    line2: address.line2 ?? address.line_2 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    pincode: address.pincode ?? '',
    landmark: address.landmark ?? '',
    isDefault: Boolean(address.isDefault ?? address.is_default),
  });

  const loadDeliveryAddresses = (preferredAddressId?: number) => {
    if (!user || typeof user.id !== 'number') {
      setDeliveryAddresses([]);
      setSelectedDeliveryAddressId(null);
      return;
    }

    setIsLoadingDeliveryAddresses(true);
    setDeliveryAddressError(null);

    fetch('/api/users/me/delivery-addresses')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to load delivery addresses');
        }
        return res.json();
      })
      .then((data) => {
        const addresses: DeliveryAddress[] = Array.isArray(data) ? data.map(normalizeAddress) : [];
        setDeliveryAddresses(addresses);
        if (addresses.length === 0) {
          setSelectedDeliveryAddressId(null);
          return;
        }
        const preferredAddress = preferredAddressId
          ? addresses.find((address) => address.id === preferredAddressId)
          : null;
        const defaultAddress = addresses.find((address) => address.isDefault);
        const initialAddress = preferredAddress || defaultAddress || addresses[0];
        if (initialAddress?.id) {
          setSelectedDeliveryAddressId(initialAddress.id);
          setDeliveryAddress((prev) => ({ ...prev, ...initialAddress }));
        }
      })
      .catch((error: Error) => setDeliveryAddressError(error.message || 'Unable to load delivery addresses'))
      .finally(() => setIsLoadingDeliveryAddresses(false));
  };

  const addDeliveryAddress = () => {
    if (!user || typeof user.id !== 'number') {
      setDeliveryAddressError('Please log in to add delivery addresses.');
      return;
    }
    if (!isDeliveryAddressComplete()) {
      setDeliveryAddressError('Please fill all required address fields.');
      return;
    }

    setIsSavingDeliveryAddress(true);
    setDeliveryAddressError(null);

    fetch('/api/users/me/delivery-addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: deliveryAddress.fullName,
        phone: deliveryAddress.phone,
        line1: deliveryAddress.line1,
        line2: deliveryAddress.line2,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        pincode: deliveryAddress.pincode,
        landmark: deliveryAddress.landmark,
        is_default: deliveryAddresses.length === 0,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to add delivery address');
        }
        return res.json();
      })
      .then((data) => {
        const newId = Number(data.id);
        return loadDeliveryAddresses(Number.isFinite(newId) ? newId : undefined);
      })
      .catch((error: Error) => setDeliveryAddressError(error.message || 'Unable to add delivery address'))
      .finally(() => setIsSavingDeliveryAddress(false));
  };

  const selectDeliveryAddress = (addressId: number) => {
    setSelectedDeliveryAddressId(addressId);
    const selected = deliveryAddresses.find((address) => address.id === addressId);
    if (selected) {
      setDeliveryAddress((prev) => ({ ...prev, ...selected }));
      setDeliveryAddressError(null);
    }
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
    if (!selectedDeliveryAddressId) {
      setOrderError('Please select a delivery address or add a new one.');
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
        amount: round2(totalPrice),
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
            delivery_address_id: selectedDeliveryAddressId,
            items: cart.map((item) => ({ medicine_id: item.id, quantity: item.quantity, price: round2(item.price) })),
            total_price: round2(totalPrice),
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
        window.location.hash = '/';
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
    if (activeView === 'checkout') {
      loadPaymentMethods();
      loadDeliveryAddresses();
    }
  }, [activeView, user]);

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

  const isDeliveryAddressComplete = () => {
    return Boolean(
      deliveryAddress.fullName.trim() &&
      deliveryAddress.phone.trim() &&
      deliveryAddress.line1.trim() &&
      deliveryAddress.city.trim() &&
      deliveryAddress.state.trim() &&
      deliveryAddress.pincode.trim()
    );
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      setOrderError('Your cart is empty. Add medicines to continue.');
      return;
    }
    setShowCart(false);
    setOrderError(null);
    window.location.hash = '/checkout';
  };

  const openCartFromCheckout = () => {
    setShowCart(true);
    window.location.hash = '/';
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

  const adminDisplayName = (user?.name || user?.email || 'Admin').trim();

  const openMedicineDetails = (medicineId: number) => {
    fetch(`/api/medicines/${medicineId}`)
      .then((res) => res.json())
      .then((data) =>
        setSelectedMedicine({
          ...data,
          price: round2(Number(data.price ?? 0)),
          mrp: data.mrp != null ? round2(Number(data.mrp)) : undefined,
        })
      )
      .catch(() => setSelectedMedicine(medicines.find((m) => m.id === medicineId) || null));
  };

  if (user?.role === 'ROLE_ADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] via-white to-[#f7fbff]">
        <section className="max-w-7xl mx-auto px-4 pt-4 pb-3">
          <div className="bg-white border border-[#dfeafb] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">Logged in as</p>
              <p className="text-sm md:text-base font-semibold text-slate-800 truncate">{adminDisplayName}</p>
              {user.email && <p className="text-xs text-slate-500 truncate">{user.email}</p>}
            </div>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[#d7e4f7] bg-[#f8fbff] text-[#1e4ca0] font-medium hover:bg-[#edf4ff]"
            >
              Logout
            </a>
          </div>
        </section>
        <AdminPanel show={true} />
      </div>
    );
  }

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


      {activeView === 'admin' && (
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
      )}

      {activeView === 'store' && (
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
        </>
      )}

      {activeView === 'checkout' && (
        <CheckoutPage
          cart={cart}
          totalPrice={totalPrice}
          paymentMethod={paymentMethod}
          isPlacingOrder={isPlacingOrder}
          orderError={orderError}
          isPaymentMethodRegistered={paymentMethods.some((method) => method.provider === paymentMethod)}
          isLoadingPaymentMethods={isLoadingPaymentMethods}
          isRegisteringPaymentMethod={isRegisteringPaymentMethod}
          paymentRegistrationError={paymentRegistrationError}
          address={deliveryAddress}
          onAddressChange={(field, value) => setDeliveryAddress((prev) => ({ ...prev, [field]: value }))}
          deliveryAddresses={deliveryAddresses}
          selectedDeliveryAddressId={selectedDeliveryAddressId}
          isLoadingDeliveryAddresses={isLoadingDeliveryAddresses}
          isSavingDeliveryAddress={isSavingDeliveryAddress}
          deliveryAddressError={deliveryAddressError}
          onSelectDeliveryAddress={selectDeliveryAddress}
          onAddDeliveryAddress={addDeliveryAddress}
          onBackToCart={openCartFromCheckout}
          onBackToStore={openStore}
          onPaymentMethodChange={setPaymentMethod}
          onRegisterPaymentMethod={registerPaymentMethod}
          onPlaceOrder={placeOrder}
        />
      )}

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
            <button type="button" onClick={() => {
              setShowLogin(false);
              setLoginError(null);
            }} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close login">
              <X size={20} />
            </button>
            <h3 className="text-xl font-semibold mb-4">Login / Register</h3>
            <div className="flex flex-col gap-4">
              <a href="/api/auth/google" className="bg-red-500 text-white py-2 rounded-lg text-center">Login with Google</a>
              <a href="/api/auth/facebook" className="bg-blue-600 text-white py-2 rounded-lg text-center">Login with Facebook</a>
              <div className="text-center text-xs text-slate-500">or</div>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Mobile number (10 digits)"
                className="border rounded-lg px-3 py-2"
              />
              <input
                type="text"
                value={mobileName}
                onChange={(e) => setMobileName(e.target.value)}
                placeholder="Name (optional)"
                className="border rounded-lg px-3 py-2"
              />
              {otpSent && (
                <input
                  type="text"
                  value={mobileOtp}
                  onChange={(e) => setMobileOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="border rounded-lg px-3 py-2"
                />
              )}
              {otpDebugValue && (
                <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded px-2 py-1">
                  Dev OTP: <strong>{otpDebugValue}</strong>
                </p>
              )}
              {loginError && <p className="text-xs text-red-600">{loginError}</p>}
              {!otpSent ? (
                <button
                  type="button"
                  onClick={sendMobileOtp}
                  disabled={loginLoading || !mobileNumber.trim()}
                  className="bg-teal-600 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {loginLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={verifyMobileOtp}
                  disabled={loginLoading || !mobileOtp.trim()}
                  className="bg-teal-700 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {loginLoading ? 'Verifying...' : 'Verify OTP & Login'}
                </button>
              )}
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
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                <p className="mt-1 text-gray-700">{selectedMedicine.medicine_description || selectedMedicine.description || 'Not available'}</p>
                {selectedMedicine.source === 'ocr' && (
                  <p className="mt-2 text-xs text-slate-500">Added from agency receipt OCR ingestion</p>
                )}
              </div>
              {selectedMedicine.medicine_uses && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uses</p>
                  <p className="mt-1 text-gray-700">{selectedMedicine.medicine_uses}</p>
                </div>
              )}
              {selectedMedicine.medicine_doses && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doses</p>
                  <p className="mt-1 text-gray-700">{selectedMedicine.medicine_doses}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div>Price: <strong>₹{selectedMedicine.price.toFixed(2)}</strong></div>
              <div>MRP: <strong>₹{(selectedMedicine.mrp || selectedMedicine.price).toFixed(2)}</strong></div>
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
        onClose={() => {
          setShowCart(false);
          setOrderError(null);
          setPaymentIntentId(null);
          setPaymentRegistrationError(null);
        }}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
        onProceedToCheckout={openCheckout}
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
    </div>
  );
}
