import type { Order, OrderLot } from '../src/types';

export const LOT_SPLIT_THRESHOLD_MT: number;

export interface LotPricing {
  unitPriceUSD: number;
  unitPriceAED: number;
  exchangeRate: number;
}

export interface LotPaymentState {
  advanceReceived?: boolean;
  fullyPaid?: boolean;
}

export function roundQuantity(value: unknown): number;
export function isLotSplitEligible(quantity: number, unit: Order['unit']): boolean;
export function distributeLotQuantities(totalQuantity: number, lotCount: number): number[];
export function normalizeLot(lot: Partial<OrderLot>, index: number, pricing: LotPricing, paymentState?: LotPaymentState): OrderLot;
export function normalizeLots(lots: OrderLot[] | undefined, pricing: LotPricing, paymentState?: LotPaymentState): OrderLot[];
export function createLots(options: LotPricing & {
  quantity: number;
  lotCount: number;
  advancePercent?: number;
}): OrderLot[];
export function summarizeLots(lots: OrderLot[] | undefined): {
  quantity: number;
  advanceUSD: number;
  advanceAED: number;
  paidAdvanceUSD: number;
  paidAdvanceAED: number;
  balanceUSD: number;
  balanceAED: number;
};
export function getLotTotal(lot: Partial<OrderLot>): { usd: number; aed: number };
export function applyLotAdvancePayment(lots: OrderLot[] | undefined, totalPaidUSD: number, pricing: LotPricing): OrderLot[];
export function isValidLotDistribution(lots: OrderLot[] | undefined, totalQuantity: number): boolean;
