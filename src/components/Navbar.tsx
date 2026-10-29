import React, { useState } from 'react';
import { ShieldCheck, Compass, ShoppingCart, Search, Lock, Menu, X } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <button
          onClick={() => handleNav('/')}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-base shadow-sm">
            BF
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Blox Fruit Services
          </span>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => handleNav('/services')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isActive('/services') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Services Catalog
          </button>

          <button
            onClick={() => handleNav('/order')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isActive('/order') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Order Carry
          </button>

          <button
            onClick={() => handleNav('/track')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isActive('/track') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Track Order
          </button>

          <button
            onClick={() => handleNav('/admin')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors hover:text-white text-slate-400 ${
              isActive('/admin') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Staff Portal</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action CTA & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleNav('/order')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors shadow-sm whitespace-nowrap shrink-0 active:scale-95"
          >
            Place Order
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-2">
          <button
            onClick={() => handleNav('/services')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Services Catalog</span>
          </button>
          <button
            onClick={() => handleNav('/order')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <span>Order Carry (Multi-Fruit / Gamepass)</span>
          </button>
          <button
            onClick={() => handleNav('/track')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-amber-400" />
            <span>Track Order Status</span>
          </button>
          <button
            onClick={() => handleNav('/admin')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Staff Login & Dashboard</span>
          </button>
        </div>
      )}
    </header>
  );
};
