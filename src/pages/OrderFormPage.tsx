import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Copy, 
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';
import { Service, ProposedItem } from '../types/index.ts';
import { 
  toHundredths, 
  toMillionString, 
  calculateDepositAndRemaining, 
  calculateItemsTotal, 
  validatePaymentCoverage 
} from '../lib/calculator.ts';
import { api, CreateOrderResponse } from '../lib/api.ts';

interface OrderFormPageProps {
  services: Service[];
  preselectedServiceId?: string | null;
  onNavigate: (path: string) => void;
}

const COMMON_FRUIT_PRESETS = [
  { name: 'Kitsune Fruit', estimateM: 115 },
  { name: 'Dragon Fruit', estimateM: 90 },
  { name: 'Leopard Fruit', estimateM: 40 },
  { name: 'Dough Fruit', estimateM: 25 },
  { name: 'T-Rex Fruit', estimateM: 20 },
  { name: 'Mammoth Fruit', estimateM: 12 },
  { name: 'Spirit Fruit', estimateM: 10 },
  { name: 'Venom Fruit', estimateM: 9 },
  { name: 'Buddha Fruit', estimateM: 7 },
  { name: 'Portal Fruit', estimateM: 6 },
  { name: 'Blizzard Fruit', estimateM: 5 },
  { name: 'Rumble Fruit', estimateM: 5 },
  { name: 'Magma Fruit', estimateM: 1 },
  { name: 'Dark Blade Gamepass', estimateM: 95 },
  { name: '2x Mastery Gamepass', estimateM: 40 },
  { name: '2x Money Gamepass', estimateM: 40 },
  { name: 'Fast Boats Gamepass', estimateM: 25 },
];

export const OrderFormPage: React.FC<OrderFormPageProps> = ({
  services,
  preselectedServiceId,
  onNavigate,
}) => {
  // Wizard step: 1: Service, 2: Roblox Info, 3: Payment Items, 4: Review, 5: Confirmed
  const [step, setStep] = useState<number>(1);

  // Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [timezone, setTimezone] = useState('');
  const [availability, setAvailability] = useState('');
  const [paymentType, setPaymentType] = useState<'fruits' | 'gamepass' | 'combination'>('fruits');
  const [items, setItems] = useState<ProposedItem[]>([
    { itemName: '', quantity: 1, proposedValueM: '' },
  ]);
  const [customerNote, setCustomerNote] = useState('');
  const [consentPublicProofs, setConsentPublicProofs] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<CreateOrderResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Set initial service
  useEffect(() => {
    if (preselectedServiceId && services.some(s => s.id === preselectedServiceId)) {
      setSelectedServiceId(preselectedServiceId);
    } else if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id);
    }
  }, [preselectedServiceId, services]);

  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Math calculations
  const servicePriceHundredths = selectedService ? selectedService.priceHundredths : 0;
  const { depositHundredths, remainingHundredths, depositString, remainingString, totalString } = 
    calculateDepositAndRemaining(servicePriceHundredths);

  const { totalProposedHundredths, totalProposedString } = calculateItemsTotal(
    items.map(i => ({
      itemName: i.itemName,
      quantity: i.quantity,
      proposedValueM: i.proposedValueM,
    }))
  );

  const coverage = validatePaymentCoverage(servicePriceHundredths, totalProposedHundredths);

  // Item list handlers
  const handleAddItem = (preset?: { name: string; estimateM: number }) => {
    setItems([
      ...items,
      {
        itemName: preset ? preset.name : '',
        quantity: 1,
        proposedValueM: preset ? preset.estimateM.toString() : '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ itemName: '', quantity: 1, proposedValueM: '' }]);
      return;
    }
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof ProposedItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Step validation
  const validateStep = (current: number): boolean => {
    setSubmitError(null);
    if (current === 1) {
      if (!selectedService) {
        setSubmitError('Please select a service from the catalog.');
        return false;
      }
      return true;
    }

    if (current === 2) {
      const cleanUser = robloxUsername.trim();
      if (!cleanUser) {
        setSubmitError('Please enter your Roblox username.');
        return false;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
        setSubmitError('Roblox usernames must be 3-20 letters, numbers, or underscores.');
        return false;
      }
      if (!timezone.trim()) {
        setSubmitError('Please specify your timezone (e.g. EST, UTC, PST, IST).');
        return false;
      }
      if (!availability.trim()) {
        setSubmitError('Please describe your available play hours (e.g. Weekdays 6pm-10pm).');
        return false;
      }
      return true;
    }

    if (current === 3) {
      const validItems = items.filter(i => i.itemName.trim() !== '');
      if (validItems.length === 0) {
        setSubmitError('Please list at least one fruit or gamepass offered for payment.');
        return false;
      }
      for (const item of validItems) {
        const val = parseFloat(String(item.proposedValueM));
        if (isNaN(val) || val <= 0) {
          setSubmitError(`Please enter a valid estimated value in M for "${item.itemName}".`);
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Order Submission
  const handleSubmitOrder = async () => {
    if (isSubmitting || !selectedService) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const validItems = items.filter(i => i.itemName.trim() !== '');
      const response = await api.submitOrder({
        serviceId: selectedService.id,
        robloxUsername: robloxUsername.trim(),
        timezone: timezone.trim(),
        availability: availability.trim(),
        paymentType,
        items: validItems,
        customerNote: customerNote.trim() || undefined,
        consentPublicProofs,
      });

      setConfirmedOrder(response);
      setStep(5); // Confirmed screen
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Order submission failed:', err);
      setSubmitError(err.message || 'An error occurred while creating your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyOrderLink = () => {
    if (!confirmedOrder?.publicToken) return;
    const url = `${window.location.origin}/track?token=${confirmedOrder.publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // STEP 5: CONFIRMATION SCREEN
  if (step === 5 && confirmedOrder) {
    const trackingUrl = `${window.location.origin}/track?token=${confirmedOrder.publicToken}`;

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
              Order Created Successfully
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {confirmedOrder.orderCode}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Your carry request has been submitted to staff for trade value review.
            </p>
          </div>

          {/* Safe Bookmark Link Card */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-left space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Your Bookmarkable Tracking Link</span>
              <span className="text-[11px] text-amber-400">Keep this safe!</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 select-all"
              />
              <button
                type="button"
                onClick={copyOrderLink}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 border border-slate-700 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              This link uses an unguessable security token. Only people with this link can view this order status.
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Service:</span>
              <span className="font-semibold text-white">{confirmedOrder.serviceName}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Agreed Total Value:</span>
              <span className="text-amber-400 font-bold">{confirmedOrder.totalPriceM}M</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>50% Deposit (Upfront):</span>
              <span className="text-amber-300">{confirmedOrder.depositM}M</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>50% Remaining (On Completion):</span>
              <span>{confirmedOrder.remainingM}M</span>
            </div>
          </div>

          {/* Next Steps for Customer */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left space-y-2 text-xs text-amber-200">
            <div className="font-semibold flex items-center gap-2 text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Next Steps & In-Game Meetup</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-amber-200/90 text-[11px] leading-relaxed">
              <li>Our staff will review your offered items and verify their trade valuations.</li>
              <li>A staff member will send a friend request to <strong className="text-white font-mono">{robloxUsername}</strong>.</li>
              <li>You will meet at Cafe (Second Sea) or Mansion (Third Sea) to trade the 50% deposit.</li>
              <li>Once the carry is finished, you trade the remaining 50% balance.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate(`/track?token=${confirmedOrder.publicToken}`)}
              className="w-full sm:w-auto px-6 py-3 bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl hover:bg-amber-300 transition-colors shadow-sm"
            >
              Go to Order Status Page
            </button>
            <button
              onClick={() => onNavigate('/services')}
              className="w-full sm:w-auto px-6 py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors"
            >
              Browse More Services
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Step Stepper Header */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
          Step {step} of 4 · Safe Escrow Carry
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {step === 1 && 'Choose Service'}
          {step === 2 && 'Your Roblox Information'}
          {step === 3 && 'Fruit & Gamepass Offer'}
          {step === 4 && 'Review Order & Submit'}
        </h1>

        {/* Stepper Progress bar */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {['Service', 'Roblox Info', 'Payment Items', 'Review'].map((name, idx) => (
            <div key={name} className="space-y-1">
              <div 
                className={`h-1.5 rounded-full transition-colors ${
                  step > idx + 1 
                    ? 'bg-amber-400' 
                    : step === idx + 1 
                    ? 'bg-amber-400' 
                    : 'bg-slate-800'
                }`} 
              />
              <span className={`text-[10px] hidden sm:block ${step === idx + 1 ? 'text-white font-medium' : 'text-slate-500'}`}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* STEP 1: CHOOSE SERVICE */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-300">
              Select Published Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              {services.filter(s => s.isPublished).map(s => (
                <option key={s.id} value={s.id}>
                  [{s.category}] {s.name} — {s.priceM}M Value
                </option>
              ))}
            </select>

            {selectedService && (
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{selectedService.name}</span>
                  <span className="text-sm font-mono font-bold text-amber-400">{selectedService.priceM}M</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedService.description}
                </p>

                {/* Pricing Schedule */}
                <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase">50% Deposit (Upfront)</span>
                    <span className="text-amber-300 font-bold text-sm">{depositString}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase">50% Remaining (On End)</span>
                    <span className="text-slate-300 font-bold text-sm">{remainingString}</span>
                  </div>
                </div>

                {selectedService.prerequisites && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    <span className="text-slate-500 font-medium">Prerequisites: </span>
                    {selectedService.prerequisites}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ROBLOX INFORMATION */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Security Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-white">Account Safety Guaranteed</strong>
              We will NEVER request your password, PIN, security cookies (.ROBLOSECURITY), or 2FA codes. All carries occur co-op inside normal Roblox servers.
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Roblox Username <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={robloxUsername}
                onChange={(e) => setRobloxUsername(e.target.value)}
                placeholder="e.g. PirateKing_99"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Must match your exact in-game Roblox username so staff can add you.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Timezone <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. EST (UTC-5), PST, GMT, IST (UTC+5:30)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              {/* Quick Timezone Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['EST (UTC-5)', 'PST (UTC-8)', 'GMT (UTC+0)', 'CET (UTC+1)', 'IST (UTC+5:30)', 'SGT (UTC+8)', 'JST (UTC+9)'].map((tz) => (
                  <button
                    type="button"
                    key={tz}
                    onClick={() => setTimezone(tz)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] text-slate-300 transition-colors"
                  >
                    {tz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Available Play Hours <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g. Weekdays 6:00 PM – 10:00 PM EST, Weekends anytime after 1:00 PM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                When can you be in-game to receive the carry?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT TYPE & ITEMS OFFERED */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Payment Type Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'fruits', label: 'In-Game Fruits' },
                { id: 'gamepass', label: 'Gamepasses' },
                { id: 'combination', label: 'Combination (Both)' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentType(m.id as any)}
                  className={`p-3 text-xs font-medium rounded-xl border text-center transition-colors ${
                    paymentType === m.id
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fruit Presets Helper */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Common Fruit & Gamepass Estimates</span>
              </span>
              <span className="text-[11px] text-slate-500">Tap to add item row</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FRUIT_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => handleAddItem(p)}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-amber-400 font-semibold">~{p.estimateM}M</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offered Items Builder */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Items You Offer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Multiple items allowed. Enter your estimated trade value in Millions (M).
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                >
                  <div className="sm:col-span-6">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Fruit / Gamepass Name
                    </label>
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                      placeholder="e.g. Dough Fruit, 2x Mastery..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">
                      Est. Value (M)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.proposedValueM}
                        onChange={(e) => handleItemChange(idx, 'proposedValueM', e.target.value)}
                        placeholder="e.g. 25"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-2.5 pr-6 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                        M
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-1 flex justify-end sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Math Calculation Strip */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Service Price:</span>
                <span className="font-bold text-white">{totalString}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Required 50% Deposit:</span>
                <span className="font-bold">{depositString}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>50% Remaining (On Completion):</span>
                <span>{remainingString}</span>
              </div>
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-sm">
                <span className="font-sans font-semibold text-slate-200">Your Proposed Total:</span>
                <span className="font-bold text-amber-400">{totalProposedString}</span>
              </div>

              {/* Deposit Coverage Status Callout */}
              <div className="pt-1">
                {coverage.hasMetDeposit ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg p-2.5 text-[11px] flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {coverage.hasMetTotal 
                        ? 'Offered items fully cover both 50% deposit and 50% remaining!' 
                        : 'Offered items cover the 50% deposit! Remaining balance can be settled later.'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-2.5 text-[11px] flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Needs +{toMillionString(coverage.depositDeficitHundredths)} more to reach the 50% deposit threshold.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-300 block mb-0.5">Valuation Verification Notice:</strong>
              Fruit and gamepass trade values are customer proposals. The site never claims to know volatile live market values; staff will verify and confirm final agreed values with you before in-game trading begins.
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Order Review & Summary
            </h3>

            {/* Service & Pricing Card */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase">{selectedService?.category}</span>
                  <h4 className="text-base font-bold text-white">{selectedService?.name}</h4>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-slate-500 block">Total Trade Value</span>
                  <span className="text-lg font-bold text-amber-400">{selectedService?.priceM}M</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900 text-xs font-mono">
                <div className="text-slate-300">
                  <span className="text-[10px] text-slate-500 block">50% Deposit (Upfront)</span>
                  <span className="text-amber-300 font-bold">{depositString}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-[10px] text-slate-500 block">50% Remaining (On Completion)</span>
                  <span className="font-bold">{remainingString}</span>
                </div>
              </div>
            </div>

            {/* Player Information */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
                Player Details
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Roblox Username:</span>
                <span className="text-white font-mono font-bold">{robloxUsername}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Timezone:</span>
                <span className="text-slate-200">{timezone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Play Hours:</span>
                <span className="text-slate-200">{availability}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Payment Category:</span>
                <span className="text-slate-200 capitalize">{paymentType}</span>
              </div>
            </div>

            {/* Proposed Items Offered */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Offered Items ({items.filter(i => i.itemName).length})
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  Proposed: {totalProposedString}
                </span>
              </div>
              <div className="divide-y divide-slate-900">
                {items.filter(i => i.itemName).map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-white font-medium">{item.itemName}</span>
                      <span className="text-slate-500 ml-2">×{item.quantity}</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      {parseFloat(String(item.proposedValueM)).toFixed(2)}M each
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Note (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Additional Notes or Special Requests (Optional)
              </label>
              <textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="e.g. Need carry after 8pm, prefer private server, already have fragment count ready..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Critical Policy Checklist */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 space-y-2">
              <div className="font-semibold text-white">Before You Confirm:</div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-amber-200/90 leading-relaxed">
                <li>No real cash (USD, INR) is ever exchanged. Only in-game fruits/gamepasses.</li>
                <li>50% deposit must be traded in-game to staff before the carry begins.</li>
                <li>Staff will verify all item trade values before initiating the in-game trade.</li>
                <li>Do not drop fruits on the ground — all trades use the safe in-game trade window.</li>
              </ul>
            </div>

            {/* Public Proof Showcase Consent (Optional) */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={consentPublicProofs}
                onChange={(e) => setConsentPublicProofs(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-xs text-slate-300">
                <strong className="text-white block mb-0.5">Showcase on Public Proofs Wall (Optional)</strong>
                I consent to having my carry completion screenshots and order displayed on the public Proofs page once verified by staff.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* NAVIGATION CONTROLS */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <span>Next Step</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitOrder}
            className={`px-8 py-3 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 flex items-center gap-2 active:scale-95 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>{isSubmitting ? 'Submitting Order...' : 'Confirm & Place Order'}</span>
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
