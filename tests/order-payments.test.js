import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderPayments, hasAdvanceReceived, receivedPaymentUSD } from '../lib/order-payments.js';
const order = { totalAmountUSD: 245000, totalAmountAED: 899750, advancePaymentUSD: 49000, advancePaymentAED: 179953, balancePaymentUSD: 196000, balancePaymentAED: 719797, currentStage: 'pi_issued', stagesHistory: {}, isFullPaymentReceived: false };
test('planned advances keep the full USD/AED balance at both PI stages, including legacy balances', () => {
  for (const currentStage of ['pi_issued', 'pi_signed']) {
    const result = normalizeOrderPayments({ ...order, currentStage });
    assert.equal(result.balancePaymentUSD, 245000);
    assert.equal(result.balancePaymentAED, 899750);
    assert.equal(hasAdvanceReceived(result), false);
    assert.equal(receivedPaymentUSD(result), 0);
  }
});
test('advance is deducted once on receipt and stays deducted through later stages', () => {
  for (const currentStage of ['advance_received', 'date_of_shipment', 'shipment_dispatched', 'bl_received']) {
    const result = normalizeOrderPayments({ ...order, currentStage });
    assert.equal(result.balancePaymentUSD, 196000);
    assert.equal(result.balancePaymentAED, 719797);
    assert.equal(receivedPaymentUSD(result), 49000);
    assert.deepEqual(normalizeOrderPayments(result), result);
  }
});
test('a 100% planned advance does not settle an unpaid order', () => {
  const result = normalizeOrderPayments({ ...order, advancePaymentUSD: 245000, advancePaymentAED: 899750, isFullPaymentReceived: true });
  assert.equal(result.balancePaymentUSD, 245000);
  assert.equal(result.isFullPaymentReceived, false);
});
test('full settlement clears both currencies via stage or explicit payment record', () => {
  for (const variant of [{ currentStage: 'got_full_money' }, { currentStage: 'bl_surrender' }, { stagesHistory: { got_full_money: { completedAt: '2026-09-16' } } }]) {
    const result = normalizeOrderPayments({ ...order, ...variant });
    assert.equal(result.balancePaymentUSD, 0);
    assert.equal(result.balancePaymentAED, 0);
    assert.equal(receivedPaymentUSD(result), 245000);
  }
});
test('explicit partial payment before advancing only deducts cash actually recorded', () => {
  const result = normalizeOrderPayments({ ...order, advancePaymentUSD: 10000, advancePaymentAED: 36725, stagesHistory: { advance_received: { completedAt: '2026-09-16' } } });
  assert.equal(result.balancePaymentUSD, 235000);
  assert.equal(result.balancePaymentAED, 863025);
});
