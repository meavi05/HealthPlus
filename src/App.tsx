/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
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
}

interface CartItem extends Medicine {
  quantity: number;
}

interface ProfileUser {
  id: number;
  name: string;
  email: string;
  profile_picture?: string;
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

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        console.log('User data fetched:', data);
        setUser(data);
      });
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
    console.log('fetchProfile called, user:', user);
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
    }, 500);
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
        if (window.confirm('Order placed successfully! Clear cart?')) {
          setCart([]);
        }
        setShowCart(false);
      } else {
        alert('Failed to place order');
      }
    });
  };

  const updateProfile = (updatedUser: ProfileUser) => {
    if (!user) return;
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
      />

      <section className="bg-teal-50 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Your Health, Our Priority</h2>
          <p className="text-gray-600">Get genuine medicines delivered to your doorstep.</p>
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
      />

      <OrdersModal show={showOrders} orders={orders} onClose={() => setShowOrders(false)} />

      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Login / Register</h3>
            <div className="flex flex-col gap-4">
              <a href="/api/auth/google" className="bg-red-500 text-white py-2 rounded-lg text-center">Login with Google</a>
              <a href="/api/auth/facebook" className="bg-blue-600 text-white py-2 rounded-lg text-center">Login with Facebook</a>
            </div>
            <button onClick={() => setShowLogin(false)} className="mt-6 w-full bg-gray-200 text-gray-800 py-2 rounded-lg">Close</button>
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
