/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Search, ShoppingCart, User, Menu } from 'lucide-react';

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

export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(8);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
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
  const [user, setUser] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        console.log('User data fetched:', data);
        setUser(data);
      });
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/medicines?page=${currentPage}&limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        setMedicines(data.medicines);
        setTotalMedicines(data.total);
        setIsLoading(false);
      });
  }, [currentPage, limit]);

  const filteredMedicines = medicines.filter(medicine =>
    medicine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const fetchOrders = () => {
    if (!user) return alert('Please log in to view orders');
    fetch(`/api/orders/${user.id}`)
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setShowOrders(true);
      });
  };

  const [editUser, setEditUser] = useState<any>(null);

  const [isEditing, setIsEditing] = useState(false);

  const updateProfile = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editUser.email)) {
      alert('Please enter a valid email address');
      return;
    }
    fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editUser)
    })
    .then(res => {
      if (res.ok) {
        setUser(editUser);
        setIsEditing(false);
        setShowProfile(false);
        alert('Profile updated!');
      } else {
        alert('Failed to update profile');
      }
    });
  };

  const fetchProfile = () => {
    console.log('fetchProfile called, user:', user);
    if (!user) return alert('Please log in to view profile');
    setEditUser(user);
    setIsEditing(false);
    setShowProfile(true);
  };

  const handleCardClick = (medicine: Medicine) => {
    console.log('Clicked:', medicine.name);
  };

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (medicine: Medicine) => {
    setAddingToCart(medicine.id);
    setTimeout(() => {
      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === medicine.id);
        if (existingItem) {
          return prevCart.map(item =>
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
      setCart(prevCart =>
        prevCart.map(item => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const removeFromCart = (id: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const [updatedItemId, setUpdatedItemId] = useState<number | null>(null);

  const updateQuantityWithFeedback = (id: number, quantity: number) => {
    updateQuantity(id, quantity);
    setUpdatedItemId(id);
    setTimeout(() => setUpdatedItemId(null), 500);
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
        items: cart.map(item => ({ medicine_id: item.id, quantity: item.quantity, price: item.price })),
        total_price: totalPrice
      })
    })
    .then(res => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Menu className="md:hidden" />
            <h1 className="text-2xl font-bold text-teal-600">HealthPlus</h1>
          </div>
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button onClick={fetchOrders} className="text-gray-600 hover:text-teal-600">My Orders</button>
                <button onClick={fetchProfile} className="text-gray-600 hover:text-teal-600">Profile</button>
                <a href="/api/auth/logout" className="text-gray-600 hover:text-teal-600">Logout</a>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="text-gray-600 hover:text-teal-600">Login</button>
            )}
            <User className="text-gray-600" />
            <div className="relative cursor-pointer" onClick={() => setShowCart(true)}>
              <ShoppingCart className="text-gray-600" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-teal-50 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Your Health, Our Priority</h2>
          <p className="text-gray-600">Get genuine medicines delivered to your doorstep.</p>
        </div>
      </section>

      {/* Product Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h3 className="text-xl font-semibold mb-6">Popular Medicines</h3>
        {isLoading ? (
          <div className="text-center py-20 text-gray-500">Loading medicines...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredMedicines.map(medicine => (
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
                        addToCart(medicine);
                      }}
                    >
                      {addingToCart === medicine.id ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span>Page {currentPage} of {Math.ceil(totalMedicines / limit)}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalMedicines / limit)))}
                disabled={currentPage === Math.ceil(totalMedicines / limit)}
                className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>

      {/* Orders Modal */}
      {showOrders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">My Orders</h3>
            {orders.length === 0 ? (
              <p>No orders found.</p>
            ) : (
              <ul className="space-y-4">
                {orders.map(order => (
                  <li key={order.id} className="border-b py-2">
                    <p className="font-semibold">Order #{order.id} - Total: ${order.total_price}</p>
                    <p className="text-sm">Status: <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{order.status || 'Pending'}</span></p>
                    <ul className="mt-2 text-sm text-gray-600">
                      {order.items.map((item: any) => (
                        <li key={item.id}>{item.medicine_name} x {item.quantity}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowOrders(false)} className="mt-4 bg-gray-200 px-4 py-2 rounded">Close</button>
          </div>
        </div>
      )}

      {/* Login Modal */}
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

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Your Cart</h3>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <p className="mb-4">Your cart is empty.</p>
                <button onClick={() => setShowCart(false)} className="bg-teal-600 text-white px-6 py-2 rounded-lg">Continue Shopping</button>
              </div>
            ) : (
              <>
                <ul className="space-y-4">
                  {cart.map(item => (
                    <li key={item.id} className={`flex justify-between items-center p-2 rounded transition-colors ${updatedItemId === item.id ? 'bg-teal-50' : ''}`}>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">${item.price} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity - 1)} className="bg-gray-200 px-2 rounded">-</button>
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => updateQuantityWithFeedback(item.id, parseInt(e.target.value))} 
                          className="w-16 text-center border rounded" 
                        />
                        <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity + 1)} className="bg-gray-200 px-2 rounded">+</button>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-4">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t pt-4">
                  <p className="text-lg font-bold">Total: ${totalPrice.toFixed(2)}</p>
                  <button onClick={placeOrder} className="mt-4 w-full bg-teal-600 text-white py-2 rounded-lg">Place Order</button>
                </div>
              </>
            )}
            <button onClick={() => setShowCart(false)} className="mt-6 w-full bg-gray-200 text-gray-800 py-2 rounded-lg">Close</button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">User Profile</h3>
            <div className="flex flex-col gap-4">
              <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                {editUser.profile_picture ? (
                  <img src={editUser.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              {isEditing ? (
                <>
                  <input type="text" value={editUser.name} onChange={(e) => setEditUser({...editUser, name: e.target.value})} className="border p-2 rounded" placeholder="Name" />
                  <input type="email" value={editUser.email} onChange={(e) => setEditUser({...editUser, email: e.target.value})} className="border p-2 rounded" placeholder="Email" />
                  <input type="text" value={editUser.profile_picture || ''} onChange={(e) => setEditUser({...editUser, profile_picture: e.target.value})} className="border p-2 rounded" placeholder="Profile Picture URL" />
                </>
              ) : (
                <>
                  <p><strong>Name:</strong> {editUser.name}</p>
                  <p><strong>Email:</strong> {editUser.email}</p>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              {isEditing ? (
                <button onClick={updateProfile} className="flex-1 bg-teal-600 text-white py-2 rounded">Save</button>
              ) : (
                <button onClick={() => setIsEditing(true)} className="flex-1 bg-teal-600 text-white py-2 rounded">Edit</button>
              )}
              <button onClick={() => setShowProfile(false)} className="flex-1 bg-gray-200 py-2 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
