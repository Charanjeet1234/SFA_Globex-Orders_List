export type OrderStage =
  | 'pi_issued'
  | 'pi_signed'
  | 'advance_received'
  | 'date_of_shipment'
  | 'shipment_dispatched'
  | 'bl_received'
  | 'got_full_money'
  | 'bl_surrender';

export interface StageInfo {
  id: OrderStage;
  label: string;
  stepNumber: number;
  description: string;
  shortName: string;
}

export const ORDER_STAGES: StageInfo[] = [
  { 
    id: 'pi_issued', 
    label: 'PI issued (waiting for buyer signature)', 
    stepNumber: 1, 
    description: 'Only PI issued from company; waiting for signed PI from buyer', 
    shortName: 'PI Issued' 
  },
  { 
    id: 'pi_signed', 
    label: 'PI signed from buyer', 
    stepNumber: 2, 
    description: 'Proforma Invoice signed & accepted by buyer', 
    shortName: 'PI Signed' 
  },
  { 
    id: 'advance_received', 
    label: 'Advance received', 
    stepNumber: 3, 
    description: 'Agreed advance deposit credited to trade account', 
    shortName: 'Advance Paid' 
  },
  { 
    id: 'date_of_shipment', 
    label: 'Date of shipment', 
    stepNumber: 4, 
    description: 'Vessel booking confirmed & cargo loading scheduled', 
    shortName: 'Shipment Scheduled' 
  },
  { 
    id: 'shipment_dispatched', 
    label: 'Shipment dispatched', 
    stepNumber: 5, 
    description: 'Cargo departed from origin port; transit underway', 
    shortName: 'Dispatched' 
  },
  { 
    id: 'bl_received', 
    label: 'BL received', 
    stepNumber: 6, 
    description: 'Original / Sea Waybill Bill of Lading issued by carrier', 
    shortName: 'BL Received' 
  },
  { 
    id: 'got_full_money', 
    label: 'Got full money', 
    stepNumber: 7, 
    description: 'Balance payment confirmed; 100% funds settled', 
    shortName: 'Full Money Paid' 
  },
  { 
    id: 'bl_surrender', 
    label: 'BL surrender', 
    stepNumber: 8, 
    description: 'Bill of Lading surrendered / Telex release authorized to buyer', 
    shortName: 'BL Surrendered' 
  },
];

export interface StageRecord {
  stage: OrderStage;
  completedAt?: string; // ISO string
  scheduledDate?: string; // For date_of_shipment
  referenceNumber?: string; // e.g., PI#, Bank wire ref, Vessel name, BL#, Telex ref
  notes?: string;
  updatedBy?: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  contactPerson: string;
  email: string;
  phone: string;
  taxRegistrationNumber: string;
  paymentTerms: string; // e.g. "30% Advance, 70% against BL"
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB';
  totalOrdersCount: number;
  totalOrderVolumeUSD: number;
}

export type AedRatePreset = '3.6725' | '3.6745' | 'custom';

export type LotPaymentStatus = 'fully_paid' | 'partially_paid' | 'pending';

/**
 * Serialized with an order when a large MT order is split for shipment and
 * payment tracking. The snake_case keys intentionally match the API payload.
 */
export interface OrderLot {
  lot_number: number;
  quantity: number;
  advance_usd: number;
  advance_aed: number;
  balance_usd: number;
  balance_aed: number;
  status: LotPaymentStatus;
}

export interface Order {
  id: string; // e.g. "NX-2026-108"
  orderNumber: string;
  companyId: string;
  companyName: string;
  productName: string;
  category: string;
  quantity: number;
  unit: 'MT' | 'Containers (TEU)' | 'Barrels' | 'KG' | 'Units' | 'Pcs';
  
  // Pricing & Currencies
  exchangeRateUsdToAed: number; // e.g. 3.6725 or 3.6745 or custom
  unitPriceUSD: number;
  unitPriceAED: number;
  totalAmountUSD: number;
  totalAmountAED: number;
  advancePaymentUSD: number;
  advancePaymentAED: number;
  balancePaymentUSD: number; // Total less confirmed payments; planned advance is not deducted.
  balancePaymentAED: number; // Total less confirmed payments in AED.
  lots?: OrderLot[];

  // Lifecycle & Stages
  currentStage: OrderStage;
  isWaitingForBuyerPI?: boolean; // Only PI issued from company, awaiting buyer counter-signature
  stagesHistory: Record<OrderStage, StageRecord>;
  
  // Logistics & Dates
  orderDate: string; // YYYY-MM-DD
  year: number; // for quick year-wise grouping & searching
  month: string; // e.g. "2026-03"
  paymentDueDate: string;
  shipmentDate: string;
  originPort: string;
  destinationPort: string;
  carrierName?: string;
  vesselName?: string;
  containerNumber?: string;
  billOfLadingNumber?: string;

  // Status & Financial flags
  isFullPaymentReceived: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
  notes?: string;
  encryptedChecksum?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'owner' | 'finance' | 'logistics' | 'auditor';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  avatarUrl?: string;
  lastLogin: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE_ORDER' | 'UPDATE_STAGE' | 'RECORD_PAYMENT' | 'SURRENDER_BL' | 'EXPORT_REPORT' | 'SECURITY_BACKUP' | 'RESTORE_BACKUP' | 'LOGIN_MFA' | 'DELETE_ORDER' | 'AMEND_ORDER';
  targetId: string;
  targetType: 'ORDER' | 'PAYMENT' | 'STAGE' | 'REPORT' | 'SECURITY' | 'AUTH';
  details: string;
  ipAddress: string;
  securityHash: string;
}

export interface AlertNotification {
  id: string;
  type: 'overdue_payment' | 'pending_invoice' | 'shipment_due' | 'bl_action' | 'security_event';
  severity: 'critical' | 'warning' | 'info';
  orderId: string;
  orderNumber: string;
  companyName: string;
  title: string;
  message: string;
  amountUSD?: number;
  amountAED?: number;
  dueDate?: string;
  createdAt: string;
  isRead: boolean;
}

export interface MonthlyProjection {
  monthKey: string; // e.g. "2026-01", "2026-02"
  monthName: string; // e.g. "Jan 2026"
  orderCount: number;
  projectedRevenueUSD: number;
  projectedRevenueAED: number;
  confirmedCashUSD: number;
  pendingBalanceUSD: number;
  growthRatePercent: number;
}
