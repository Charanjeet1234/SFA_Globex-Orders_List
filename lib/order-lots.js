export const LOT_SPLIT_THRESHOLD_MT = 224;

const QUANTITY_PRECISION = 100;
const LOT_STAGE_ORDER = [
  'pi_issued',
  'pi_signed',
  'advance_received',
  'date_of_shipment',
  'shipment_dispatched',
  'bl_received',
  'got_full_money',
  'bl_surrender',
];
const LOT_ADVANCE_STAGES = new Set(['advance_received', 'date_of_shipment', 'shipment_dispatched', 'bl_received', 'got_full_money', 'bl_surrender']);
const LOT_FULLY_PAID_STAGES = new Set(['got_full_money', 'bl_surrender']);

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
      ? 'advance_paid'
      : 'advance';
}

export function getLotStage(lot, defaultStage = 'pi_issued') {
  return lot?.current_stage || defaultStage;
}

export function isLotAdvanceStage(stage) {
  return LOT_ADVANCE_STAGES.has(stage);
}

function appliedAdvanceUSD(lot) {
  return isLotAdvanceStage(getLotStage(lot, 'pi_issued'))
    ? numberOrZero(lot?.advance_paid_usd)
    : 0;
}

function appliedAdvanceAED(lot) {
  return isLotAdvanceStage(getLotStage(lot, 'pi_issued'))
    ? numberOrZero(lot?.advance_paid_aed)
    : 0;
}

/**
 * Roll a split order up to its least-advanced lot. This keeps the parent
 * status conservative while every lot continues to own its own lifecycle.
 */
export function getLotStageRollup(lots, fallbackStage = 'pi_issued') {
  if (!Array.isArray(lots) || lots.length === 0) return fallbackStage;
  const validIndexes = lots
    .map((lot) => LOT_STAGE_ORDER.indexOf(getLotStage(lot, fallbackStage)))
    .filter((index) => index >= 0);
  if (validIndexes.length === 0) return fallbackStage;
  return LOT_STAGE_ORDER[Math.min(...validIndexes)];
}

export function normalizeLot(lot, index, pricing, paymentState = {}) {
  const quantity = Math.max(0, roundQuantity(lot?.quantity));
  const totalUSD = lotTotal(quantity, pricing.unitPriceUSD);
  const totalAED = lotTotal(quantity, pricing.unitPriceAED);
  const currentStage = getLotStage(lot, paymentState.defaultStage);
  const advanceUSD = Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_usd))));
  const advanceAED = Math.min(totalAED, Math.max(0, Math.round(advanceUSD * numberOrZero(pricing.exchangeRate))));
  const hasRecordedAdvance = Number.isFinite(Number(lot?.advance_paid_usd));
  const advanceReceivedForLot = paymentState.advanceReceived || LOT_ADVANCE_STAGES.has(currentStage);
  const fullyPaidForLot = paymentState.fullyPaid || LOT_FULLY_PAID_STAGES.has(currentStage);
  // A payment entered before the lot reaches Advance Paid is retained as a
  // pending receipt, but it must not reduce the final amount yet. The stage
  // transition is the explicit confirmation that makes the payment active.
  const recordedAdvanceUSD = advanceReceivedForLot
    ? hasRecordedAdvance
      ? Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_paid_usd))))
      : advanceUSD
    : 0;
  const storedAdvanceUSD = hasRecordedAdvance
    ? Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_paid_usd))))
    : undefined;
  const paidAdvanceUSD = fullyPaidForLot ? totalUSD : recordedAdvanceUSD;
  const paidAdvanceAED = fullyPaidForLot
    ? totalAED
    : Math.min(totalAED, Math.max(0, Math.round(paidAdvanceUSD * numberOrZero(pricing.exchangeRate))));
  const balanceUSD = Math.max(0, totalUSD - paidAdvanceUSD);
  const balanceAED = Math.max(0, totalAED - paidAdvanceAED);
  const status = statusForBalance(balanceUSD, paidAdvanceUSD);
  const extraAdvanceUSD = Math.max(0, (storedAdvanceUSD ?? paidAdvanceUSD) - advanceUSD);
  const extraAdvanceAED = Math.max(0, Math.round(extraAdvanceUSD * numberOrZero(pricing.exchangeRate)));

  const normalizedLot = {
    lot_number: index + 1,
    quantity,
    advance_usd: advanceUSD,
    advance_aed: advanceAED,
    balance_usd: balanceUSD,
    balance_aed: balanceAED,
    status,
    current_stage: currentStage,
  };

  // Preserve a recorded payment once one exists. When it was entered before
  // Advance Paid, it remains stored as a pending receipt and is applied only
  // after the lot reaches that stage.
  if (hasRecordedAdvance) {
    // Keep the raw receipt while the lot is still at PI Signed so it can be
    // applied when the user explicitly advances this lot to Advance Paid.
    normalizedLot.advance_paid_usd = storedAdvanceUSD;
    normalizedLot.advance_paid_aed = Math.min(totalAED, Math.max(0, Math.round(storedAdvanceUSD * numberOrZero(pricing.exchangeRate))));
  } else if (advanceReceivedForLot || fullyPaidForLot) {
    normalizedLot.advance_paid_usd = paidAdvanceUSD;
    normalizedLot.advance_paid_aed = paidAdvanceAED;
  }

  if (extraAdvanceUSD > 0 || extraAdvanceAED > 0) {
    normalizedLot.extra_advance_usd = extraAdvanceUSD;
    normalizedLot.extra_advance_aed = extraAdvanceAED;
    normalizedLot.extra_advance_note = lot?.extra_advance_note
      || `Extra advance received: AED ${extraAdvanceAED.toLocaleString()} (USD ${extraAdvanceUSD.toLocaleString()}).`;
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
  const recordedUSD = normalizedLots.reduce((sum, lot) => sum + appliedAdvanceUSD(lot) + numberOrZero(lot.balance_usd), 0);
  const recordedAED = normalizedLots.reduce((sum, lot) => sum + appliedAdvanceAED(lot) + numberOrZero(lot.balance_aed), 0);
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
      status: statusForBalance(balanceUSD, appliedAdvanceUSD(lot)),
    };
  });
}

export function createLots({ quantity, lotCount, advancePercent = 20, currentStage = 'pi_issued', ...pricing }) {
  const percentage = Math.min(100, Math.max(0, numberOrZero(advancePercent)));
  return distributeLotQuantities(quantity, lotCount).map((lotQuantity, index) => {
    const totalUSD = lotTotal(lotQuantity, pricing.unitPriceUSD);
    return normalizeLot({
      lot_number: index + 1,
      quantity: lotQuantity,
      advance_usd: Math.round(totalUSD * (percentage / 100)),
      current_stage: currentStage,
    }, index, pricing, { defaultStage: currentStage });
  });
}

export function summarizeLots(lots) {
  return (Array.isArray(lots) ? lots : []).reduce((summary, lot) => ({
    quantity: roundQuantity(summary.quantity + numberOrZero(lot.quantity)),
    advanceUSD: summary.advanceUSD + numberOrZero(lot.advance_usd),
    advanceAED: summary.advanceAED + numberOrZero(lot.advance_aed),
    paidAdvanceUSD: summary.paidAdvanceUSD + appliedAdvanceUSD(lot),
    paidAdvanceAED: summary.paidAdvanceAED + appliedAdvanceAED(lot),
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
    usd: appliedAdvanceUSD(lot) + numberOrZero(lot?.balance_usd),
    aed: appliedAdvanceAED(lot) + numberOrZero(lot?.balance_aed),
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
  const normalizedLots = normalizeLots(lots, pricing, { defaultStage: 'pi_issued' });
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
    current_stage: paidByLot[index] > 0 && getLotStage(lot, 'pi_issued') === 'pi_issued'
      ? 'advance_received'
      : getLotStage(lot, 'pi_issued'),
  })), pricing, { defaultStage: 'pi_issued' });
}

/**
 * Records one lot's received advance. Any amount above the agreed advance is
 * retained as an explicit extra-advance note and reduces only that lot's
 * final amount.
 */
export function recordLotAdvance(lot, receivedAdvanceUSD, pricing) {
  const totalUSD = lotTotal(lot?.quantity, pricing.unitPriceUSD);
  const paidAdvanceUSD = Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(receivedAdvanceUSD))));
  const advanceUSD = Math.min(totalUSD, Math.max(0, Math.round(numberOrZero(lot?.advance_usd))));
  const extraAdvanceUSD = Math.max(0, paidAdvanceUSD - advanceUSD);
  const extraAdvanceAED = Math.max(0, Math.round(extraAdvanceUSD * numberOrZero(pricing.exchangeRate)));
  const previousStage = getLotStage(lot, 'pi_issued');
  // Recording money never advances the shipment workflow. The user must
  // explicitly move this lot to Advance Paid (and later stages) themselves.
  const currentStage = previousStage;

  return normalizeLot({
    ...lot,
    advance_paid_usd: paidAdvanceUSD,
    advance_paid_aed: Math.round(paidAdvanceUSD * numberOrZero(pricing.exchangeRate)),
    current_stage: currentStage,
    ...(extraAdvanceUSD > 0 ? {
      extra_advance_usd: extraAdvanceUSD,
      extra_advance_aed: extraAdvanceAED,
      extra_advance_note: `Extra advance received: AED ${extraAdvanceAED.toLocaleString()} (USD ${extraAdvanceUSD.toLocaleString()}).`,
    } : {}),
  }, Math.max(0, Math.floor(numberOrZero(lot?.lot_number)) - 1), pricing);
}
