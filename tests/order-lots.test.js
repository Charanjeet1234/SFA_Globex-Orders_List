import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLotAdvancePayment,
  createLots,
  distributeLotQuantities,
  getLotTotal,
  isLotSplitEligible,
  isValidLotDistribution,
  normalizeLots,
  recordLotAdvance,
  summarizeLots,
} from '../lib/order-lots.js';
import { normalizeOrderPayments } from '../lib/order-payments.js';

const pricing = { unitPriceUSD: 1000, unitPriceAED: 3673, exchangeRate: 3.6725 };

// Reproduce SFA-2026-961: the saved full-payment stages previously left only
// the old advance recorded, transferring the missing payments to Lot 2.
function completedOrderFixture(secondStage = 'bl_surrender') {
  return {
    orderNumber: 'SFA-2026-961',
    quantity: 504,
    unitPriceUSD: 1175,
    unitPriceAED: 4318,
    exchangeRateUsdToAed: 3.6745,
    totalAmountUSD: 592200,
    totalAmountAED: 2176272,
    balancePaymentUSD: 444024,
    balancePaymentAED: 1631800,
    currentStage: 'bl_surrender',
    lots: [1, 2].map((lot_number) => ({
      lot_number,
      quantity: 252,
      advance_usd: 74088,
      advance_aed: 272236,
      advance_paid_usd: 74088,
      advance_paid_aed: 272236,
      current_stage: lot_number === 1 ? 'bl_surrender' : secondStage,
      balance_usd: lot_number === 1 ? 0 : 444024,
      balance_aed: lot_number === 1 ? 0 : 1631800,
      status: lot_number === 1 ? 'fully_paid' : 'advance_paid',
    })),
  };
}

test('completed lots clear the SFA-2026-961 balance and remain settled after reload', () => {
  const result = normalizeOrderPayments(completedOrderFixture());
  assert.equal(result.balancePaymentUSD, 0);
  assert.equal(result.balancePaymentAED, 0);
  assert.equal(result.isFullPaymentReceived, true);
  for (const lot of result.lots) {
    assert.equal(lot.status, 'fully_paid');
    assert.equal(lot.balance_usd, 0);
    assert.equal(lot.balance_aed, 0);
    assert.equal(lot.advance_paid_usd, 296100);
    assert.equal(lot.advance_paid_aed, 1088136);
    assert.deepEqual(getLotTotal(lot), { usd: 296100, aed: 1088136 });
  }
  assert.deepEqual(normalizeOrderPayments(JSON.parse(JSON.stringify(result))), result);
});

test('settling Lot 1 leaves only Lot 2 total minus its received advance due', () => {
  const result = normalizeOrderPayments(completedOrderFixture('advance_received'));
  assert.equal(result.lots[0].balance_aed, 0);
  assert.equal(result.lots[1].balance_usd, 296100 - 74088);
  assert.equal(result.lots[1].balance_aed, 1088136 - 272236);
  assert.equal(result.balancePaymentUSD, 222012);
  assert.equal(result.balancePaymentAED, 815900);
  assert.equal(result.isFullPaymentReceived, false);
  assert.equal(result.isCompleted, false);
  const summary = summarizeLots(result.lots);
  assert.equal(summary.paidAdvanceUSD + summary.balanceUSD, result.totalAmountUSD);
  assert.equal(summary.paidAdvanceAED + summary.balanceAED, result.totalAmountAED);
  assert.deepEqual(normalizeOrderPayments(JSON.parse(JSON.stringify(result))), result);
});

test('rounding never moves a completed lot payment onto a sibling balance', () => {
  const decimalPricing = { unitPriceUSD: 1175, unitPriceAED: 4318, exchangeRate: 3.6745 };
  const lots = createLots({ quantity: 504.01, lotCount: 3, ...decimalPricing });
  const before = normalizeLots(lots, decimalPricing);
  const after = normalizeLots(lots.map((lot, index) => index === 0
    ? { ...lot, advance_paid_usd: lot.advance_usd, current_stage: 'got_full_money' }
    : lot), decimalPricing);
  assert.deepEqual(after.slice(1), before.slice(1));
  assert.equal(after[0].balance_aed, 0);
  const fullyPaid = normalizeLots(after.map((lot) => ({ ...lot, current_stage: 'got_full_money' })), decimalPricing);
  const summary = summarizeLots(fullyPaid);
  assert.equal(summary.balanceUSD, 0);
  assert.equal(summary.balanceAED, 0);
  assert.equal(summary.paidAdvanceUSD, Math.round(504.01 * 1175));
  assert.equal(summary.paidAdvanceAED, Math.round(504.01 * 4318));
  assert.deepEqual(normalizeLots(fullyPaid, decimalPricing), fullyPaid);
});

test('receiving the full lot amount settles both currencies without moving its shipment stage', () => {
  const fixture = completedOrderFixture('advance_received');
  const paid = recordLotAdvance(fixture.lots[1], 296100, {
    unitPriceUSD: 1175, unitPriceAED: 4318, exchangeRate: 3.6745,
  });
  assert.equal(paid.current_stage, 'advance_received');
  assert.equal(paid.status, 'fully_paid');
  assert.equal(paid.balance_usd, 0);
  assert.equal(paid.balance_aed, 0);
  const saved = normalizeOrderPayments({ ...fixture, lots: [fixture.lots[0], paid] });
  assert.equal(saved.balancePaymentAED, 0);
  assert.equal(saved.isCompleted, false);
  assert.deepEqual(normalizeOrderPayments(saved), saved);
});

test('lot splitting is restricted to orders over 224 MT', () => {
  assert.equal(isLotSplitEligible(224, 'MT'), false);
  assert.equal(isLotSplitEligible(224.01, 'MT'), true);
  assert.equal(isLotSplitEligible(300, 'KG'), false);
});

test('equal distribution retains the exact total quantity', () => {
  const quantities = distributeLotQuantities(227, 3);
  assert.deepEqual(quantities, [75.67, 75.67, 75.66]);
  assert.equal(quantities.reduce((sum, value) => sum + value, 0), 227);
});

test('custom lot quantities preserve unequal customer allocations', () => {
  const customLots = normalizeLots([
    { lot_number: 1, quantity: 300, advance_usd: 60000, current_stage: 'pi_issued' },
    { lot_number: 2, quantity: 204, advance_usd: 40800, current_stage: 'pi_issued' },
  ], pricing);

  assert.deepEqual(customLots.map((lot) => lot.quantity), [300, 204]);
  assert.equal(isValidLotDistribution(customLots, 504), true);
  assert.equal(isValidLotDistribution(customLots, 505), false);
  assert.equal(summarizeLots(customLots).balanceUSD, 504000);
});

test('lot financials calculate balances and statuses in USD and AED', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const normalized = normalizeLots([
    { ...lots[0], advance_usd: 100000, current_stage: 'advance_received' },
    { ...lots[1], advance_usd: 0, current_stage: 'advance_received' },
    { ...lots[2], advance_usd: 83330, current_stage: 'advance_received' },
  ], pricing);
  const summary = summarizeLots(normalized);

  assert.equal(isValidLotDistribution(normalized, 250), true);
  assert.equal(normalized[0].status, 'fully_paid');
  assert.equal(normalized[1].status, 'advance');
  assert.equal(normalized[2].status, 'advance_paid');
  assert.equal(summary.paidAdvanceUSD + summary.balanceUSD, 250000);
  assert.equal(summary.paidAdvanceAED + summary.balanceAED, 918250);
});

test('a configured advance leaves the full lot amount due until it is received', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const planned = normalizeLots(lots, pricing);
  const received = normalizeLots(lots.map((lot) => ({ ...lot, current_stage: 'advance_received' })), pricing);

  assert.ok(planned.every((lot) => lot.status === 'advance'));
  assert.equal(summarizeLots(planned).balanceUSD, 250000);
  assert.equal(summarizeLots(planned).balanceAED, 918250);
  assert.equal(summarizeLots(received).balanceUSD, 200000);
  assert.ok(received.every((lot) => lot.status === 'advance_paid'));
});

test('each new lot begins at PI Issued and retains its own stage', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  assert.ok(lots.every((lot) => lot.current_stage === 'pi_issued'));

  const independentlyMoved = normalizeLots([
    { ...lots[0], current_stage: 'bl_received' },
    lots[1],
    lots[2],
  ], pricing);
  assert.equal(independentlyMoved[0].current_stage, 'bl_received');
  assert.equal(independentlyMoved[1].current_stage, 'pi_issued');
  assert.equal(independentlyMoved[2].current_stage, 'pi_issued');
});

test('a recorded lot payment is applied to agreed advances before final amounts', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const paidLots = applyLotAdvancePayment(lots, 30000, pricing);

  assert.equal(summarizeLots(paidLots).paidAdvanceUSD, 30000);
  assert.equal(summarizeLots(paidLots).balanceUSD, 220000);
  assert.equal(paidLots[0].status, 'advance_paid');
});

test('recording a later extra advance preserves that lot stage', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const progressedLot = recordLotAdvance({ ...lots[0], current_stage: 'shipment_dispatched' }, 30000, pricing);

  assert.equal(progressedLot.current_stage, 'shipment_dispatched');
  assert.equal(progressedLot.status, 'advance_paid');
  assert.ok(progressedLot.balance_usd < lots[0].balance_usd);
});

test('order persistence keeps lot payloads and derives order-level payment totals', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const normalizedOrder = normalizeOrderPayments({
    id: 'lot-test-order',
    companyId: 'lot-test-company',
    orderNumber: 'SFA-LOT-001',
    quantity: 250,
    totalAmountUSD: 250000,
    totalAmountAED: 918250,
    currentStage: 'pi_issued',
    exchangeRateUsdToAed: pricing.exchangeRate,
    ...pricing,
    lots,
  });

  assert.deepEqual(Object.keys(normalizedOrder.lots[0]).sort(), [
    'advance_aed', 'advance_usd', 'balance_aed', 'balance_usd', 'current_stage', 'lot_number', 'quantity', 'status',
  ]);
  assert.equal(normalizedOrder.advancePaymentUSD, 50000);
  assert.equal(normalizedOrder.advancePaymentAED, 183625);
  assert.equal(normalizedOrder.balancePaymentUSD, 250000);
  assert.equal(normalizedOrder.balancePaymentAED, 918250);
  assert.ok(normalizedOrder.lots.every((lot) => lot.status === 'advance'));

  // Advancing the parent order must not change individual lot payments.
  const parentAfterAdvance = normalizeOrderPayments({ ...normalizedOrder, currentStage: 'advance_received' });
  assert.equal(parentAfterAdvance.balancePaymentUSD, 250000);
  assert.ok(parentAfterAdvance.lots.every((lot) => lot.status === 'advance'));

  const recordedBeforeStage = recordLotAdvance(normalizedOrder.lots[0], 35000, pricing);
  const orderBeforeLotStage = normalizeOrderPayments({
    ...normalizedOrder,
    lots: [recordedBeforeStage, ...normalizedOrder.lots.slice(1)],
  });
  assert.equal(orderBeforeLotStage.balancePaymentUSD, 250000);
  assert.equal(orderBeforeLotStage.lots[0].status, 'advance');

  const orderAfterFirstLotAdvance = normalizeOrderPayments({
    ...orderBeforeLotStage,
    lots: orderBeforeLotStage.lots.map((lot) => lot.lot_number === 1
      ? { ...lot, current_stage: 'advance_received' }
      : lot),
  });
  assert.equal(orderAfterFirstLotAdvance.balancePaymentUSD, 215000);
  assert.equal(orderAfterFirstLotAdvance.lots[0].status, 'advance_paid');
  assert.ok(orderAfterFirstLotAdvance.lots.slice(1).every((lot) => lot.status === 'advance'));
  assert.match(orderAfterFirstLotAdvance.lots[0].extra_advance_note, /Extra advance received/);
});

test('a lot stays pending until it is explicitly moved to Advance Paid', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const recordedBeforeStage = recordLotAdvance({ ...lots[1], current_stage: 'pi_signed' }, 30000, pricing);

  assert.equal(recordedBeforeStage.current_stage, 'pi_signed');
  assert.equal(recordedBeforeStage.status, 'advance');
  assert.equal(recordedBeforeStage.balance_usd, lots[1].balance_usd);

  const pendingOrder = normalizeOrderPayments({
    totalAmountUSD: 250000,
    totalAmountAED: 918250,
    currentStage: 'pi_signed',
    exchangeRateUsdToAed: pricing.exchangeRate,
    ...pricing,
    lots: [lots[0], recordedBeforeStage, lots[2]],
  });
  assert.equal(pendingOrder.balancePaymentUSD, 250000);
  assert.equal(pendingOrder.lots[1].status, 'advance');

  const advancedOrder = normalizeOrderPayments({
    ...pendingOrder,
    lots: pendingOrder.lots.map((lot) => lot.lot_number === 2
      ? { ...lot, current_stage: 'advance_received' }
      : lot),
  });
  assert.equal(advancedOrder.lots[1].status, 'advance_paid');
  assert.equal(advancedOrder.lots[1].balance_usd, lots[1].balance_usd - 30000);
  assert.equal(advancedOrder.balancePaymentUSD, 220000);
});

test('parent stage rolls up to the least-advanced lot without changing siblings', () => {
  const lots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing });
  const independentlyMoved = normalizeLots([
    { ...lots[0], current_stage: 'shipment_dispatched' },
    { ...lots[1], current_stage: 'pi_signed' },
    { ...lots[2], current_stage: 'bl_received' },
  ], pricing);
  const normalizedOrder = normalizeOrderPayments({
    totalAmountUSD: 250000,
    totalAmountAED: 918250,
    currentStage: 'bl_received',
    exchangeRateUsdToAed: pricing.exchangeRate,
    ...pricing,
    lots: independentlyMoved,
  });

  assert.equal(normalizedOrder.currentStage, 'pi_signed');
  assert.equal(normalizedOrder.isWaitingForBuyerPI, false);
  assert.deepEqual(normalizedOrder.lots.map((lot) => lot.current_stage), [
    'shipment_dispatched',
    'pi_signed',
    'bl_received',
  ]);
});

test('legacy lots inherit a confirmed parent advance only until each lot is independently updated', () => {
  const legacyLots = createLots({ quantity: 250, lotCount: 3, advancePercent: 20, ...pricing })
    .map(({ current_stage, ...lot }) => lot);
  const hydrated = normalizeOrderPayments({
    totalAmountUSD: 250000,
    totalAmountAED: 918250,
    currentStage: 'date_of_shipment',
    exchangeRateUsdToAed: pricing.exchangeRate,
    ...pricing,
    lots: legacyLots,
  });

  assert.ok(hydrated.lots.every((lot) => lot.status === 'advance_paid'));
  assert.equal(hydrated.balancePaymentUSD, 200000);
});
