import { Service, PublicOrder, ProposedItem } from '../types/index.ts';

export interface CreateOrderPayload {
  serviceId: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  items: ProposedItem[];
  customerNote?: string;
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

  // --- ADMIN API ---
  getStoredStaffToken(): string | null {
    return localStorage.getItem('bfs_staff_token');
  },

  setStoredStaffToken(token: string | null) {
    if (token) {
      localStorage.setItem('bfs_staff_token', token);
    } else {
      localStorage.removeItem('bfs_staff_token');
    }
  },

  async adminLogin(password: string): Promise<{ success: boolean; token: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    this.setStoredStaffToken(data.token);
    return data;
  },

  async adminLogout(): Promise<void> {
    const token = this.getStoredStaffToken();
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } finally {
      this.setStoredStaffToken(null);
    }
  },

  async adminCheckSession(): Promise<boolean> {
    const token = this.getStoredStaffToken();
    try {
      const res = await fetch('/api/admin/me', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      return Boolean(res.ok && data.success);
    } catch {
      return false;
    }
  },

  async adminGetOrders(status?: string, search?: string): Promise<any[]> {
    const token = this.getStoredStaffToken();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/orders?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch admin orders');
    }
    return data.orders;
  },

  async adminGetOrder(id: string): Promise<any> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch order detail');
    }
    return data.order;
  },

  async adminUpdateOrderStatus(id: string, status: string, note?: string): Promise<void> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update order status');
    }
  },

  async adminUpdateItemValuation(orderId: string, itemId: string, agreedValueM: number | null, verified: boolean): Promise<void> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ agreedValueM, verified }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update item valuation');
    }
  },

  async adminRecordPayment(orderId: string, kind: 'deposit' | 'remaining', amountM: number, itemsJson: string, staffName: string): Promise<void> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, amountM, itemsJson, staffName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record payment');
    }
  },

  async adminUpdateStaffNotes(orderId: string, staffNotes: string): Promise<void> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ staffNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update staff notes');
    }
  },

  // Catalog CRUD for Stage 4
  async adminGetCatalog(): Promise<Service[]> {
    const token = this.getStoredStaffToken();
    const res = await fetch('/api/admin/catalog', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch catalog');
    }
    return data.services;
  },

  async adminCreateService(payload: Partial<Service>): Promise<Service> {
    const token = this.getStoredStaffToken();
    const res = await fetch('/api/admin/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create service');
    }
    return data.service;
  },

  async adminUpdateService(id: string, updates: Partial<Service>): Promise<Service> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update service');
    }
    return data.service;
  },

  async adminDeleteService(id: string): Promise<void> {
    const token = this.getStoredStaffToken();
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete service');
    }
  },
};
