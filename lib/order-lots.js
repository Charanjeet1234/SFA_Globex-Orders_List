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

function statusForBalance(balanceUSD, paidAdvanceUSD) {
  return balanceUSD === 0
    ? 'fully_paid'
    : paidAdvanceUSD > 0
      ? 'partially_paid'
      : 'pending';
}

export function normalizeLot(lot, index, pricing, paymentState = {}) {
  const quantity = Math.max(0, roundQuantity(lot?.quantity));
  const totalUSD = lotTotal(quantity, pricing.unitPriceUSD);
  const totalAED = lotTotal(quantity, pricing.unitPriceAED);
  const advanceUSD = Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_usd))));
  const advanceAED = Math.min(totalAED, Math.max(0, Math.round(advanceUSD * numberOrZero(pricing.exchangeRate))));
  const hasRecordedAdvance = Number.isFinite(Number(lot?.advance_paid_usd));
  const recordedAdvanceUSD = hasRecordedAdvance
    ? Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_paid_usd))))
    : paymentState.advanceReceived
      ? advanceUSD
      : 0;
  const paidAdvanceUSD = paymentState.fullyPaid ? totalUSD : recordedAdvanceUSD;
  const paidAdvanceAED = paymentState.fullyPaid
    ? totalAED
    : Math.min(totalAED, Math.max(0, Math.round(paidAdvanceUSD * numberOrZero(pricing.exchangeRate))));
  const balanceUSD = Math.max(0, totalUSD - paidAdvanceUSD);
  const balanceAED = Math.max(0, totalAED - paidAdvanceAED);
  const status = statusForBalance(balanceUSD, paidAdvanceUSD);

  const normalizedLot = {
    lot_number: index + 1,
    quantity,
    advance_usd: advanceUSD,
    advance_aed: advanceAED,
    balance_usd: balanceUSD,
    balance_aed: balanceAED,
    status,
  };

  // Preserve a recorded payment once one exists. Before an advance is
  // received, omit these optional fields so moving to the advance stage can
  // apply the agreed advance in full.
  if (hasRecordedAdvance || paymentState.advanceReceived || paymentState.fullyPaid) {
    normalizedLot.advance_paid_usd = paidAdvanceUSD;
    normalizedLot.advance_paid_aed = paidAdvanceAED;
  }

  return normalizedLot;
}

export function normalizeLots(lots, pricing, paymentState = {}) {
  if (!Array.isArray(lots)) return [];
  const normalizedLots = lots.map((lot, index) => normalizeLot(lot, index, pricing, paymentState));
  if (normalizedLots.length === 0) return normalizedLots;

  const totalQuantity = normalizedLots.reduce((sum, lot) => sum + numberOrZero(lot.quantity), 0);
  const expectedUSD = lotTotal(totalQuantity, pricing.unitPriceUSD);
  const expectedAED = lotTotal(totalQuantity, pricing.unitPriceAED);
  const recordedUSD = normalizedLots.reduce((sum, lot) => sum + numberOrZero(lot.advance_paid_usd) + numberOrZero(lot.balance_usd), 0);
  const recordedAED = normalizedLots.reduce((sum, lot) => sum + numberOrZero(lot.advance_paid_aed) + numberOrZero(lot.balance_aed), 0);
  const differenceUSD = expectedUSD - recordedUSD;
  const differenceAED = expectedAED - recordedAED;

  if (differenceUSD === 0 && differenceAED === 0) return normalizedLots;

  const lastLotIndex = normalizedLots.length - 1;
  return normalizedLots.map((lot, index) => {
    if (index !== lastLotIndex) return lot;

    if (paymentState.fullyPaid) {
      return {
        ...lot,
        advance_paid_usd: Math.max(0, numberOrZero(lot.advance_paid_usd) + differenceUSD),
        advance_paid_aed: Math.max(0, numberOrZero(lot.advance_paid_aed) + differenceAED),
      };
    }

    const balanceUSD = Math.max(0, numberOrZero(lot.balance_usd) + differenceUSD);
    return {
      ...lot,
      balance_usd: balanceUSD,
      balance_aed: Math.max(0, numberOrZero(lot.balance_aed) + differenceAED),
      status: statusForBalance(balanceUSD, numberOrZero(lot.advance_paid_usd)),
    };
  });
}

export function createLots({ quantity, lotCount, advancePercent = 20, ...pricing }) {
  const percentage = Math.min(100, Math.max(0, numberOrZero(advancePercent)));
  return distributeLotQuantities(quantity, lotCount).map((lotQuantity, index) => {
    const totalUSD = lotTotal(lotQuantity, pricing.unitPriceUSD);
    return normalizeLot({
      lot_number: index + 1,
      quantity: lotQuantity,
      advance_usd: Math.round(totalUSD * (percentage / 100)),
    }, index, pricing, { advanceReceived: false });
  });
}

export function summarizeLots(lots) {
  return (Array.isArray(lots) ? lots : []).reduce((summary, lot) => ({
    quantity: roundQuantity(summary.quantity + numberOrZero(lot.quantity)),
    advanceUSD: summary.advanceUSD + numberOrZero(lot.advance_usd),
    advanceAED: summary.advanceAED + numberOrZero(lot.advance_aed),
    paidAdvanceUSD: summary.paidAdvanceUSD + numberOrZero(lot.advance_paid_usd),
    paidAdvanceAED: summary.paidAdvanceAED + numberOrZero(lot.advance_paid_aed),
    balanceUSD: summary.balanceUSD + numberOrZero(lot.balance_usd),
    balanceAED: summary.balanceAED + numberOrZero(lot.balance_aed),
  }), {
    quantity: 0,
    advanceUSD: 0,
    advanceAED: 0,
    paidAdvanceUSD: 0,
    paidAdvanceAED: 0,
    balanceUSD: 0,
    balanceAED: 0,
  });
}

export function getLotTotal(lot) {
  return {
    usd: numberOrZero(lot?.advance_paid_usd) + numberOrZero(lot?.balance_usd),
    aed: numberOrZero(lot?.advance_paid_aed) + numberOrZero(lot?.balance_aed),
  };
}

export function isValidLotDistribution(lots, totalQuantity) {
  if (!Array.isArray(lots) || lots.length < 2) return false;
  return Math.abs(summarizeLots(lots).quantity - roundQuantity(totalQuantity)) < 0.01;
}

/**
 * Applies a recorded payment without changing each lot's agreed advance.
 * Agreed advances are funded first in lot order, then any additional amount
 * is allocated toward the remaining final amounts in that same order.
 */
export function applyLotAdvancePayment(lots, totalPaidUSD, pricing) {
  const normalizedLots = normalizeLots(lots, pricing, { advanceReceived: false });
  let remaining = Math.max(0, Math.round(numberOrZero(totalPaidUSD)));
  const paidByLot = normalizedLots.map(() => 0);

  normalizedLots.forEach((lot, index) => {
    const applied = Math.min(lot.advance_usd, remaining);
    paidByLot[index] = applied;
    remaining -= applied;
  });

  normalizedLots.forEach((lot, index) => {
    if (remaining <= 0) return;
    const lotTotalUSD = lotTotal(lot.quantity, pricing.unitPriceUSD);
    const additional = Math.min(Math.max(0, lotTotalUSD - paidByLot[index]), remaining);
    paidByLot[index] += additional;
    remaining -= additional;
  });

  return normalizeLots(normalizedLots.map((lot, index) => ({
    ...lot,
    advance_paid_usd: paidByLot[index],
  })), pricing, { advanceReceived: true });
}
