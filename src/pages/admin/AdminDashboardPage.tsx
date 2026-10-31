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
  ChevronRight,
  MessageSquare,
  Plus,
  Send,
  User,
  Monitor,
  Image as ImageIcon,
  CheckCircle2,
  X,
  HelpCircle
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { Enquiry, EnquiryStatus } from '../../types/index.ts';

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ 
  onNavigate, 
  onLogout 
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'support' | 'proofs'>('orders');

  // --- ORDERS STATE ---
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');

  // --- SUPPORT INBOX STATE ---
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<string>('all');
  const [enquirySearch, setEnquirySearch] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    source: 'discord' as 'discord' | 'direct' | 'website',
    robloxUsername: '',
    customerName: '',
    discordTag: '',
    orderCodeOrId: '',
    subject: '',
    message: '',
    status: 'pending' as EnquiryStatus,
    staffNotes: '',
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  // --- PROOFS STATE ---
  const [publicProofs, setPublicProofs] = useState<any[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);

  // Load orders
  const loadOrders = async () => {
    setLoadingOrders(true);
    setOrderError(null);
    try {
      const data = await api.adminGetOrders(statusFilter, orderSearch);
      setOrders(data);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to fetch orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load enquiries
  const loadEnquiries = async () => {
    setLoadingEnquiries(true);
    try {
      const data = await api.adminGetEnquiries(enquiryStatusFilter, enquirySearch);
      setEnquiries(data);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  // Load proofs
  const loadProofs = async () => {
    setLoadingProofs(true);
    try {
      const data = await api.getPublicProofs();
      setPublicProofs(data);
    } catch (err) {
      console.error('Failed to load proofs:', err);
    } finally {
      setLoadingProofs(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'support') {
      loadEnquiries();
    } else if (activeTab === 'proofs') {
      loadProofs();
    }
  }, [activeTab, enquiryStatusFilter]);

  const handleOrderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleEnquirySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEnquiries();
  };

  const handleUpdateEnquiryStatus = async (id: string, newStatus: EnquiryStatus) => {
    try {
      await api.adminUpdateEnquiryStatus(id, newStatus);
      await loadEnquiries();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleCreateManualEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.robloxUsername.trim() || !manualForm.subject.trim() || !manualForm.message.trim()) {
      alert('Roblox username, subject, and message are required.');
      return;
    }

    setSubmittingManual(true);
    try {
      await api.adminCreateManualEnquiry(manualForm);
      setShowManualModal(false);
      setManualForm({
        source: 'discord',
        robloxUsername: '',
        customerName: '',
        discordTag: '',
        orderCodeOrId: '',
        subject: '',
        message: '',
        status: 'pending',
        staffNotes: '',
      });
      await loadEnquiries();
    } catch (err: any) {
      alert(err.message || 'Failed to record enquiry');
    } finally {
      setSubmittingManual(false);
    }
  };

  // Metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending_review').length;
  const activeCarries = orders.filter(o => ['accepted', 'deposit_received', 'in_progress'].includes(o.status)).length;
  const totalValueM = orders.reduce((sum, o) => sum + parseFloat(o.totalPriceM || '0'), 0).toFixed(1);
  const pendingEnquiries = enquiries.filter(e => e.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Top Staff Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            Staff Portal
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Carry Operations & Support Hub
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
          <span className="text-[11px] text-amber-400 uppercase font-medium">Orders Pending Review</span>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">{pendingOrders}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-blue-400 uppercase font-medium">Active In-Game Carries</span>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">{activeCarries}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] text-emerald-400 uppercase font-medium">Pending Support Tickets</span>
          <div className="text-2xl font-extrabold text-white font-mono">{pendingEnquiries}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Orders Queue</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'support'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Support Inbox</span>
          {pendingEnquiries > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold font-mono">
              {pendingEnquiries}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('proofs')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'proofs'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Public Proofs Wall</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
            {publicProofs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ORDERS QUEUE */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Search and Status Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <form onSubmit={handleOrderSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
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

          {orderError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              {orderError}
            </div>
          )}

          {/* Orders List Table */}
          {loadingOrders ? (
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
      )}

      {/* TAB 2: SUPPORT INBOX */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <form onSubmit={handleEnquirySearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={enquirySearch}
                onChange={(e) => setEnquirySearch(e.target.value)}
                placeholder="Search by Roblox username, order code, or subject..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {['all', 'pending', 'in_progress', 'resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setEnquiryStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs capitalize transition-colors ${
                      enquiryStatusFilter === st
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowManualModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Discord / Direct Enquiry</span>
              </button>
            </div>
          </div>

          {/* Enquiries List */}
          {loadingEnquiries ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              Loading support enquiries...
            </div>
          ) : enquiries.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 space-y-2">
              <div className="text-white font-semibold text-sm">No enquiries found</div>
              <p className="text-xs text-slate-500">
                All inquiries have been addressed or no tickets match the current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {enquiries.map((enq) => (
                <div
                  key={enq.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        enq.source === 'discord'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : enq.source === 'direct'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {enq.source}
                      </span>
                      <span className="text-sm font-bold text-white">
                        @{enq.robloxUsername}
                      </span>
                      {enq.discordTag && (
                        <span className="text-xs text-indigo-300 font-mono">
                          (Discord: {enq.discordTag})
                        </span>
                      )}
                      {enq.orderCodeOrId && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-amber-400 border border-slate-800">
                          Ref: {enq.orderCodeOrId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Status:</span>
                      <select
                        value={enq.status}
                        onChange={(e) => handleUpdateEnquiryStatus(enq.id, e.target.value as EnquiryStatus)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border bg-slate-950 focus:outline-none ${
                          enq.status === 'resolved'
                            ? 'border-emerald-500/50 text-emerald-400'
                            : enq.status === 'in_progress'
                            ? 'border-blue-500/50 text-blue-400'
                            : 'border-amber-500/50 text-amber-400'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-slate-100">{enq.subject}</h4>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                      {enq.message}
                    </p>
                  </div>

                  {enq.staffNotes && (
                    <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl">
                      <strong>Staff Notes:</strong> {enq.staffNotes}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span>Ticket ID: <span className="font-mono">{enq.id}</span></span>
                    <span>Received: {new Date(enq.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROOFS WALL PREVIEW */}
      {activeTab === 'proofs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Live Public Proofs Gallery</h3>
              <p className="text-xs text-slate-400">
                Completed carries currently visible to the public. To approve new proofs, open an order detail page.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/proofs')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>View Customer Proofs Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingProofs ? (
            <div className="py-20 text-center text-slate-500 text-sm">Loading proofs...</div>
          ) : publicProofs.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 space-y-2">
              <div className="text-white font-semibold text-sm">No active public proofs</div>
              <p className="text-xs text-slate-500">
                Attach and approve evidence from the Order Detail page once a carry is finished.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicProofs.map((p) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-400 font-bold">{p.orderCode}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{p.serviceName}</h4>
                    <span className="text-xs text-slate-400">Client: {p.robloxUsername}</span>
                  </div>
                  {p.mediaUrl && (
                    <a
                      href={p.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:underline block truncate font-mono"
                    >
                      {p.mediaUrl}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANUAL ENQUIRY LOGGING (DISCORD / DIRECT) */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Log External / Discord Support Enquiry
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualEnquiry} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Channel Source
                  </label>
                  <select
                    value={manualForm.source}
                    onChange={(e) => setManualForm({ ...manualForm, source: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                  >
                    <option value="discord">Discord DM / Ticket</option>
                    <option value="direct">Direct In-Game Chat</option>
                    <option value="website">Website Email / Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Roblox Username <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualForm.robloxUsername}
                    onChange={(e) => setManualForm({ ...manualForm, robloxUsername: e.target.value })}
                    placeholder="e.g. BloxPlayer"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Discord Tag
                  </label>
                  <input
                    type="text"
                    value={manualForm.discordTag}
                    onChange={(e) => setManualForm({ ...manualForm, discordTag: e.target.value })}
                    placeholder="e.g. Captain#1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Linked Order ID / BFS Code
                  </label>
                  <input
                    type="text"
                    value={manualForm.orderCodeOrId}
                    onChange={(e) => setManualForm({ ...manualForm, orderCodeOrId: e.target.value })}
                    placeholder="e.g. BFS-1042"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Subject <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={manualForm.subject}
                  onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                  placeholder="e.g. Inquired about Race V4 trial session timings"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Message / Details <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={manualForm.message}
                  onChange={(e) => setManualForm({ ...manualForm, message: e.target.value })}
                  placeholder="Summary of customer conversation or trade query..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Internal Staff Notes (Optional)
                </label>
                <input
                  type="text"
                  value={manualForm.staffNotes}
                  onChange={(e) => setManualForm({ ...manualForm, staffNotes: e.target.value })}
                  placeholder="e.g. Asked customer to submit fruit offer via /order"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingManual ? 'Saving...' : 'Record Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
