import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ExternalLink, 
  LogOut, 
  Layers, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Coins,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api.ts';

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ 
  onNavigate, 
  onLogout 
}) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetOrders(statusFilter, search);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  // Metrics calculation
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending_review').length;
  const activeCarries = orders.filter(o => ['accepted', 'deposit_received', 'in_progress'].includes(o.status)).length;
  const totalValueM = orders.reduce((sum, o) => sum + parseFloat(o.totalPriceM || '0'), 0).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Top Staff Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            Staff Administration
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Orders Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigate('/admin/catalog')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Manage Catalog</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/catalog/audit')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Uncertain Items Audit</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Total Orders</span>
          <div className="text-2xl font-extrabold text-white font-mono">{totalOrders}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-amber-400 uppercase font-medium">Pending Review</span>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">{pendingOrders}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-blue-400 uppercase font-medium">Active Carries</span>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">{activeCarries}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-emerald-400 uppercase font-medium">Managed Value</span>
          <div className="text-2xl font-extrabold text-white font-mono">{totalValueM}M</div>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by BFS code or Roblox username..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending_review', label: 'Pending' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'deposit_received', label: 'Deposit Paid' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'fully_paid', label: 'Fully Paid' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Orders List Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 space-y-2">
          <div className="text-white font-semibold text-sm">No orders found</div>
          <p className="text-xs text-slate-500">
            No carry requests match the current filters.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
          {orders.map((order) => {
            return (
              <div
                key={order.id}
                onClick={() => onNavigate(`/admin/orders/${order.id}`)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold font-mono text-white">
                      {order.orderCode}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      @{order.robloxUsername}
                    </span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-400">
                      {order.serviceName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Timezone: {order.timezone}</span>
                    <span>·</span>
                    <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right font-mono text-xs">
                    <div className="text-amber-400 font-bold">{order.totalPriceM}M Value</div>
                    <div className="text-slate-500 text-[10px]">
                      Deposit: {order.depositM}M (Paid: {order.totalPaidM}M)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-slate-950 border-slate-800 text-slate-300">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
