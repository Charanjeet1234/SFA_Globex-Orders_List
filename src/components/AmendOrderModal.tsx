import { normalizeOrderPayments, hasAdvanceReceived } from '../../lib/order-payments.js';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  DollarSign, 
  Calendar, 
  Ship, 
  FileText, 
  Save, 
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Order, Company, OrderLot, OrderStage, ORDER_STAGES } from '../types';
import { formatUSD, formatAED, formatAEDDecimal, convertUsdToAed } from '../utils/pdfGenerator';
import { computeSHA256 } from '../utils/encryption';
import { AedRateSelector } from './AedRateSelector';
import { LotSplitConfiguration } from './LotSplitConfiguration';
import { SFA_PRODUCT_CATALOG } from '../utils/mockData';
import { isLotSplitEligible, isValidLotDistribution, normalizeLots, summarizeLots } from '../../lib/order-lots.js';

interface AmendOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  onUpdateOrder: (updatedOrder: Order) => void;
}

export const AmendOrderModal: React.FC<AmendOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  companies,
  onUpdateOrder,
}) => {
  if (!isOpen || !order) return null;

  return (
    <AmendOrderForm
      order={order}
      onClose={onClose}
      companies={companies}
      onUpdateOrder={onUpdateOrder}
    />
  );
};

interface AmendOrderFormProps {
  order: Order;
  onClose: () => void;
  companies: Company[];
  onUpdateOrder: (updatedOrder: Order) => void;
}

const AmendOrderForm: React.FC<AmendOrderFormProps> = ({
  order,
  onClose,
  companies,
  onUpdateOrder,
}) => {
  const [orderNumber, setOrderNumber] = useState(order.orderNumber);
  const [companyId, setCompanyId] = useState(order.companyId);
  const [productName, setProductName] = useState(order.productName);
  const [category, setCategory] = useState(order.category || 'Ferro Alloys');
  const [quantity, setQuantity] = useState<number>(order.quantity);
  const [unit, setUnit] = useState<Order['unit']>(order.unit);
  
  const [exchangeRate, setExchangeRate] = useState<number>(order.exchangeRateUsdToAed || 3.6725);
  const [unitPriceUSD, setUnitPriceUSD] = useState<number>(order.unitPriceUSD);
  
  // Advance payment state
  const [advancePaymentUSD, setAdvancePaymentUSD] = useState<number>(order.advancePaymentUSD);
  const [advanceMode, setAdvanceMode] = useState<'percent' | 'custom_usd' | 'custom_aed'>('custom_usd');
  const [lots, setLots] = useState<OrderLot[]>(order.lots || []);
  const [lotSubmitError, setLotSubmitError] = useState<string | null>(null);
  const [isThirdPartyOrder, setIsThirdPartyOrder] = useState(Boolean(order.isThirdPartyOrder));
  const [thirdPartyName, setThirdPartyName] = useState(order.thirdPartyName || '');
  const [commissionPerMTUSD, setCommissionPerMTUSD] = useState(order.commissionPerMTUSD || 0);
  
  // Stage & PI Status
  const [currentStage, setCurrentStage] = useState<OrderStage>(order.currentStage);
  const [isWaitingForBuyerPI, setIsWaitingForBuyerPI] = useState<boolean>(
    order.isWaitingForBuyerPI ?? (order.currentStage === 'pi_issued')
  );

  // Logistics & Dates
  const [orderDate, setOrderDate] = useState<string>(order.orderDate);
  const [shipmentDate, setShipmentDate] = useState<string>(order.shipmentDate || '');
  const [paymentDueDate, setPaymentDueDate] = useState<string>(order.paymentDueDate || '');
  const [originPort, setOriginPort] = useState(order.originPort || 'Jebel Ali Port, UAE');
  const [destinationPort, setDestinationPort] = useState(order.destinationPort || '');
  const [carrierName, setCarrierName] = useState(order.carrierName || '');
  const [vesselName, setVesselName] = useState(order.vesselName || '');
  const [containerNumber, setContainerNumber] = useState(order.containerNumber || '');
  const [billOfLadingNumber, setBillOfLadingNumber] = useState(order.billOfLadingNumber || '');
  const [notes, setNotes] = useState(order.notes || '');

  // Live Calculations: Full amount of order = quantity * USD price, and quantity * AED price
  const unitPriceAED = convertUsdToAed(unitPriceUSD, exchangeRate);
  const totalAmountUSD = Math.round(quantity * unitPriceUSD);
  const totalAmountAED = Math.round(quantity * unitPriceAED);
  const advancePaymentAED = convertUsdToAed(advancePaymentUSD, exchangeRate);
  const commissionRate = 3.67;
  const commissionPerMTAED = commissionPerMTUSD * commissionRate;
  const totalCommissionUSD = isThirdPartyOrder && unit === 'MT'
    ? Math.round(quantity * commissionPerMTUSD)
    : 0;
  const totalCommissionAED = isThirdPartyOrder && unit === 'MT'
    ? Math.round(totalCommissionUSD * commissionRate)
    : 0;
  const isLotSplitOrder = isLotSplitEligible(quantity, unit);
  const lotPricing = { unitPriceUSD, unitPriceAED, exchangeRate };
  const advanceReceivedForOrder = hasAdvanceReceived({ ...order, currentStage });
  const normalizedLots = isLotSplitOrder
    ? normalizeLots(lots, lotPricing, { defaultStage: currentStage })
    : [];
  const hasLotConfiguration = normalizedLots.length > 0;
  const lotSummary = summarizeLots(normalizedLots);
  const lotDistributionValid = isValidLotDistribution(normalizedLots, quantity);
  const effectiveAdvancePaymentUSD = hasLotConfiguration ? lotSummary.advanceUSD : advancePaymentUSD;
  const effectiveAdvancePaymentAED = hasLotConfiguration ? lotSummary.advanceAED : advancePaymentAED;
  
  // Balance calculation: Full Amount - Advance Payment
  const { balancePaymentUSD, balancePaymentAED } = normalizeOrderPayments({
    ...order,
    currentStage,
    totalAmountUSD,
    totalAmountAED,
    advancePaymentUSD: effectiveAdvancePaymentUSD,
    advancePaymentAED: effectiveAdvancePaymentAED,
    lots: hasLotConfiguration ? normalizedLots : undefined,
  });

  // Handle stage change
  const handleStageSelect = (stage: OrderStage) => {
    setCurrentStage(stage);
    if (stage === 'pi_issued') {
      setIsWaitingForBuyerPI(true);
    } else {
      setIsWaitingForBuyerPI(false);
    }
  };

  // Handle PI status toggle
  const handlePiWaitingToggle = (isWaiting: boolean) => {
    setIsWaitingForBuyerPI(isWaiting);
    if (isWaiting) {
      setCurrentStage('pi_issued');
    } else if (currentStage === 'pi_issued') {
      setCurrentStage('pi_signed');
    }
  };

  // Quick select SFA product
  const handleSelectSfaProduct = (catalogItemName: string) => {
    const item = SFA_PRODUCT_CATALOG.find(p => p.name === catalogItemName);
    if (item) {
      setProductName(item.name);
      setCategory(item.category);
      setUnit(item.defaultUnit);
      setUnitPriceUSD(item.suggestedPriceUSD);
    }
  };

  const handleAdvancePercentQuick = (pct: number) => {
    const calc = Math.round(totalAmountUSD * (pct / 100));
    setAdvancePaymentUSD(calc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLotSplitOrder && (!hasLotConfiguration || !lotDistributionValid)) {
      setLotSubmitError(hasLotConfiguration
        ? 'Lot quantities must add up exactly to the order quantity before saving.'
        : 'Choose a lot distribution for this order before saving.');
      return;
    }

    const selectedCompany = companies.find(c => c.id === companyId) || {
      id: order.companyId,
      name: order.companyName,
    };

    const orderYear = new Date(orderDate).getFullYear() || order.year || 2026;
    const orderMonth = orderDate.slice(0, 7);
    const nowISO = new Date().toISOString();

    // Preserve and update stagesHistory
    const updatedStagesHistory = { ...order.stagesHistory };
    if (!updatedStagesHistory[currentStage]) {
      updatedStagesHistory[currentStage] = {
        stage: currentStage,
        completedAt: nowISO,
        notes: `Amended and set to stage ${currentStage}`,
        updatedBy: 'SFA Globex Trade Operations'
      };
    }

    if (currentStage === 'date_of_shipment' && shipmentDate) {
      updatedStagesHistory.date_of_shipment = {
        ...updatedStagesHistory.date_of_shipment,
        stage: 'date_of_shipment',
        scheduledDate: shipmentDate,
      };
    }

    if (billOfLadingNumber && (currentStage === 'bl_received' || currentStage === 'bl_surrender')) {
      if (updatedStagesHistory.bl_received) {
        updatedStagesHistory.bl_received.referenceNumber = billOfLadingNumber;
      }
    }

    const checksumPayload = `${orderNumber}:${selectedCompany.name}:${totalAmountUSD}:${balancePaymentUSD}:${nowISO}`;
    const hash = await computeSHA256(checksumPayload);

    const isFullPayment = balancePaymentUSD === 0 || currentStage === 'got_full_money' || currentStage === 'bl_surrender';

    const updatedOrder: Order = {
      ...order,
      orderNumber,
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      productName,
      category,
      quantity,
      unit,
      exchangeRateUsdToAed: exchangeRate,
      unitPriceUSD,
      unitPriceAED,
      totalAmountUSD,
      totalAmountAED,
      advancePaymentUSD: effectiveAdvancePaymentUSD,
      advancePaymentAED: effectiveAdvancePaymentAED,
      balancePaymentUSD,
      balancePaymentAED,
      lots: hasLotConfiguration ? normalizedLots : undefined,
      isThirdPartyOrder,
      thirdPartyName: isThirdPartyOrder ? thirdPartyName.trim() || undefined : undefined,
      commissionPerMTUSD: isThirdPartyOrder && unit === 'MT' ? commissionPerMTUSD : undefined,
      commissionPerMTAED: isThirdPartyOrder && unit === 'MT' ? commissionPerMTAED : undefined,
      totalCommissionUSD: isThirdPartyOrder && unit === 'MT' ? totalCommissionUSD : undefined,
      totalCommissionAED: isThirdPartyOrder && unit === 'MT' ? totalCommissionAED : undefined,
      currentStage,
      isWaitingForBuyerPI,
      stagesHistory: updatedStagesHistory,
      orderDate,
      year: orderYear,
      month: orderMonth,
      paymentDueDate,
      shipmentDate,
      originPort,
      destinationPort,
      carrierName,
      vesselName,
      containerNumber,
      billOfLadingNumber,
      isFullPaymentReceived: isFullPayment,
      isCompleted: currentStage === 'bl_surrender',
      notes,
      encryptedChecksum: `sha256:${hash.slice(0, 24)}`,
      updatedAt: nowISO,
    };

    onUpdateOrder(updatedOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Order Amendment & Update
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {order.orderNumber}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              Amend & Update Trade Order
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Section 1: Buyer Company & Order Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order Reference Number *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono font-bold bg-slate-50 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Buyer Company *
              </label>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Special Field: PI Status (Only PI Issued vs PI Signed) */}
          <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/70 space-y-3" id="amend-pi-status-box">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-700" />
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Contract Inception & Proforma Invoice (PI) Status *
              </label>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-amber-200 cursor-pointer hover:bg-amber-100/30 transition">
                <input
                  type="radio"
                  name="amendPiStatusOption"
                  checked={isWaitingForBuyerPI}
                  onChange={() => handlePiWaitingToggle(true)}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Only PI issued from SFA Globex (Waiting for PI to be signed from buyer)
                  </span>
                  <span className="text-[11px] text-slate-600">
                    Stage will be set to "PI Issued". Cargo dispatch and advance deposit pending signed counter-copy.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="amendPiStatusOption"
                  checked={!isWaitingForBuyerPI}
                  onChange={() => handlePiWaitingToggle(false)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    PI Signed from buyer (Contract formally ratified)
                  </span>
                  <span className="text-[11px] text-slate-600">
                    Buyer has returned signed & stamped Proforma Invoice. Ready to log advance deposit & chartering.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* SFA Globex Product & Category */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Commodity / Product Description *
              </label>
              <span className="text-[11px] text-slate-500">
                Quick load from SFA Globex catalog:
              </span>
            </div>

            {/* Quick SFA Catalog Picker */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {SFA_PRODUCT_CATALOG.slice(0, 6).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleSelectSfaProduct(item.name)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                    productName === item.name
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {item.name.split('(')[0]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Product name (e.g. Silico Manganese 65/16)"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Ferro Alloys">Ferro Alloys</option>
                  <option value="Minerals & Ores">Minerals & Ores</option>
                  <option value="Recycled Metals & Scrap">Recycled Metals & Scrap</option>
                  <option value="Steel Products">Steel Products</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  step="0.01"
                  onChange={(e) => {
                    setLotSubmitError(null);
                    setQuantity(Math.max(1, Number(e.target.value) || 0));
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit of Measurement
                </label>
                <select
                  value={unit}
                  onChange={(e) => {
                    setLotSubmitError(null);
                    setUnit(e.target.value as Order['unit']);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="MT">Metric Ton (MT)</option>
                  <option value="Containers (TEU)">Containers (TEU)</option>
                  <option value="KG">Kilograms (KG)</option>
                  <option value="Units">Units</option>
                  <option value="Pcs">Pieces</option>
                </select>
              </div>
            </div>

            <LotSplitConfiguration
              quantity={quantity}
              unit={unit}
              unitPriceUSD={unitPriceUSD}
              unitPriceAED={unitPriceAED}
              exchangeRate={exchangeRate}
              lots={normalizedLots}
              currentStage={currentStage}
              onLotsChange={(nextLots) => {
                setLotSubmitError(null);
                setLots(nextLots);
              }}
            />
            {lotSubmitError && (
              <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {lotSubmitError}
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-black text-violet-950">
                <input
                  type="checkbox"
                  checked={isThirdPartyOrder}
                  onChange={(event) => setIsThirdPartyOrder(event.target.checked)}
                  className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
                />
                Order received through a third party
              </label>
              {isThirdPartyOrder && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">Third-party / broker name</label>
                    <input
                      value={thirdPartyName}
                      onChange={(event) => setThirdPartyName(event.target.value)}
                      placeholder="Broker or referral partner"
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">Commission per MT (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={commissionPerMTUSD}
                      onChange={(event) => setCommissionPerMTUSD(Math.max(0, Number(event.target.value) || 0))}
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                    {unit === 'MT' ? (
                      <><span className="font-black text-violet-900">Commission total:</span> {formatAED(totalCommissionAED)} <span className="font-mono text-slate-500">({formatUSD(totalCommissionUSD)})</span> · {formatAEDDecimal(commissionPerMTAED)} / MT <span className="text-slate-500">at AED 3.67/USD</span></>
                    ) : 'Commission is calculated per MT. Select Metric Tons (MT) to enable the total.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: AED Exchange Rate Selector (3.6725, 3.6745, or Custom) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <AedRateSelector
              currentRate={exchangeRate}
              onChangeRate={(rate) => setExchangeRate(rate)}
              label="AED Exchange Rate for Order Pricing & Balances"
            />
          </div>

          {/* Section: Pricing & Dual Currency Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unit Price (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-500">$</span>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={unitPriceUSD}
                  onChange={(e) => setUnitPriceUSD(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Equivalent: <span className="font-mono font-medium text-slate-800">{formatAED(unitPriceAED)}</span> / {unit}
              </p>
            </div>

            {/* Advance payment amendment options */}
            {hasLotConfiguration ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-slate-700">
                <p className="font-black text-blue-950">Lot-level payments are active</p>
                <p className="mt-1 leading-relaxed">Update each lot&apos;s advance above. The final amount remains the full lot total until the advance is recorded.</p>
              </div>
            ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    Amend Advance Payment Deposit
                  </label>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {totalAmountUSD > 0 ? ((advancePaymentUSD / totalAmountUSD) * 100).toFixed(1) : '0.0'}% of Total Order
                  </span>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAdvanceMode('percent')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === 'percent'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quick %
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceMode('custom_usd')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === 'custom_usd'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceMode('custom_aed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === 'custom_aed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom AED
                  </button>
                </div>
              </div>

              {/* Mode 1: Quick % Preset */}
              {advanceMode === 'percent' && (
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    {[10, 15, 20, 25, 30, 40, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleAdvancePercentQuick(pct)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          Math.round(totalAmountUSD * (pct / 100)) === advancePaymentUSD
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pct}% {pct === 100 ? '(Full)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode 2: Custom USD Input */}
              {advanceMode === 'custom_usd' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Enter Exact Custom Advance in USD:</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      max={totalAmountUSD}
                      value={advancePaymentUSD}
                      onChange={(e) => setAdvancePaymentUSD(Math.min(totalAmountUSD, Math.max(0, Number(e.target.value))))}
                      placeholder="e.g. 50000"
                      className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Mode 3: Custom AED Input */}
              {advanceMode === 'custom_aed' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Enter Exact Custom Advance in UAE Dirhams (AED):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">AED</span>
                    <input
                      type="number"
                      min="0"
                      max={totalAmountAED}
                      value={advancePaymentAED}
                      onChange={(e) => {
                        const aedVal = Math.max(0, parseFloat(e.target.value) || 0);
                        const usdCalculated = Math.round(aedVal / exchangeRate);
                        setAdvancePaymentUSD(Math.min(totalAmountUSD, usdCalculated));
                      }}
                      placeholder="e.g. 180000"
                      className="w-full text-xs pl-12 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Real-time Advance Values Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Amended Advance (AED):</span>
                  <span className="font-bold text-slate-900">{formatAED(advancePaymentAED)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Amended Advance (USD):</span>
                  <span className="font-mono font-bold text-slate-900">{formatUSD(advancePaymentUSD)}</span>
                </div>
              </div>

              {order.advancePaymentUSD !== advancePaymentUSD && (
                <div className="text-[11px] text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center justify-between">
                  <span>Previous Advance: {formatAED(order.advancePaymentAED)} ({formatUSD(order.advancePaymentUSD)})</span>
                  <span className="font-bold">
                    {advancePaymentUSD > order.advancePaymentUSD ? '+' : ''}{formatUSD(advancePaymentUSD - order.advancePaymentUSD)}
                  </span>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Real-time Calculation Summary: Full Amount - Advance Payment = Balance Payment */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm space-y-3">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
              Financial Summary (Auto-Computed at {exchangeRate.toFixed(4)} AED/USD)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Total Order Amount</span>
                <span className="text-base font-black text-white block mt-0.5">{formatAED(totalAmountAED)}</span>
                <span className="text-[11px] text-slate-300 font-mono block">{formatUSD(totalAmountUSD)}</span>
                <div className="text-[9px] text-slate-400 mt-1 font-mono leading-tight space-y-0.5 border-t border-slate-700/60 pt-1">
                  <div>Qty × AED: {quantity} {unit} × {formatAED(unitPriceAED)}</div>
                  <div>Qty × USD: {quantity} {unit} × {formatUSD(unitPriceUSD)}</div>
                </div>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[11px]">{hasLotConfiguration ? 'Total Lot Advance' : 'Advance'}</span>
                <span className="text-base font-black text-emerald-400 block mt-0.5">{formatAED(effectiveAdvancePaymentAED)}</span>
                <span className="text-[11px] text-slate-400 font-mono">{formatUSD(effectiveAdvancePaymentUSD)}</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-amber-500/40">
                <span className="text-amber-300 block text-[11px] font-semibold">{hasLotConfiguration ? `Total Lot Final Amount (${advanceReceivedForOrder ? 'After Advance' : 'Full Lot Totals'})` : `Balance Payment (${advanceReceivedForOrder ? 'Full - Advance' : 'Full Amount'})`}</span>
                <span className="text-base font-black text-amber-400 block mt-0.5">{formatAED(balancePaymentAED)}</span>
                <span className="text-[11px] text-slate-400 font-mono">{formatUSD(balancePaymentUSD)}</span>
              </div>
            </div>
          </div>

          {/* Section: Stage Management */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Update Current Process Stage
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ORDER_STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStageSelect(s.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    currentStage === s.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-[10px] font-bold opacity-80">Stage {s.stepNumber}</div>
                  <div className="text-xs font-bold leading-tight mt-0.5">{s.shortName}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Logistics & Milestones */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Logistics & Shipping Particulars
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Target Shipment Date</label>
                <input
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Payment Due Date</label>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Origin Port</label>
                <input
                  type="text"
                  value={originPort}
                  onChange={(e) => setOriginPort(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Destination Port</label>
                <input
                  type="text"
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Carrier Line</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Vessel Name</label>
                <input
                  type="text"
                  value={vesselName}
                  onChange={(e) => setVesselName(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">BL Number</label>
                <input
                  type="text"
                  value={billOfLadingNumber}
                  onChange={(e) => setBillOfLadingNumber(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Container Number(s)</label>
                <input
                  type="text"
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Amendment Remarks & Special Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Terms amended as per revised LC / buyer request..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-amended-order-btn"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              Save & Update Order
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
