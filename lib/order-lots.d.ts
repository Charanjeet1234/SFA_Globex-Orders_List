import type { Order, OrderLot, OrderStage } from '../src/types';

export const LOT_SPLIT_THRESHOLD_MT: number;

export interface LotPricing {
  unitPriceUSD: number;
  unitPriceAED: number;
  exchangeRate: number;
}

export interface LotPaymentState {
  defaultStage?: OrderStage;
  advanceReceived?: boolean;
  fullyPaid?: boolean;
}

export function roundQuantity(value: unknown): number;
export function isLotSplitEligible(quantity: number, unit: Order['unit']): boolean;
export function distributeLotQuantities(totalQuantity: number, lotCount: number): number[];
export function normalizeLot(lot: Partial<OrderLot>, index: number, pricing: LotPricing, paymentState?: LotPaymentState): OrderLot;
export function normalizeLots(lots: OrderLot[] | undefined, pricing: LotPricing, paymentState?: LotPaymentState): OrderLot[];
export function isLotAdvanceStage(stage: OrderStage): boolean;
export function createLots(options: LotPricing & {
  quantity: number;
  lotCount: number;
  advancePercent?: number;
  currentStage?: OrderStage;
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
export function getLotStageRollup(lots: OrderLot[] | undefined, fallbackStage?: OrderStage): OrderStage;
export function applyLotAdvancePayment(lots: OrderLot[] | undefined, totalPaidUSD: number, pricing: LotPricing): OrderLot[];
export function recordLotAdvance(lot: OrderLot, receivedAdvanceUSD: number, pricing: LotPricing): OrderLot;
export function getLotStage(lot: Partial<OrderLot>, defaultStage?: OrderStage): OrderStage;
export function isValidLotDistribution(lots: OrderLot[] | undefined, totalQuantity: number): boolean;
