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
  consentPublicProofs?: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments: OrderPayment[];
  timeline: OrderTimelineEvent[];
}

export type EnquiryStatus = 'pending' | 'in_progress' | 'resolved';
export type EnquirySource = 'website' | 'discord' | 'direct';

export interface Enquiry {
  id: string;
  source: EnquirySource;
  customerName?: string | null;
  robloxUsername: string;
  discordTag?: string | null;
  orderCodeOrId?: string | null;
  subject: string;
  message: string;
  status: EnquiryStatus;
  staffNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateEnquiryPayload = Omit<Enquiry, 'id' | 'createdAt' | 'updatedAt' | 'staffNotes'> & {
  staffNotes?: string | null;
};

export type EvidenceType = 'screenshot' | 'video_link' | 'screen_share_session';

export interface ServiceEvidence {
  id: string;
  orderId: string;
  orderCode?: string;
  serviceId: string;
  serviceName?: string;
  serviceCategory?: string;
  robloxUsername?: string;
  robloxUsernameMasked?: string;
  evidenceType: EvidenceType;
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

export interface OngoingServiceItem {
  orderCode: string;
  serviceName: string;
  serviceCategory: string;
  robloxUsernameDisplay: string;
  status: OrderStatus;
  paymentType: string;
  updatedAt: string;
  hasLiveScreenShare?: boolean;
}
