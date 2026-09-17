import React, { useState } from 'react';
import { Boxes, CheckCircle2, CircleAlert, SlidersHorizontal } from 'lucide-react';
import { Order, OrderLot } from '../types';
import { formatAED, formatUSD } from '../utils/pdfGenerator';
import {
  createLots,
  isLotSplitEligible,
  isValidLotDistribution,
  normalizeLots,
  summarizeLots,
} from '../../lib/order-lots.js';

interface LotSplitConfigurationProps {
  quantity: number;
  unit: Order['unit'];
  unitPriceUSD: number;
  unitPriceAED: number;
  exchangeRate: number;
  lots: OrderLot[];
  defaultAdvancePercent?: number;
  onLotsChange: (lots: OrderLot[]) => void;
}

const statusStyles = {
  fully_paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-200',
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
};

const statusLabels = {
  fully_paid: 'Fully Paid',
  partially_paid: 'Partially Paid',
  pending: 'Pending',
};

export function LotSplitConfiguration({
  quantity,
  unit,
  unitPriceUSD,
  unitPriceAED,
  exchangeRate,
  lots,
  defaultAdvancePercent = 20,
  onLotsChange,
}: LotSplitConfigurationProps) {
  const [customLotCount, setCustomLotCount] = useState(5);
  const pricing = { unitPriceUSD, unitPriceAED, exchangeRate };
  const normalizedLots = normalizeLots(lots, pricing);
  const summary = summarizeLots(normalizedLots);
  const isDistributionValid = isValidLotDistribution(normalizedLots, quantity);

  if (!isLotSplitEligible(quantity, unit)) return null;

  const configureLots = (lotCount: number) => {
    onLotsChange(createLots({
      quantity,
      lotCount,
      advancePercent: defaultAdvancePercent,
      ...pricing,
    }));
  };

  const updateLot = (index: number, updates: Partial<OrderLot>) => {
    const nextLots = normalizedLots.map((lot, lotIndex) => (
      lotIndex === index ? { ...lot, ...updates } : lot
    ));
    onLotsChange(normalizeLots(nextLots, pricing));
  };

  const setAdvancePercentageForAll = (percentage: number) => {
    onLotsChange(normalizeLots(normalizedLots.map((lot) => ({
      ...lot,
      advance_usd: Math.round(lot.quantity * unitPriceUSD * (percentage / 100)),
    })), pricing));
  };

  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-4 sm:p-5 space-y-4" aria-labelledby="lot-split-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-xl bg-blue-600 p-2 text-white shadow-sm">
            <Boxes className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 id="lot-split-heading" className="text-sm font-black text-slate-900">
              Split into Lots
            </h3>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-600">
              This {quantity.toLocaleString()} MT order is above the 224 MT threshold. Allocate shipment lots and set each lot&apos;s paid advance independently.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-800">
          1 USD = {exchangeRate.toFixed(4)} AED
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Lot distribution options">
        {[3, 4].map((lotCount) => (
          <button
            key={lotCount}
            type="button"
            onClick={() => configureLots(lotCount)}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
              normalizedLots.length === lotCount
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {lotCount} Lots
          </button>
        ))}
        <label className={`flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 text-xs ${
          normalizedLots.length > 0 && ![3, 4].includes(normalizedLots.length)
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-slate-200'
        }`}>
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="font-bold text-slate-700">Custom</span>
          <input
            aria-label="Custom number of lots"
            type="number"
            min="2"
            max="24"
            value={customLotCount}
            onChange={(event) => setCustomLotCount(Math.min(24, Math.max(2, Number(event.target.value) || 2)))}
            className="w-12 rounded border border-slate-200 px-1.5 py-1 text-center font-bold text-slate-800 outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => configureLots(customLotCount)}
            className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-700"
          >
            Apply
          </button>
        </label>
      </div>

      {normalizedLots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-300 bg-white/70 px-4 py-3 text-xs text-slate-600">
          Choose 3, 4, or a custom number of lots to begin. Each lot starts with a {defaultAdvancePercent}% advance, which you can override below.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="text-xs text-slate-600">
              Starting advance for all lots:
              <span className="ml-2 inline-flex gap-1.5">
                {[10, 20, 30, 50, 100].map((percentage) => (
                  <button
                    key={percentage}
                    type="button"
                    onClick={() => setAdvancePercentageForAll(percentage)}
                    className="rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-blue-100 hover:text-blue-800"
                  >
                    {percentage}%
                  </button>
                ))}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isDistributionValid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isDistributionValid ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
              {isDistributionValid
                ? `Allocated: ${summary.quantity.toLocaleString()} / ${quantity.toLocaleString()} MT`
                : `Lots total ${summary.quantity.toLocaleString()} MT — must equal ${quantity.toLocaleString()} MT`}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[740px] w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-100">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Lot</th>
                  <th className="px-3 py-2.5 font-bold">Quantity (MT)</th>
                  <th className="px-3 py-2.5 font-bold">Lot value</th>
                  <th className="px-3 py-2.5 font-bold">Advance paid (USD)</th>
                  <th className="px-3 py-2.5 font-bold">Final payment due</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {normalizedLots.map((lot, index) => {
                  const lotValueUSD = Math.round(lot.quantity * unitPriceUSD);
                  const lotValueAED = Math.round(lot.quantity * unitPriceAED);
                  return (
                    <tr key={lot.lot_number} className="align-top">
                      <td className="px-3 py-3 font-black text-slate-900">Lot {lot.lot_number}</td>
                      <td className="px-3 py-2">
                        <input
                          aria-label={`Lot ${lot.lot_number} quantity in MT`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={lot.quantity}
                          onChange={(event) => updateLot(index, { quantity: Math.max(0, Number(event.target.value) || 0) })}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 font-bold text-slate-900 outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800">{formatAED(lotValueAED)}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-500">{formatUSD(lotValueUSD)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-slate-400">$</span>
                          <input
                            aria-label={`Lot ${lot.lot_number} advance paid in USD`}
                            type="number"
                            min="0"
                            max={lotValueUSD}
                            value={lot.advance_usd}
                            onChange={(event) => updateLot(index, { advance_usd: Math.min(lotValueUSD, Math.max(0, Number(event.target.value) || 0)) })}
                            className="w-28 rounded-lg border border-slate-300 py-1.5 pl-5 pr-2 font-bold text-slate-900 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="mt-1 text-[10px] font-medium text-emerald-700">{formatAED(lot.advance_aed)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-amber-800">{formatAED(lot.balance_aed)}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-500">{formatUSD(lot.balance_usd)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${statusStyles[lot.status]}`}>
                          {statusLabels[lot.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                <tr>
                  <td colSpan={2} className="px-3 py-3 font-black text-slate-900">Order totals</td>
                  <td className="px-3 py-3 font-bold text-slate-800">{formatAED(Math.round(quantity * unitPriceAED))}</td>
                  <td className="px-3 py-3 font-black text-emerald-700">
                    {formatAED(summary.advanceAED)}
                    <span className="mt-0.5 block font-mono text-[10px] font-medium text-slate-500">{formatUSD(summary.advanceUSD)}</span>
                  </td>
                  <td className="px-3 py-3 font-black text-amber-800">
                    {formatAED(summary.balanceAED)}
                    <span className="mt-0.5 block font-mono text-[10px] font-medium text-slate-500">{formatUSD(summary.balanceUSD)}</span>
                  </td>
                  <td className="px-3 py-3 text-[10px] font-semibold text-slate-500">Live aggregate</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
