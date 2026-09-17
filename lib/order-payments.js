import { getLotStage, getLotStageRollup, normalizeLots, summarizeLots } from './order-lots.js';

// An agreed advance is not cash received until its payment stage is confirmed.
const receivedStages = new Set(['advance_received', 'date_of_shipment', 'shipment_dispatched', 'bl_received', 'got_full_money', 'bl_surrender']);
export function hasAdvanceReceived(order) {
  if (Array.isArray(order?.lots) && order.lots.length > 0) {
    // A receipt entered before the lot reaches Advance Paid is still pending;
    // only the lot's stage confirms that it can reduce the final amount.
    return order.lots.some((lot) => receivedStages.has(getLotStage(lot, 'pi_issued')));
  }
  return receivedStages.has(order.currentStage) || Boolean(order.stagesHistory?.advance_received?.completedAt)
    || Boolean(order.stagesHistory?.got_full_money?.completedAt);
}
export function normalizeOrderPayments(order) {
  const lotPricing = {
    unitPriceUSD: order.unitPriceUSD,
    unitPriceAED: order.unitPriceAED,
    exchangeRate: order.exchangeRateUsdToAed,
  };
  const fullByStage = ['got_full_money', 'bl_surrender'].includes(order.currentStage)
    || Boolean(order.stagesHistory?.got_full_money?.completedAt);
  const lots = normalizeLots(order.lots, lotPricing, {
    defaultStage: order.currentStage,
  });
  if (lots.length > 0) {
    const totals = summarizeLots(lots);
    const fullByLots = lots.every((lot) => lot.status === 'fully_paid');
    const rolledUpStage = getLotStageRollup(lots, order.currentStage);
    const allLotsSurrendered = lots.every((lot) => getLotStage(lot, 'pi_issued') === 'bl_surrender');
    return {
      ...order,
      lots,
      // A split order's parent is only a rollup. The least-advanced lot is
      // surfaced as the parent stage; no parent stage can mutate siblings.
      currentStage: rolledUpStage,
      isWaitingForBuyerPI: lots.some((lot) => getLotStage(lot, 'pi_issued') === 'pi_issued'),
      advancePaymentUSD: totals.advanceUSD,
      advancePaymentAED: totals.advanceAED,
      balancePaymentUSD: totals.balanceUSD,
      balancePaymentAED: totals.balanceAED,
      isFullPaymentReceived: fullByLots,
      isCompleted: allLotsSurrendered,
      isOverdue: fullByLots ? false : order.isOverdue,
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
