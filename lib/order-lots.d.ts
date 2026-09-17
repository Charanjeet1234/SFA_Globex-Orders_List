import type { Order, OrderLot } from '../src/types';

export const LOT_SPLIT_THRESHOLD_MT: number;

export interface LotPricing {
  unitPriceUSD: number;
  unitPriceAED: number;
  exchangeRate: number;
}

export function roundQuantity(value: unknown): number;
export function isLotSplitEligible(quantity: number, unit: Order['unit']): boolean;
export function distributeLotQuantities(totalQuantity: number, lotCount: number): number[];
export function normalizeLot(lot: Partial<OrderLot>, index: number, pricing: LotPricing): OrderLot;
export function normalizeLots(lots: OrderLot[] | undefined, pricing: LotPricing): OrderLot[];
export function createLots(options: LotPricing & {
  quantity: number;
  lotCount: number;
  advancePercent?: number;
}): OrderLot[];
export function summarizeLots(lots: OrderLot[] | undefined): {
  quantity: number;
  advanceUSD: number;
  advanceAED: number;
  balanceUSD: number;
  balanceAED: number;
};
export function isValidLotDistribution(lots: OrderLot[] | undefined, totalQuantity: number): boolean;
