import fs from 'fs';
import path from 'path';
import { INITIAL_SERVICES, ServiceSeedItem } from './seed-data.ts';
import { toHundredths } from '../lib/calculator.ts';
import { ensureDatabaseConfigured } from './neon.ts';

export interface ServiceRecord {
  id: string;
  category: string;
  slug: string;
  name: string;
  description: string;
  priceHundredths: number;
  priceM: string;
  prerequisites?: string | null;
  exclusions?: string | null;
  isPublished: boolean;
  needsConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRecord {
  id: string;
  publicToken: string;
  orderCode: string;
  serviceId: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  status: 
    | 'pending_review' 
    | 'accepted' 
    | 'more_info_needed' 
    | 'deposit_received' 
    | 'in_progress' 
    | 'completed' 
    | 'fully_paid' 
    | 'rejected' 
    | 'cancelled';
  totalPriceHundredths: number;
  depositHundredths: number;
  remainingHundredths: number;
  customerNote?: string | null;
  staffNotes?: string | null;
  consentPublicProofs?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  itemName: string;
  quantity: number;
  proposedValueHundredths: number;
  agreedValueHundredths?: number | null;
  verified: boolean;
}

export type OrderItemInput = Omit<OrderItemRecord, 'id' | 'orderId' | 'verified'> & {
  verified?: boolean;
};

export interface OrderAuditRecord {
  id: string;
  orderId: string;
  actor: 'customer' | 'staff' | 'system';
  action: string;
  note?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  kind: 'deposit' | 'remaining';
  amountHundredths: number;
  itemsJson: string; // JSON array of items accepted
  recordedBy: string;
  recordedAt: string;
}

export interface EnquiryRecord {
  id: string;
  source: 'website' | 'discord' | 'direct';
  customerName?: string | null;
  robloxUsername: string;
  discordTag?: string | null;
  orderCodeOrId?: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  staffNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  orderId: string;
  serviceId: string;
  evidenceType: 'screenshot' | 'video_link' | 'screen_share_session';
  mediaUrl: string;
  notes?: string | null;
  customerConsentPublic: boolean;
  staffApprovedPublic: boolean;
  isOngoing: boolean;
  isCompleted: boolean;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

interface DatabaseState {
  services: ServiceRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  orderAudit: OrderAuditRecord[];
  payments: PaymentRecord[];
  enquiries: EnquiryRecord[];
  evidence: EvidenceRecord[];
  counter: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState(): DatabaseState {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.services)) {
        if (!Array.isArray(parsed.enquiries)) parsed.enquiries = [];
        if (!Array.isArray(parsed.evidence)) parsed.evidence = [];
        return parsed;
      }
    } catch (e) {
      console.error('Failed reading db.json, re-initializing', e);
    }
  }

  // Initial seed
  const seededServices: ServiceRecord[] = INITIAL_SERVICES.map((s) => ({
    id: s.id,
    category: s.category,
    slug: s.slug,
    name: s.name,
    description: s.description,
    priceHundredths: toHundredths(s.priceM),
    priceM: s.priceM.toFixed(2),
    prerequisites: s.prerequisites || null,
    exclusions: s.exclusions || null,
    isPublished: s.isPublished,
    needsConfirmation: s.needsConfirmation,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const initial: DatabaseState = {
    services: seededServices,
    orders: [],
    orderItems: [],
    orderAudit: [],
    payments: [],
    enquiries: [],
    evidence: [],
    counter: 1040,
  };

  saveState(initial);
  return initial;
}

function saveState(state: DatabaseState) {
  ensureDataDir();
  const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

// Memory cache + write-through
let stateCache: DatabaseState | null = null;
function getState(): DatabaseState {
  ensureDatabaseConfigured();
  if (!stateCache) {
    stateCache = loadState();
  }
  return stateCache;
}

function commitState() {
  if (stateCache) {
    saveState(stateCache);
  }
}

export const dbRepository = {
  // Services
  getServices(options?: { onlyPublished?: boolean; onlyUncertain?: boolean }): ServiceRecord[] {
    const s = getState();
    let result = [...s.services];
    if (options?.onlyPublished) {
      result = result.filter(item => item.isPublished);
    }
    if (options?.onlyUncertain) {
      result = result.filter(item => item.needsConfirmation);
    }
    return result;
  },

  getServiceById(id: string): ServiceRecord | undefined {
    return getState().services.find(s => s.id === id);
  },

  getServiceBySlug(slug: string): ServiceRecord | undefined {
    return getState().services.find(s => s.slug === slug);
  },

  createService(data: Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>): ServiceRecord {
    const s = getState();
    const id = `svc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newService: ServiceRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    s.services.push(newService);
    commitState();
    return newService;
  },

  updateService(id: string, updates: Partial<Omit<ServiceRecord, 'id' | 'createdAt'>>): ServiceRecord | null {
    const s = getState();
    const index = s.services.findIndex(item => item.id === id);
    if (index === -1) return null;

    s.services[index] = {
      ...s.services[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    commitState();
    return s.services[index];
  },

  deleteService(id: string): boolean {
    const s = getState();
    const lenBefore = s.services.length;
    s.services = s.services.filter(item => item.id !== id);
    if (s.services.length !== lenBefore) {
      commitState();
      return true;
    }
    return false;
  },

  // Orders
  getNextOrderCode(): string {
    const s = getState();
    s.counter += 1;
    commitState();
    return `BFS-${s.counter}`;
  },

  createOrder(
    order: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>,
    items: OrderItemInput[]
  ): { order: OrderRecord; items: OrderItemRecord[] } {
    const s = getState();
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newOrder: OrderRecord = {
      ...order,
      consentPublicProofs: Boolean(order.consentPublicProofs),
      id: orderId,
      createdAt: now,
      updatedAt: now,
    };

    const newItems: OrderItemRecord[] = items.map((it, idx) => ({
      ...it,
      id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      orderId,
      verified: it.verified ?? false,
    }));

    s.orders.push(newOrder);
    s.orderItems.push(...newItems);

    // Initial audit entry
    s.orderAudit.push({
      id: `aud-${Date.now()}`,
      orderId,
      actor: 'customer',
      action: 'ORDER_SUBMITTED',
      note: `Order submitted for ${order.paymentType} payment. Total: ${(order.totalPriceHundredths / 100).toFixed(2)}M.`,
      createdAt: now,
    });

    commitState();
    return { order: newOrder, items: newItems };
  },

  getOrderById(id: string): OrderRecord | undefined {
    return getState().orders.find(o => o.id === id);
  },

  getOrderByPublicToken(token: string): OrderRecord | undefined {
    return getState().orders.find(o => o.publicToken === token);
  },

  getOrderByCode(code: string): OrderRecord | undefined {
    return getState().orders.find(o => o.orderCode.toUpperCase() === code.toUpperCase().trim());
  },

  listOrders(filters?: { status?: string; search?: string }): OrderRecord[] {
    const s = getState();
    let result = [...s.orders];

    if (filters?.status && filters.status !== 'all') {
      result = result.filter(o => o.status === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(o => 
        o.orderCode.toLowerCase().includes(q) ||
        o.robloxUsername.toLowerCase().includes(q)
      );
    }

    // Newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  updateOrderStatus(
    orderId: string, 
    newStatus: OrderRecord['status'], 
    actor: 'staff' | 'system', 
    note?: string
  ): OrderRecord | null {
    const s = getState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return null;

    const oldStatus = order.status;
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();

    s.orderAudit.push({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      orderId,
      actor,
      action: `STATUS_CHANGE_${oldStatus.toUpperCase()}_TO_${newStatus.toUpperCase()}`,
      note: note || `Status changed to ${newStatus}`,
      createdAt: new Date().toISOString(),
    });

    commitState();
    return order;
  },

  updateOrderStaffNotes(orderId: string, staffNotes: string): OrderRecord | null {
    const s = getState();
    const order = s.orders.find(o => o.id === orderId);
    if (!order) return null;
    order.staffNotes = staffNotes;
    order.updatedAt = new Date().toISOString();
    commitState();
    return order;
  },

  // Order Items
  getOrderItems(orderId: string): OrderItemRecord[] {
    return getState().orderItems.filter(i => i.orderId === orderId);
  },

  updateOrderItem(
    itemId: string, 
    updates: { agreedValueHundredths?: number | null; verified?: boolean }
  ): OrderItemRecord | null {
    const s = getState();
    const item = s.orderItems.find(i => i.id === itemId);
    if (!item) return null;

    if (updates.agreedValueHundredths !== undefined) {
      item.agreedValueHundredths = updates.agreedValueHundredths;
    }
    if (updates.verified !== undefined) {
      item.verified = updates.verified;
    }

    commitState();
    return item;
  },

  // Audit Logs
  addAuditLog(orderId: string, actor: 'customer' | 'staff' | 'system', action: string, note?: string) {
    const s = getState();
    const entry: OrderAuditRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      orderId,
      actor,
      action,
      note: note || null,
      createdAt: new Date().toISOString(),
    };
    s.orderAudit.push(entry);
    commitState();
    return entry;
  },

  getOrderAuditLogs(orderId: string): OrderAuditRecord[] {
    return getState().orderAudit
      .filter(a => a.orderId === orderId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  // Payments
  recordPayment(
    orderId: string, 
    kind: 'deposit' | 'remaining', 
    amountHundredths: number, 
    itemsJson: string, 
    recordedBy: string
  ): PaymentRecord {
    const s = getState();
    const payment: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      orderId,
      kind,
      amountHundredths,
      itemsJson,
      recordedBy,
      recordedAt: new Date().toISOString(),
    };
    s.payments.push(payment);

    s.orderAudit.push({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      orderId,
      actor: 'staff',
      action: `PAYMENT_RECORDED_${kind.toUpperCase()}`,
      note: `Staff '${recordedBy}' recorded ${kind} payment of ${(amountHundredths / 100).toFixed(2)}M. Items: ${itemsJson}`,
      createdAt: new Date().toISOString(),
    });

    commitState();
    return payment;
  },

  getOrderPayments(orderId: string): PaymentRecord[] {
    return getState().payments.filter(p => p.orderId === orderId);
  },

  // Enquiries (Customer Service)
  createEnquiry(data: Omit<EnquiryRecord, 'id' | 'createdAt' | 'updatedAt'>): EnquiryRecord {
    const s = getState();
    const id = `enq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newEnquiry: EnquiryRecord = {
      ...data,
      id,
      status: data.status || 'pending',
      createdAt: now,
      updatedAt: now,
    };
    s.enquiries.push(newEnquiry);
    commitState();
    return newEnquiry;
  },

  listEnquiries(filters?: { status?: string; search?: string }): EnquiryRecord[] {
    const s = getState();
    let result = [...s.enquiries];

    if (filters?.status && filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(e =>
        e.robloxUsername.toLowerCase().includes(q) ||
        (e.orderCodeOrId && e.orderCodeOrId.toLowerCase().includes(q)) ||
        (e.discordTag && e.discordTag.toLowerCase().includes(q)) ||
        e.subject.toLowerCase().includes(q)
      );
    }

    // Newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  getEnquiryById(id: string): EnquiryRecord | undefined {
    return getState().enquiries.find(e => e.id === id);
  },

  updateEnquiryStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'resolved',
    staffNotes?: string
  ): EnquiryRecord | null {
    const s = getState();
    const enquiry = s.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    enquiry.status = status;
    if (staffNotes !== undefined) {
      enquiry.staffNotes = staffNotes;
    }
    enquiry.updatedAt = new Date().toISOString();
    commitState();
    return enquiry;
  },

  // Service Evidence & Proofs
  createEvidence(data: Omit<EvidenceRecord, 'id' | 'createdAt'>): EvidenceRecord {
    const s = getState();
    const id = `evi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newEvidence: EvidenceRecord = {
      ...data,
      id,
      createdAt: now,
    };
    s.evidence.push(newEvidence);
    commitState();
    return newEvidence;
  },

  getEvidenceByOrderId(orderId: string): EvidenceRecord[] {
    return getState().evidence.filter(e => e.orderId === orderId);
  },

  listEvidence(filters?: { isCompleted?: boolean; staffApprovedPublic?: boolean }): EvidenceRecord[] {
    const s = getState();
    let result = [...s.evidence];
    if (filters?.isCompleted !== undefined) {
      result = result.filter(e => e.isCompleted === filters.isCompleted);
    }
    if (filters?.staffApprovedPublic !== undefined) {
      result = result.filter(e => e.staffApprovedPublic === filters.staffApprovedPublic);
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  },

  updateEvidenceApproval(
    id: string,
    staffApprovedPublic: boolean,
    reviewedBy: string
  ): EvidenceRecord | null {
    const s = getState();
    const ev = s.evidence.find(e => e.id === id);
    if (!ev) return null;

    ev.staffApprovedPublic = staffApprovedPublic;
    ev.reviewedAt = new Date().toISOString();
    ev.reviewedBy = reviewedBy;
    commitState();
    return ev;
  },

  /**
   * Public Proofs:
   * STRICT REQUIREMENT: Only returns evidence where customerConsentPublic === true
   * AND staffApprovedPublic === true AND isCompleted === true.
   */
  getPublicProofs() {
    const s = getState();
    const approved = s.evidence.filter(
      e => e.customerConsentPublic === true && e.staffApprovedPublic === true && e.isCompleted === true
    );

    return approved.map(ev => {
      const order = s.orders.find(o => o.id === ev.orderId);
      const service = s.services.find(svc => svc.id === ev.serviceId);

      // Mask username if needed or show full username if customer explicitly consented
      const fullUsername = order ? order.robloxUsername : 'BloxPlayer';
      const usernameDisplay = ev.customerConsentPublic ? fullUsername : `${fullUsername.slice(0, 2)}***`;

      return {
        id: ev.id,
        orderId: ev.orderId,
        orderCode: order ? order.orderCode : 'BFS-XXXX',
        serviceId: ev.serviceId,
        serviceName: service ? service.name : 'Blox Fruit Service',
        serviceCategory: service ? service.category : 'Carries',
        robloxUsername: usernameDisplay,
        evidenceType: ev.evidenceType,
        mediaUrl: ev.mediaUrl,
        notes: ev.notes,
        customerConsentPublic: ev.customerConsentPublic,
        staffApprovedPublic: ev.staffApprovedPublic,
        createdAt: ev.createdAt,
        reviewedAt: ev.reviewedAt,
      };
    });
  },

  /**
   * Ongoing Services (Active carries queue):
   * Transparent live view of orders currently accepted, deposit_received, or in_progress.
   * STRICT REQUIREMENT: Anonymizes / masks usernames UNLESS customer consented to public display.
   */
  getOngoingCarries() {
    const s = getState();
    const activeOrders = s.orders.filter(o => 
      ['accepted', 'deposit_received', 'in_progress'].includes(o.status)
    );

    return activeOrders.map(o => {
      const service = s.services.find(svc => svc.id === o.serviceId);
      const evidence = s.evidence.filter(e => e.orderId === o.id);
      const hasLiveScreenShare = evidence.some(e => e.evidenceType === 'screen_share_session');

      // Privacy masking: Only display full username if customer consented
      let usernameDisplay = 'Client_***';
      if (o.consentPublicProofs) {
        usernameDisplay = o.robloxUsername;
      } else if (o.robloxUsername.length > 3) {
        usernameDisplay = `${o.robloxUsername.slice(0, 2)}***${o.robloxUsername.slice(-1)}`;
      }

      return {
        orderCode: o.orderCode,
        serviceName: service ? service.name : 'Blox Fruit Carry',
        serviceCategory: service ? service.category : 'General',
        robloxUsernameDisplay: usernameDisplay,
        status: o.status,
        paymentType: o.paymentType,
        updatedAt: o.updatedAt,
        hasLiveScreenShare,
      };
    });
  },

  // Helper to reset to seed for test suite
  _resetForTesting() {
    stateCache = null;
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    return loadState();
  }
};
