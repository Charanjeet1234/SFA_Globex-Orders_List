import { normalizeLots, summarizeLots } from './order-lots.js';

// An agreed advance is not cash received until its payment stage is confirmed.
const receivedStages = new Set(['advance_received', 'date_of_shipment', 'shipment_dispatched', 'bl_received', 'got_full_money', 'bl_surrender']);
export function hasAdvanceReceived(order) {
  return receivedStages.has(order.currentStage) || Boolean(order.stagesHistory?.advance_received?.completedAt)
    || Boolean(order.stagesHistory?.got_full_money?.completedAt);
}
export function normalizeOrderPayments(order) {
  const lotPricing = {
    unitPriceUSD: order.unitPriceUSD,
    unitPriceAED: order.unitPriceAED,
    exchangeRate: order.exchangeRateUsdToAed,
  };
  const lots = normalizeLots(order.lots, lotPricing);
  if (lots.length > 0) {
    const totals = summarizeLots(lots);
    const fullByStage = ['got_full_money', 'bl_surrender'].includes(order.currentStage)
      || Boolean(order.stagesHistory?.got_full_money?.completedAt);
    const fullByLots = lots.every((lot) => lot.status === 'fully_paid');
    const full = fullByStage || fullByLots;
    return {
      ...order,
      lots,
      advancePaymentUSD: totals.advanceUSD,
      advancePaymentAED: totals.advanceAED,
      balancePaymentUSD: full ? 0 : totals.balanceUSD,
      balancePaymentAED: full ? 0 : totals.balanceAED,
      isFullPaymentReceived: full,
      isOverdue: full ? false : order.isOverdue,
    };
  }

  const received = hasAdvanceReceived(order);
  const full = ['got_full_money', 'bl_surrender'].includes(order.currentStage)
    || Boolean(order.stagesHistory?.got_full_money?.completedAt)
    || (received && (order.isFullPaymentReceived || order.advancePaymentUSD >= order.totalAmountUSD));
  return {
    ...order,
    balancePaymentUSD: full ? 0 : Math.max(0, order.totalAmountUSD - (received ? order.advancePaymentUSD : 0)),
    balancePaymentAED: full ? 0 : Math.max(0, order.totalAmountAED - (received ? order.advancePaymentAED : 0)),
    isFullPaymentReceived: full,
    isOverdue: full ? false : order.isOverdue,
  };
}
export function receivedPaymentUSD(order) {
  return order.totalAmountUSD - normalizeOrderPayments(order).balancePaymentUSD;
}
export function receivedPaymentAED(order) {
  return order.totalAmountAED - normalizeOrderPayments(order).balancePaymentAED;
}
