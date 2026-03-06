import { ChevronDown, MapPin, Menu, Search, ShoppingCart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Suggestion {
  id: number;
  name: string;
}

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  user: any;
  totalItems: number;
  onFetchOrders: () => void;
  onMyHealthSelect: (option: 'prescription' | 'routine') => void;
  onFetchProfile: () => void;
  onOpenLogin: () => void;
  onOpenCart: () => void;
  location: string;
  onLocationChange: (value: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  suggestions: Suggestion[];
  onSuggestionSelect: (value: string) => void;
  onOpenAdmin: () => void;
}


const tabs = ['Medicines', 'Lab Tests', 'Consult Doctor', 'Health Products'];

export default function AppHeader({
  searchTerm,
  onSearchChange,
  user,
  totalItems,
  onFetchOrders,
  onMyHealthSelect,
  onFetchProfile,
  onOpenLogin,
  onOpenCart,
  location,
  onLocationChange,
  activeTab,
  onTabChange,
  suggestions,
  onSuggestionSelect,
  onOpenAdmin,
}: AppHeaderProps) {
  const [myHealthOpen, setMyHealthOpen] = useState(false);
  const myHealthMenuRef = useRef<HTMLDivElement | null>(null);

  const handleProfileIconClick = () => {
    if (user) {
      onFetchProfile();
      return;
    }
    onOpenLogin();
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (myHealthMenuRef.current && !myHealthMenuRef.current.contains(event.target as Node)) {
        setMyHealthOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const chooseMyHealthOption = (option: 'prescription' | 'routine') => {
    setMyHealthOpen(false);
    onMyHealthSelect(option);
  };

  return (
    <header className="bg-gradient-to-b from-[#eef7ff] to-white sticky top-0 z-50 border-b border-[#e6eef8]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm gap-2">
        <div className="flex items-center gap-2 text-slate-600 bg-white/90 border border-[#dfeaf7] rounded-full px-3 py-1.5 shadow-sm w-full sm:w-auto">
          <MapPin size={16} className="text-teal-600" />
          <input
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="bg-transparent outline-none w-full sm:w-40"
            placeholder="Enter delivery location"
          />
        </div>
        <p className="text-slate-500 hidden md:block">Care made simple • Verified pharmacy • Fast doorstep delivery</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Menu className="md:hidden shrink-0" />
          <h1 className="text-2xl font-bold text-teal-600">HealthPlus</h1>
        </div>
        <div className="order-3 md:order-2 basis-full md:basis-auto flex-1 md:max-w-md md:mx-4 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search medicines, healthcare products, brands..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#dde8f7] rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#84b6ff]"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute top-11 left-0 right-0 bg-white shadow-lg border rounded-lg z-50 max-h-56 overflow-auto">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    onClick={() => onSuggestionSelect(suggestion.name)}
                  >
                    {suggestion.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 ml-auto">
          <div className="relative" ref={myHealthMenuRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-[#2d7ff9] text-sm"
              onClick={() => setMyHealthOpen((prev) => !prev)}
            >
              <span className="hidden sm:inline">My Health</span>
              <span className="sm:hidden">Health</span>
              <ChevronDown size={16} className={`transition-transform ${myHealthOpen ? 'rotate-180' : ''}`} />
            </button>

            {myHealthOpen && (
              <div className="absolute right-0 mt-2 w-48 sm:w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
                <button
                  type="button"
                  onClick={() => chooseMyHealthOption('prescription')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f4f9ff]"
                >
                  Prescription
                </button>
                <button
                  type="button"
                  onClick={() => chooseMyHealthOption('routine')}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f4f9ff]"
                >
                  Medicine Routine
                </button>
              </div>
            )}
          </div>
          {user ? (
            <>
              {user?.role === 'ROLE_ADMIN' && (
                <button onClick={onOpenAdmin} className="text-slate-600 hover:text-[#2d7ff9] text-sm">Admin</button>
              )}
              <button onClick={onFetchOrders} className="text-slate-600 hover:text-[#2d7ff9] hidden sm:inline">Track Order</button>
              <a href="/api/auth/logout" className="text-slate-600 hover:text-[#2d7ff9] text-sm">Logout</a>
            </>
          ) : (
            <button onClick={onOpenLogin} className="text-slate-600 hover:text-[#2d7ff9] text-sm">Login</button>
          )}
          <button
            type="button"
            onClick={handleProfileIconClick}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#84b6ff]"
            aria-label="Open profile"
          >
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt={`${user?.name || 'User'} profile`}
                className="h-8 w-8 rounded-full object-cover border border-teal-100"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold border border-teal-200">
                {(user?.name?.charAt(0) || 'U').toUpperCase()}
              </span>
            )}
          </button>
          <div className="relative cursor-pointer" onClick={onOpenCart}>
            <ShoppingCart className="text-gray-600" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-teal-600 text-white text-xs rounded-full px-1.5">{totalItems}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
              activeTab === tab
                ? 'bg-[#e7f2ff] border-[#9cc4ff] text-[#2365d1]'
                : 'bg-white border-[#e4edf8] text-slate-600 hover:text-[#2365d1]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </header>
  );
}
