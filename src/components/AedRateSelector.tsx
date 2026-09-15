import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { AedRatePreset } from '../types';

interface AedRateSelectorProps {
  currentRate: number;
  onChangeRate: (rate: number, preset: AedRatePreset) => void;
  label?: string;
  size?: 'sm' | 'md';
}

export const AedRateSelector: React.FC<AedRateSelectorProps> = ({
  currentRate,
  onChangeRate,
  label = 'AED Exchange Rate (1 USD = ? AED)',
  size = 'md'
}) => {
  const [preset, setPreset] = useState<AedRatePreset>(() => {
    if (Math.abs(currentRate - 3.6725) < 0.0001) return '3.6725';
    if (Math.abs(currentRate - 3.6745) < 0.0001) return '3.6745';
    return 'custom';
  });

  const [customInput, setCustomInput] = useState<string>(() => {
    if (Math.abs(currentRate - 3.6725) >= 0.0001 && Math.abs(currentRate - 3.6745) >= 0.0001) {
      return currentRate.toString();
    }
    return '3.6735';
  });

  useEffect(() => {
    if (Math.abs(currentRate - 3.6725) < 0.0001) {
      setPreset('3.6725');
    } else if (Math.abs(currentRate - 3.6745) < 0.0001) {
      setPreset('3.6745');
    } else {
      setPreset('custom');
      setCustomInput(currentRate.toString());
    }
  }, [currentRate]);

  const handleSelectPreset = (p: AedRatePreset) => {
    setPreset(p);
    if (p === '3.6725') {
      onChangeRate(3.6725, '3.6725');
    } else if (p === '3.6745') {
      onChangeRate(3.6745, '3.6745');
    } else {
      const parsed = parseFloat(customInput) || 3.6730;
      onChangeRate(parsed, 'custom');
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeRate(parsed, 'custom');
    }
  };

  return (
    <div className="space-y-1.5" id="aed-rate-selector-container">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            {label}
          </label>
          <span className="text-[11px] text-slate-500 font-mono">
            Active: 1 USD = {currentRate.toFixed(4)} AED
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Preset 3.6725 */}
        <button
          type="button"
          id="rate-btn-36725"
          onClick={() => handleSelectPreset('3.6725')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            preset === '3.6725'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <span>3.6725</span>
          <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${preset === '3.6725' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
            Central Bank Peg
          </span>
        </button>

        {/* Preset 3.6745 */}
        <button
          type="button"
          id="rate-btn-36745"
          onClick={() => handleSelectPreset('3.6745')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
            preset === '3.6745'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <span>3.6745</span>
          <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${preset === '3.6745' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
            Commercial FX
          </span>
        </button>

        {/* Custom Option */}
        <button
          type="button"
          id="rate-btn-custom"
          onClick={() => handleSelectPreset('custom')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            preset === 'custom'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-semibold'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          Custom Rate
        </button>

        {/* Custom input visible if custom selected */}
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 animate-fadeIn">
            <input
              type="number"
              id="custom-aed-rate-input"
              step="0.0001"
              min="0.1"
              max="20"
              value={customInput}
              onChange={handleCustomChange}
              placeholder="e.g. 3.6750"
              className="w-28 px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-500 font-medium">AED/USD</span>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 font-normal">
        AED values round to nearest integer: ≥ 0.5 rounds up (e.g. $1,175 × 3.6745 = 4,317.5375 → 4,318 AED; .2375 → 4,317 AED).
      </div>
    </div>
  );
};
