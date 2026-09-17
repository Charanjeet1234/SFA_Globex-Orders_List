import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLotAdvancePayment,
  createLots,
  distributeLotQuantities,
  isLotSplitEligible,
  isValidLotDistribution,
  normalizeLots,
  recordLotAdvance,
  summarizeLots,
} from '../lib/order-lots.js';
import { normalizeOrderPayments } from '../lib/order-payments.js';

const pricing = { unitPriceUSD: 1000, unitPriceAED: 3673, exchangeRate: 3.6725 };

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
  assert.equal(summary.advanceUSD + summary.balanceUSD, 250000);
  assert.equal(summary.advanceAED + summary.balanceAED, 918250);
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
