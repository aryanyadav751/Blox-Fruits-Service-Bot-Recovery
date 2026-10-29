export interface Service {
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

export interface ProposedItem {
  itemName: string;
  quantity: number;
  proposedValueM: number | string;
}

export interface OrderItem {
  itemName: string;
  quantity: number;
  proposedValueM: string;
  agreedValueM?: string | null;
  verified: boolean;
}

export interface OrderPayment {
  kind: 'deposit' | 'remaining';
  amountM: string;
  recordedAt: string;
}

export interface OrderTimelineEvent {
  action: string;
  note?: string | null;
  createdAt: string;
  actor: string;
}

export type OrderStatus = 
  | 'pending_review' 
  | 'accepted' 
  | 'more_info_needed' 
  | 'deposit_received' 
  | 'in_progress' 
  | 'completed' 
  | 'fully_paid' 
  | 'rejected' 
  | 'cancelled';

export interface PublicOrder {
  orderCode: string;
  publicToken: string;
  serviceName: string;
  serviceCategory: string;
  robloxUsername: string;
  timezone: string;
  availability: string;
  paymentType: 'fruits' | 'gamepass' | 'combination';
  status: OrderStatus;
  totalPriceM: string;
  depositM: string;
  remainingM: string;
  customerNote?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments: OrderPayment[];
  timeline: OrderTimelineEvent[];
}
