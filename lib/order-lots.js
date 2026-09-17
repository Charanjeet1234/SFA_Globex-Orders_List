export const LOT_SPLIT_THRESHOLD_MT = 224;

const QUANTITY_PRECISION = 100;

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function roundQuantity(value) {
  return Math.round(numberOrZero(value) * QUANTITY_PRECISION) / QUANTITY_PRECISION;
}

export function isLotSplitEligible(quantity, unit) {
  return unit === 'MT' && numberOrZero(quantity) > LOT_SPLIT_THRESHOLD_MT;
}

export function distributeLotQuantities(totalQuantity, lotCount) {
  const total = Math.max(0, roundQuantity(totalQuantity));
  const count = Math.max(2, Math.floor(numberOrZero(lotCount)) || 2);
  const base = roundQuantity(total / count);
  const quantities = Array.from({ length: count }, () => base);
  const allocatedBeforeLast = quantities.slice(0, -1).reduce((sum, value) => sum + value, 0);
  quantities[count - 1] = roundQuantity(total - allocatedBeforeLast);
  return quantities;
}

function lotTotal(quantity, unitPrice) {
  return Math.round(Math.max(0, numberOrZero(quantity)) * Math.max(0, numberOrZero(unitPrice)));
}

export function normalizeLot(lot, index, pricing) {
  const quantity = Math.max(0, roundQuantity(lot?.quantity));
  const totalUSD = lotTotal(quantity, pricing.unitPriceUSD);
  const totalAED = lotTotal(quantity, pricing.unitPriceAED);
  const advanceUSD = Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_usd))));
  const advanceAED = Math.min(totalAED, Math.max(0, Math.round(advanceUSD * numberOrZero(pricing.exchangeRate))));
  const balanceUSD = Math.max(0, totalUSD - advanceUSD);
  const balanceAED = Math.max(0, totalAED - advanceAED);
  const status = balanceUSD === 0
    ? 'fully_paid'
    : advanceUSD > 0
      ? 'partially_paid'
      : 'pending';

  return {
    lot_number: index + 1,
    quantity,
    advance_usd: advanceUSD,
    advance_aed: advanceAED,
    balance_usd: balanceUSD,
    balance_aed: balanceAED,
    status,
  };
}

export function normalizeLots(lots, pricing) {
  if (!Array.isArray(lots)) return [];
  return lots.map((lot, index) => normalizeLot(lot, index, pricing));
}

export function createLots({ quantity, lotCount, advancePercent = 20, ...pricing }) {
  const percentage = Math.min(100, Math.max(0, numberOrZero(advancePercent)));
  return distributeLotQuantities(quantity, lotCount).map((lotQuantity, index) => {
    const totalUSD = lotTotal(lotQuantity, pricing.unitPriceUSD);
    return normalizeLot({
      lot_number: index + 1,
      quantity: lotQuantity,
      advance_usd: Math.round(totalUSD * (percentage / 100)),
    }, index, pricing);
  });
}

export function summarizeLots(lots) {
  return (Array.isArray(lots) ? lots : []).reduce((summary, lot) => ({
    quantity: roundQuantity(summary.quantity + numberOrZero(lot.quantity)),
    advanceUSD: summary.advanceUSD + numberOrZero(lot.advance_usd),
    advanceAED: summary.advanceAED + numberOrZero(lot.advance_aed),
    balanceUSD: summary.balanceUSD + numberOrZero(lot.balance_usd),
    balanceAED: summary.balanceAED + numberOrZero(lot.balance_aed),
  }), {
    quantity: 0,
    advanceUSD: 0,
    advanceAED: 0,
    balanceUSD: 0,
    balanceAED: 0,
  });
}

export function isValidLotDistribution(lots, totalQuantity) {
  if (!Array.isArray(lots) || lots.length < 2) return false;
  return Math.abs(summarizeLots(lots).quantity - roundQuantity(totalQuantity)) < 0.01;
}
