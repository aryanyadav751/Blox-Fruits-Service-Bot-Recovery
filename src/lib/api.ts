import { 
  Service, 
  PublicOrder, 
  ProposedItem, 
  Enquiry, 
  CreateEnquiryPayload,
  ServiceEvidence,
  OngoingServiceItem 
} from '../types/index.ts';

export interface CreateOrderPayload {
  serviceId: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  items: ProposedItem[];
  customerNote?: string;
  consentPublicProofs?: boolean;
}

export interface CreateOrderResponse {
  success: boolean;
  orderCode?: string;
  publicToken?: string;
  orderId?: string;
  serviceName?: string;
  totalPriceM?: string;
  depositM?: string;
  remainingM?: string;
  error?: string;
}

export const api = {
  async getServices(): Promise<Service[]> {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch services');
    }
    return data.services;
  },

  async getService(slugOrId: string): Promise<Service> {
    const res = await fetch(`/api/services/${encodeURIComponent(slugOrId)}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch service');
    }
    return data.service;
  },

  async submitOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit order');
    }
    return data;
  },

  async getOrderStatus(publicToken: string): Promise<PublicOrder> {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(publicToken)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Order not found or invalid link');
    }
    return data.order;
  },

  // --- CUSTOMER SERVICE (SUPPORT) ---
  async submitEnquiry(payload: {
    robloxUsername: string;
    customerName?: string;
    discordTag?: string;
    orderCodeOrId?: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; enquiryId: string; message: string }> {
    const res = await fetch('/api/support/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit support enquiry');
    }
    return data;
  },

  // --- PROOFS & ONGOING CARRIES ---
  async getPublicProofs(): Promise<ServiceEvidence[]> {
    const res = await fetch('/api/proofs');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch proofs');
    }
    return data.proofs;
  },

  async getOngoingCarries(): Promise<OngoingServiceItem[]> {
    const res = await fetch('/api/ongoing');
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch active carries');
    }
    return data.activeCarries;
  },

  // --- ADMIN AUTH (HTTP-ONLY COOKIES FOR SECURITY) ---
  async adminLogin(password: string): Promise<{ success: boolean; role: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    return data;
  },

  async adminLogout(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
  },

  async adminCheckSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/me', {
        credentials: 'include',
      });
      const data = await res.json();
      return Boolean(res.ok && data.success);
    } catch {
      return false;
    }
  },

  // --- ADMIN ORDERS ---
  async adminGetOrders(status?: string, search?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/orders?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch admin orders');
    }
    return data.orders;
  },

  async adminGetOrder(id: string): Promise<any> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch order detail');
    }
    return data.order;
  },

  async adminUpdateOrderStatus(id: string, status: string, note?: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update order status');
    }
  },

  async adminUpdateItemValuation(orderId: string, itemId: string, agreedValueM: number | null, verified: boolean): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreedValueM, verified }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update item valuation');
    }
  },

  async adminRecordPayment(orderId: string, kind: 'deposit' | 'remaining', amountM: number, itemsJson: string, staffName: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, amountM, itemsJson, staffName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record payment');
    }
  },

  async adminUpdateStaffNotes(orderId: string, staffNotes: string): Promise<void> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update staff notes');
    }
  },

  // --- STAFF SUPPORT INBOX ---
  async adminGetEnquiries(status?: string, search?: string): Promise<Enquiry[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/enquiries?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch enquiries');
    }
    return data.enquiries;
  },

  async adminCreateManualEnquiry(payload: CreateEnquiryPayload): Promise<Enquiry> {
    const res = await fetch('/api/admin/enquiries', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to log manual enquiry');
    }
    return data.enquiry;
  },

  async adminUpdateEnquiryStatus(id: string, status: 'pending' | 'in_progress' | 'resolved', staffNotes?: string): Promise<Enquiry> {
    const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, staffNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update enquiry status');
    }
    return data.enquiry;
  },

  // --- EVIDENCE & PROOFS MODERATION ---
  async adminGetOrderEvidence(orderId: string): Promise<ServiceEvidence[]> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/evidence`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch evidence');
    }
    return data.evidence;
  },

  async adminRecordOrderEvidence(orderId: string, payload: {
    evidenceType: 'screenshot' | 'video_link' | 'screen_share_session';
    mediaUrl: string;
    notes?: string;
    customerConsentPublic: boolean;
    staffApprovedPublic: boolean;
    isOngoing?: boolean;
    isCompleted?: boolean;
  }): Promise<ServiceEvidence> {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/evidence`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record evidence');
    }
    return data.evidence;
  },

  async adminToggleEvidenceApproval(evidenceId: string, staffApprovedPublic: boolean): Promise<ServiceEvidence> {
    const res = await fetch(`/api/admin/evidence/${encodeURIComponent(evidenceId)}/approval`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffApprovedPublic }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to toggle evidence approval');
    }
    return data.evidence;
  },

  // --- CATALOG CRUD ---
  async adminGetCatalog(): Promise<Service[]> {
    const res = await fetch('/api/admin/catalog', {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch catalog');
    }
    return data.services;
  },

  async adminCreateService(payload: Partial<Service>): Promise<Service> {
    const res = await fetch('/api/admin/catalog', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create service');
    }
    return data.service;
  },

  async adminUpdateService(id: string, updates: Partial<Service>): Promise<Service> {
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update service');
    }
    return data.service;
  },

  async adminDeleteService(id: string): Promise<void> {
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete service');
    }
  },
};
