import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  Edit3, 
  History, 
  Settings2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Check, 
  X, 
  Layers, 
  ShieldCheck, 
  Info,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { api } from '../../lib/api.ts';
import { 
  ResearchResult, 
  ResearchSource, 
  ValueHistoryItem, 
  ResearchScheduleConfig,
  Service 
} from '../../types/index.ts';

interface LiveValueResearchTabProps {
  catalog: Service[];
  onCatalogRefresh: () => void;
}

export const LiveValueResearchTab: React.FC<LiveValueResearchTabProps> = ({
  catalog,
  onCatalogRefresh
}) => {
  const [researchList, setResearchList] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [researchingAll, setResearchingAll] = useState(false);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchCategory, setBatchCategory] = useState<string>('all');

  // Modals
  const [viewSourcesItem, setViewSourcesItem] = useState<ResearchResult | null>(null);
  const [editItem, setEditItem] = useState<ResearchResult | null>(null);
  const [editValueM, setEditValueM] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<ResearchScheduleConfig>({
    enabled: false,
    intervalHours: 24,
    lastRunAt: null,
    nextRunAt: null,
    targetCategories: ['Fruits', 'Gamepasses'],
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<ValueHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load research results
  const loadResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetResearch({
        status: statusFilter,
        category: categoryFilter,
        search: searchQuery,
      });
      setResearchList(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load research data');
    } finally {
      setLoading(false);
    }
  };

  // Load schedule configuration
  const loadSchedule = async () => {
    try {
      const config = await api.adminGetResearchSchedule();
      setScheduleConfig(config);
    } catch (err) {
      console.warn('Failed to load schedule config:', err);
    }
  };

  // Load value history
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await api.adminGetValueHistory();
      setHistoryList(history);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadResearch();
    loadSchedule();
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadResearch();
  };

  // Trigger Research All or by category
  const handleBatchResearch = async () => {
    setResearchingAll(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const results = await api.adminResearchBatch({
        category: batchCategory === 'all' ? undefined : batchCategory
      });
      setSuccessMsg(`Successfully researched ${results.length} items using Google Search Grounding.`);
      await loadResearch();
    } catch (err: any) {
      setError(err.message || 'Batch research failed');
    } finally {
      setResearchingAll(false);
    }
  };

  // Re-research single item
  const handleSingleResearch = async (item: ResearchResult | Service) => {
    const isService = 'slug' in item;
    const itemId = isService ? item.id : (item.itemId || undefined);
    const itemName = isService ? item.name : item.itemName;
    const category = item.category;
    const priceM = isService ? item.priceM : item.currentValueM;

    setResearchingId(item.id);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.adminResearchSingleItem({
        id: itemId,
        name: itemName,
        category,
        priceM,
      });
      setSuccessMsg(`Researched online values for "${itemName}".`);
      await loadResearch();
    } catch (err: any) {
      setError(err.message || `Failed to research ${itemName}`);
    } finally {
      setResearchingId(null);
    }
  };

  // Approve research item
  const handleApprove = async (researchId: string, overrideM?: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.adminApproveResearch(researchId, overrideM);
      setSuccessMsg(res.message || 'Researched value approved and applied to official catalog!');
      await loadResearch();
      onCatalogRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to approve value');
    }
  };

  // Reject research item
  const handleReject = async (researchId: string) => {
    const reason = prompt('Optional rejection reason (or leave blank):');
    if (reason === null) return; // User cancelled prompt

    setError(null);
    try {
      await api.adminRejectResearch(researchId, reason);
      setSuccessMsg('Research record rejected.');
      await loadResearch();
    } catch (err: any) {
      setError(err.message || 'Failed to reject value');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ResearchResult) => {
    setEditItem(item);
    setEditValueM(item.researchedValueM);
    setEditNotes(item.notes || '');
  };

  // Save manual edit & optionally approve
  const handleSaveEdit = async (andApprove: boolean = false) => {
    if (!editItem) return;
    const num = parseFloat(editValueM);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid non-negative number for trading value (M).');
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      await api.adminEditResearch(editItem.id, num.toFixed(2), editNotes);
      if (andApprove) {
        await handleApprove(editItem.id, num.toFixed(2));
      } else {
        setSuccessMsg(`Updated proposed value for ${editItem.itemName} to ${num.toFixed(2)}M.`);
        await loadResearch();
      }
      setEditItem(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save value modification');
    } finally {
      setSavingEdit(false);
    }
  };

  // Save Schedule Config
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      const updated = await api.adminUpdateResearchSchedule(scheduleConfig);
      setScheduleConfig(updated);
      setShowScheduleModal(false);
      setSuccessMsg('Market research schedule configuration saved successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Summary counts
  const pendingCount = researchList.filter(r => r.status === 'pending_approval').length;
  const conflictCount = researchList.filter(r => r.confidence === 'conflict' || r.status === 'conflict').length;
  const approvedCount = researchList.filter(r => r.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Top Value Research Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-blue-500/10 border border-amber-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-[10px] text-amber-300 font-bold tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Google Search Grounding Engine
              </span>
              <span className="text-xs text-slate-400">Gemini 3.8 Flash</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Live Blox Fruits Value Research & Verification
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Research real-time trading values across authoritative Blox Fruits community value lists and web citations. 
              Values require explicit admin approval before publishing to customer order forms.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setShowScheduleModal(true); }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-medium flex items-center gap-1.5 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Schedule Auto-Research</span>
            </button>

            <button
              onClick={() => { loadHistory(); setShowHistoryModal(true); }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-medium flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>Audit History</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Research Action Control Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Batch Research Target:</span>
            </div>
            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">All Catalogue Items</option>
              <option value="Fruits">Fruits Only</option>
              <option value="Gamepasses">Gamepasses Only</option>
              <option value="Trials">Trials Only</option>
              <option value="Raids">Raids Only</option>
            </select>

            <button
              onClick={handleBatchResearch}
              disabled={researchingAll}
              className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${researchingAll ? 'animate-spin' : ''}`} />
              <span>{researchingAll ? 'Searching Google & Cross-Checking...' : 'Research Now'}</span>
            </button>

            <button
              onClick={loadResearch}
              disabled={loading}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors"
              title="Refresh Research Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>Pending: <strong className="text-amber-400 font-bold">{pendingCount}</strong></span>
            <span>Conflicts: <strong className="text-rose-400 font-bold">{conflictCount}</strong></span>
            <span>Approved: <strong className="text-emerald-400 font-bold">{approvedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Discrepancy Alert Banner */}
      {conflictCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Market Discrepancy Detected ({conflictCount} item{conflictCount > 1 ? 's' : ''})
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Online sources disagree by more than 15% on trading values for flagged items below. 
              The system has isolated these values for mandatory manual review to prevent inaccurate pricing.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter research by item name or category..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); loadResearch(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="all">All Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="conflict">Conflicts (Need Review)</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="all">All Categories</option>
            <option value="Fruits">Fruits</option>
            <option value="Gamepasses">Gamepasses</option>
            <option value="Trials">Trials</option>
            <option value="Raids">Raids</option>
            <option value="Dungeons">Dungeons</option>
          </select>
        </div>
      </div>

      {/* Research Records Grid / List */}
      {loading && researchList.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading market research records...</span>
        </div>
      ) : researchList.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
          <Sparkles className="w-8 h-8 text-amber-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No research records found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click <strong>"Research Now"</strong> above to query Google Search Grounding for current trading values across Blox Fruits lists.
          </p>
          <button
            onClick={handleBatchResearch}
            disabled={researchingAll}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            Start Market Research
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {researchList.map((item) => {
            const currentNum = parseFloat(item.currentValueM) || 0;
            const researchedNum = parseFloat(item.researchedValueM) || 0;
            const diff = researchedNum - currentNum;
            const isDifferent = Math.abs(diff) > 0.001;
            const isApproved = item.status === 'approved';
            const isConflict = item.confidence === 'conflict' || item.status === 'conflict';
            const isRejected = item.status === 'rejected';

            return (
              <div
                key={item.id}
                className={`bg-slate-900/60 border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  isConflict
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : isApproved
                    ? 'border-emerald-500/30'
                    : isRejected
                    ? 'border-slate-800 opacity-60'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Tags & Confidence */}
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                      {item.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Confidence Pill */}
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider ${
                          item.confidence === 'high'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.confidence === 'conflict'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                            : item.confidence === 'not_found'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.confidence} Confidence
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider ${
                          isApproved
                            ? 'bg-emerald-500 text-slate-950'
                            : isConflict
                            ? 'bg-rose-500 text-white'
                            : isRejected
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Item Name */}
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center justify-between">
                      <span>{item.itemName}</span>
                      {researchingId === item.id && (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      )}
                    </h3>
                  </div>

                  {/* Values Comparison Strip */}
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans">Current Catalog</span>
                      <span className="font-bold text-slate-300 text-sm">{item.currentValueM}M</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans">Researched Online</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-400 text-sm">{item.researchedValueM}M</span>
                        {isDifferent && (
                          <span
                            className={`text-[10px] flex items-center font-bold ${
                              diff > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {item.changePercent ? `${Math.abs(item.changePercent)}%` : ''}
                          </span>
                        )}
                        {!isDifferent && (
                          <span className="text-[10px] text-slate-500 flex items-center">
                            <Minus className="w-3 h-3" /> 0%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Note Banner */}
                  {item.discrepancyNote && (
                    <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/50 text-[11px] text-slate-300 leading-relaxed">
                      <span className="text-amber-400 font-semibold block mb-0.5">Analysis:</span>
                      {item.discrepancyNote}
                    </div>
                  )}

                  {/* Sources button */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <button
                      onClick={() => setViewSourcesItem(item)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{item.sourcesCount || 0} Web Sources</span>
                    </button>

                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.researchedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Approval info if approved */}
                  {isApproved && item.approvedAt && (
                    <div className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1 flex items-center justify-between font-mono">
                      <span>Published to Catalog</span>
                      <span>{item.approvedBy || 'Admin'}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                  {!isApproved ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-1">
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                          title="Approve & Publish this value to official customer catalog"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1 transition-colors"
                          title="Manually adjust proposed value before approving"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleReject(item.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg transition-colors"
                          title="Reject researched value"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleSingleResearch(item)}
                        disabled={researchingId === item.id}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Re-run Google Search grounding for this item"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${researchingId === item.id ? 'animate-spin' : ''}`} />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Active in Catalogue</span>
                      </span>

                      <button
                        onClick={() => handleSingleResearch(item)}
                        disabled={researchingId === item.id}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${researchingId === item.id ? 'animate-spin' : ''}`} />
                        <span>Re-Research</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL 1: VIEW SOURCES MODAL --- */}
      {viewSourcesItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-semibold">Web Citations & Evidence</span>
                <h3 className="text-base font-bold text-white">
                  Sources for {viewSourcesItem.itemName}
                </h3>
              </div>
              <button
                onClick={() => setViewSourcesItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {(!viewSourcesItem.sources || viewSourcesItem.sources.length === 0) ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No individual source citations recorded.
                </p>
              ) : (
                viewSourcesItem.sources.map((src, i) => (
                  <div key={src.id || i} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{src.sourceName}</span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {src.reportedValueM}M
                      </span>
                    </div>

                    {src.snippets && (
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 italic">
                        "{src.snippets}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <a
                        href={src.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-mono"
                      >
                        <span>{src.sourceUrl.replace(/^https?:\/\//, '').slice(0, 35)}...</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>

                      <span>{new Date(src.retrievedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewSourcesItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT & APPROVE VALUE MODAL --- */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-semibold">Manual Adjustment</span>
                <h3 className="text-base font-bold text-white">Edit Value: {editItem.itemName}</h3>
              </div>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans">Current Value</span>
                  <span className="font-bold text-slate-300 block">{editItem.currentValueM}M</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans">Researched Online</span>
                  <span className="font-bold text-amber-400 block">{editItem.researchedValueM}M</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Proposed In-Game Trading Value (M) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editValueM}
                    onChange={(e) => setEditValueM(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                    placeholder="e.g. 90.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">M</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Staff Review Note / Adjustment Reason
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                  placeholder="e.g. Rounded to 90M based on consistent recent trades."
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingEdit}
                onClick={() => handleSaveEdit(false)}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl"
              >
                Save as Pending
              </button>

              <button
                type="button"
                disabled={savingEdit}
                onClick={() => handleSaveEdit(true)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl"
              >
                Save & Approve Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SCHEDULE CONFIGURATION MODAL --- */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveSchedule} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-semibold">Background Automation</span>
                <h3 className="text-base font-bold text-white">Scheduled Value Research</h3>
              </div>
              <button type="button" onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="font-bold text-white block">Enable Automatic Research</span>
                  <span className="text-slate-400 text-[11px]">Periodically query Google Search in the background</span>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleConfig.enabled}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Research Frequency (Interval in Hours)
                </label>
                <select
                  value={scheduleConfig.intervalHours}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, intervalHours: parseInt(e.target.value, 10) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours</option>
                  <option value={24}>Every 24 Hours (Daily)</option>
                  <option value={48}>Every 48 Hours</option>
                  <option value={168}>Weekly (Every 7 Days)</option>
                </select>
              </div>

              {scheduleConfig.lastRunAt && (
                <div className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span>Last Automated Run: {new Date(scheduleConfig.lastRunAt).toLocaleString()}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Free-tier note: Standard automated runs use Gemini 3.8 Flash which operates within free-tier rate limits. 
                Values discovered by the scheduler remain in <strong>Pending Approval</strong> state until senior staff review and publish them.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSchedule}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl"
              >
                {savingSchedule ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL 4: VALUE HISTORY AUDIT LOG MODAL --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-400 uppercase font-semibold">Audit Trail</span>
                <h3 className="text-base font-bold text-white">Value & Price Change History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingHistory ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading audit history...</div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No price changes recorded yet. When admins approve researched values or modify catalogue prices, permanent audit logs are recorded here.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {historyList.map((hist) => (
                    <div key={hist.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white font-sans">{hist.itemName}</div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          Reason: <span className="text-amber-400">{hist.changeReason.replace(/_/g, ' ')}</span>
                          <span className="mx-2 text-slate-600">|</span>
                          By: <span className="text-slate-300">{hist.updatedBy}</span>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-slate-500 line-through">{hist.oldValueM}M</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-emerald-400">{hist.newValueM}M</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(hist.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Close Audit History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
