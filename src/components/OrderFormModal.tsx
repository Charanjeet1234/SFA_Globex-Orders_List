import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  DollarSign,
  Calendar,
  Ship,
  FileText,
  Plus,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Clock,
} from "lucide-react";
import { Order, Company, OrderStage, ORDER_STAGES } from "../types";
import { formatUSD, formatAED, convertUsdToAed } from "../utils/pdfGenerator";
import { computeSHA256 } from "../utils/encryption";
import { AedRateSelector } from "./AedRateSelector";
import { SFA_PRODUCT_CATALOG } from "../utils/mockData";

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  onSaveOrder: (order: Order) => void;
  onOpenAddCompany: () => void;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  companies,
  onSaveOrder,
  onOpenAddCompany,
}) => {
  // Generate next unique order number with SFA prefix
  const initialOrderNumber = `SFA-2026-${Math.floor(100 + Math.random() * 900)}`;

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [productName, setProductName] = useState(
    "Silico Manganese (SiMn 65/16)",
  );
  const [category, setCategory] = useState("Ferro Alloys");
  const [quantity, setQuantity] = useState<number>(250);
  const [unit, setUnit] = useState<Order["unit"]>("MT");

  const [exchangeRate, setExchangeRate] = useState<number>(3.6725);
  const [unitPriceUSD, setUnitPriceUSD] = useState<number>(980);
  const [advancePercent, setAdvancePercent] = useState<number>(20); // 20% default advance
  const [customAdvanceUSD, setCustomAdvanceUSD] = useState<number>(0);
  const [advanceMode, setAdvanceMode] = useState<
    "percent" | "custom_usd" | "custom_aed"
  >("percent");

  // New specific requirement: Allow user to select that only PI issued from company and waiting for PI to be signed from buyer
  const [isWaitingForBuyerPI, setIsWaitingForBuyerPI] = useState<boolean>(true);
  const [initialStage, setInitialStage] = useState<OrderStage>("pi_issued");

  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [shipmentDate, setShipmentDate] = useState<string>(
    new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10),
  );

  const [originPort, setOriginPort] = useState("Nhava Sheva Port, India");
  const [destinationPort, setDestinationPort] = useState(
    "Sohar Port, Sultanate of Oman",
  );
  const [carrierName, setCarrierName] = useState("Maersk Line / Hapag-Lloyd");
  const [notes, setNotes] = useState("");

  // Unit Price AED (Standard integer rounding: e.g. 1175 * 3.6745 = 4317.5375 -> 4318, 4317.2375 -> 4317)
  const unitPriceAED = convertUsdToAed(unitPriceUSD, exchangeRate);
  // Full Amount of Order: Quantity * USD Price, and Quantity * AED Price
  const totalAmountUSD = Math.round(quantity * unitPriceUSD);
  const totalAmountAED = Math.round(quantity * unitPriceAED);

  // Advance Payment
  const advancePaymentUSD =
    advanceMode === "percent"
      ? Math.round(totalAmountUSD * (advancePercent / 100))
      : Math.min(totalAmountUSD, Math.max(0, customAdvanceUSD));
  const advancePaymentAED = convertUsdToAed(advancePaymentUSD, exchangeRate);
  const effectiveAdvancePercent =
    totalAmountUSD > 0
      ? ((advancePaymentUSD / totalAmountUSD) * 100).toFixed(1)
      : "0.0";

  // Balance Payment: Full Amount - Advance Payment
  const balancePaymentUSD = Math.max(0, totalAmountUSD - advancePaymentUSD);
  const balancePaymentAED = Math.max(0, totalAmountAED - advancePaymentAED);

  // Sync initial company if available
  useEffect(() => {
    if (!companyId && companies.length > 0) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  if (!isOpen) return null;

  const handleSelectSfaProduct = (catalogItemName: string) => {
    const item = SFA_PRODUCT_CATALOG.find((p) => p.name === catalogItemName);
    if (item) {
      setProductName(item.name);
      setCategory(item.category);
      setUnit(item.defaultUnit);
      setUnitPriceUSD(item.suggestedPriceUSD);
    }
  };

  const handlePiWaitingToggle = (isWaiting: boolean) => {
    setIsWaitingForBuyerPI(isWaiting);
    if (isWaiting) {
      setInitialStage("pi_issued");
    } else {
      setInitialStage("pi_signed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    if (!normalizedOrderNumber) return;

    const selectedCompany = companies.find((c) => c.id === companyId) ||
      companies[0] || {
        id: "comp-general",
        name: "Trade Buyer LLC",
        country: "UAE",
      };

    const orderYear = new Date(orderDate).getFullYear() || 2026;
    const orderMonth = orderDate.slice(0, 7);
    const nowISO = new Date().toISOString();

    const stagesHistory: Order["stagesHistory"] = {
      pi_issued: {
        stage: "pi_issued",
        completedAt: nowISO,
        referenceNumber: `PI-${normalizedOrderNumber}`,
        notes: isWaitingForBuyerPI
          ? "Only PI issued from SFA Globex FZCO; waiting for signed PI from buyer."
          : "PI issued and submitted to buyer.",
        updatedBy: "SFA Globex Management",
      },
      pi_signed: {
        stage: "pi_signed",
        completedAt: !isWaitingForBuyerPI ? nowISO : undefined,
        referenceNumber: !isWaitingForBuyerPI
          ? `PI-${normalizedOrderNumber}-SIGNED`
          : undefined,
        notes: !isWaitingForBuyerPI
          ? `Signed PI received from ${selectedCompany.name}`
          : undefined,
      },
      advance_received: { stage: "advance_received" },
      date_of_shipment: {
        stage: "date_of_shipment",
        scheduledDate: shipmentDate,
      },
      shipment_dispatched: { stage: "shipment_dispatched" },
      bl_received: { stage: "bl_received" },
      got_full_money: { stage: "got_full_money" },
      bl_surrender: { stage: "bl_surrender" },
    };

    if (initialStage === "advance_received") {
      stagesHistory.advance_received = {
        stage: "advance_received",
        completedAt: nowISO,
        referenceNumber: `DEP-${Date.now().toString().slice(-6)}`,
        notes: `Advance deposit of ${formatUSD(advancePaymentUSD)} verified upon order booking.`,
      };
    }

    const checksumPayload = `${normalizedOrderNumber}:${selectedCompany.name}:${totalAmountUSD}:${balancePaymentUSD}:${nowISO}`;
    const hash = await computeSHA256(checksumPayload);

    const newOrder: Order = {
      // id: normalizedOrderNumber.toLowerCase(),
      // The database id must be a stable, URL-safe identifier that is never
      // derived from user-editable text. Order numbers can contain slashes
      // (e.g. "SFA/26-27/PI/HCFEMN-012"), which breaks routing when used as
      // an id in REST paths like /api/orders/{id}. Generate a proper unique
      // id here instead, independent of the order number.
      id: crypto.randomUUID(),
      orderNumber: normalizedOrderNumber,
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
      advancePaymentUSD,
      advancePaymentAED,
      balancePaymentUSD,
      balancePaymentAED,
      currentStage: initialStage,
      isWaitingForBuyerPI,
      stagesHistory,
      orderDate,
      year: orderYear,
      month: orderMonth,
      paymentDueDate,
      shipmentDate,
      originPort,
      destinationPort,
      carrierName,
      isFullPaymentReceived: balancePaymentUSD === 0,
      isCompleted: initialStage === "bl_surrender",
      isOverdue: false,
      notes,
      encryptedChecksum: `sha256:${hash.slice(0, 24)}`,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    onSaveOrder(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              SFA Globex FZCO (sfaglobex.ae) — Trade Registry
            </span>
            <h2 className="text-xl font-black text-white mt-0.5">
              Create New Trade Order
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[75vh] overflow-y-auto"
        >
          {/* Section 1: Order Identifier & Buyer Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unique Order ID / Number *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono font-bold bg-slate-50 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. SFA-2026-108"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Buyer Company Name *
                </label>
                <button
                  type="button"
                  onClick={onOpenAddCompany}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Buyer Company
                </button>
              </div>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
              >
                {companies.length === 0 ? (
                  <option value="">
                    No companies registered — please click Add Buyer Company
                  </option>
                ) : (
                  companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.country})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* New Specific User Requirement: Option to select that only PI issued from company and waiting for PI to be signed from buyer */}
          <div
            className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 space-y-3"
            id="pi-status-selection-container"
          >
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-700" />
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Contract Inception & PI Status (Initial Step) *
              </label>
            </div>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              Select the initial status of the deal. If only the Proforma
              Invoice has been dispatched to the client, select the option below
              to track buyer signature.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  isWaitingForBuyerPI
                    ? "bg-white border-amber-500 ring-2 ring-amber-400/40 shadow-xs"
                    : "bg-white/70 border-amber-200 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="piStatusChoice"
                  checked={isWaitingForBuyerPI}
                  onChange={() => handlePiWaitingToggle(true)}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Only PI issued from company (Waiting for PI to be signed
                    from buyer)
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                    Order starts at Stage 1 (PI Issued). Awaiting signed
                    counter-copy.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  !isWaitingForBuyerPI
                    ? "bg-white border-blue-500 ring-2 ring-blue-400/40 shadow-xs"
                    : "bg-white/70 border-slate-200 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="piStatusChoice"
                  checked={!isWaitingForBuyerPI}
                  onChange={() => handlePiWaitingToggle(false)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    PI signed from buyer
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    Buyer has already signed and accepted the Proforma Invoice.
                    Ready for advance.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Commodity & SFA Globex Product Catalog */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Product / Commodity Description *
              </label>
              <span className="text-[11px] text-slate-500">
                SFA Globex Products (Click to pre-fill):
              </span>
            </div>

            {/* Quick SFA Product Badges */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {SFA_PRODUCT_CATALOG.slice(0, 6).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleSelectSfaProduct(item.name)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                    productName === item.name
                      ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  {item.name.split("(")[0]}
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
                  placeholder="e.g. Silico Manganese (SiMn 65/16), High Carbon Ferro Chrome, MS Billets..."
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
                  <option value="Recycled Metals & Scrap">
                    Recycled Metals & Scrap
                  </option>
                  <option value="Steel Products">Steel Products</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, parseInt(e.target.value) || 0))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Measurement Unit
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Order["unit"])}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="MT">Metric Tons (MT)</option>
                  <option value="Containers (TEU)">Containers (TEU)</option>
                  <option value="KG">Kilograms (KG)</option>
                  <option value="Units">Units</option>
                  <option value="Pcs">Pieces (Pcs)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: AED Rate Selection (3.6725 or 3.6745 and Custom) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <AedRateSelector
              currentRate={exchangeRate}
              onChangeRate={(rate) => setExchangeRate(rate)}
              label="Select AED Rate for Order (3.6725, 3.6745, or Custom)"
            />
          </div>

          {/* Section 4: Pricing in USD and in AED + Live Balance Calculation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Multi-Currency Pricing & Balance Setup
              </span>
              <div className="text-[11px] font-mono text-slate-600">
                1 USD = {exchangeRate.toFixed(4)} AED
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit Price in USD ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={unitPriceUSD}
                    onChange={(e) =>
                      setUnitPriceUSD(parseFloat(e.target.value) || 0)
                    }
                    className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Calculated Unit Price in AED (د.إ)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${unitPriceAED.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} AED`}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-700"
                />
              </div>
            </div>

            {/* Advance payment options */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    Advance Payment Structure
                  </label>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {effectiveAdvancePercent}% of Total Order
                  </span>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceMode("percent");
                      setCustomAdvanceUSD(
                        Math.round(totalAmountUSD * (advancePercent / 100)),
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === "percent"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Quick % Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceMode("custom_usd");
                      setCustomAdvanceUSD(advancePaymentUSD);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === "custom_usd"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Custom USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceMode("custom_aed");
                      setCustomAdvanceUSD(advancePaymentUSD);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      advanceMode === "custom_aed"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Custom AED
                  </button>
                </div>
              </div>

              {/* Mode 1: Quick % Preset */}
              {advanceMode === "percent" && (
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {[10, 15, 20, 25, 30, 40, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setAdvancePercent(pct);
                          setCustomAdvanceUSD(
                            Math.round(totalAmountUSD * (pct / 100)),
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          advancePercent === pct
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pct}% {pct === 100 ? "(Full)" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode 2: Custom USD Input */}
              {advanceMode === "custom_usd" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-600">
                    Enter Exact Custom Advance in US Dollars:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={totalAmountUSD}
                      value={advancePaymentUSD}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(
                            totalAmountUSD,
                            parseFloat(e.target.value) || 0,
                          ),
                        );
                        setCustomAdvanceUSD(val);
                      }}
                      placeholder="e.g. 50000"
                      className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Mode 3: Custom AED Input */}
              {advanceMode === "custom_aed" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-600">
                    Enter Exact Custom Advance in UAE Dirhams (AED):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                      AED
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={totalAmountAED}
                      value={advancePaymentAED}
                      onChange={(e) => {
                        const aedVal = Math.max(
                          0,
                          parseFloat(e.target.value) || 0,
                        );
                        const usdCalculated = Math.round(aedVal / exchangeRate);
                        setCustomAdvanceUSD(
                          Math.min(totalAmountUSD, usdCalculated),
                        );
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
                  <span className="text-slate-500">Advance (USD):</span>
                  <span className="font-bold text-slate-900">
                    {formatUSD(advancePaymentUSD)}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Advance (AED):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatAED(advancePaymentAED)}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Financial Breakdown Highlight Box: Balance = Full Amount - Advance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Total Full Amount
                </div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {formatUSD(totalAmountUSD)}
                </div>
                <div className="text-xs font-semibold text-slate-600 font-mono">
                  {formatAED(totalAmountAED)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono leading-tight space-y-0.5 border-t border-slate-100 pt-1">
                  <div>
                    Qty × USD: {quantity} {unit} × {formatUSD(unitPriceUSD)}
                  </div>
                  <div>
                    Qty × AED: {quantity} {unit} × {formatAED(unitPriceAED)}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">
                  Advance Deposit
                </div>
                <div className="text-base font-black text-emerald-700 mt-0.5">
                  {formatUSD(advancePaymentUSD)}
                </div>
                <div className="text-xs font-medium text-emerald-800/80">
                  {formatAED(advancePaymentAED)}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300">
                <div className="text-[10px] font-bold text-amber-900 uppercase flex items-center justify-between">
                  <span>Balance Due</span>
                  <span className="text-[9px] font-mono font-semibold">
                    Full - Advance
                  </span>
                </div>
                <div className="text-base font-black text-amber-800 mt-0.5">
                  {formatUSD(balancePaymentUSD)}
                </div>
                <div className="text-xs font-medium text-amber-900/80">
                  {formatAED(balancePaymentAED)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Operational Dates & Port Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order Booking Date
              </label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Scheduled Shipment Date
              </label>
              <input
                type="date"
                required
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                required
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Origin Port
              </label>
              <input
                type="text"
                value={originPort}
                onChange={(e) => setOriginPort(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                placeholder="e.g. Nhava Sheva / Jebel Ali Port"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Destination Port
              </label>
              <input
                type="text"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                placeholder="e.g. Sohar Port, Oman / Alexandria Port"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Order Notes & Trade Specifications
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inspection by SGS/Alex Stewart at load port. Incoterm CIF Sohar..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Modal Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="submit-create-order-btn"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Register & Initialize Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
