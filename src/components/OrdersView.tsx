import { hasAdvanceReceived, receivedPaymentUSD } from '../../lib/order-payments.js';
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Ship, 
  ShieldCheck, 
  DollarSign, 
  Layers,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  FileCheck,
  PackageCheck
} from 'lucide-react';
import { Order, OrderStage, ORDER_STAGES, UserRole } from '../types';
import { formatUSD, formatAED, generateOrderPDF } from '../utils/pdfGenerator';

interface OrdersViewProps {
  orders: Order[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedYear: number | 'all';
  setSelectedYear: (y: number | 'all') => void;
  userRole: UserRole;
  onSelectOrder: (order: Order) => void;
  onOpenOrderForm: () => void;
  onAdvanceStage: (order: Order) => void;
  onQuickPayBalance: (order: Order) => void;
  onAmendOrder: (order: Order) => void;
  onDeleteOrder: (order: Order) => void;
  onLoadSampleOrder?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  searchQuery,
  setSearchQuery,
  selectedYear,
  setSelectedYear,
  userRole,
  onSelectOrder,
  onOpenOrderForm,
  onAdvanceStage,
  onQuickPayBalance,
  onAmendOrder,
  onDeleteOrder,
  onLoadSampleOrder,
}) => {
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyPendingBalance, setOnlyPendingBalance] = useState(false);
  const [onlyWaitingPI, setOnlyWaitingPI] = useState(false);
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');

  // Multi-attribute filtering: search query (product name or company name), year-wise, stage, overdue
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search query (product or company name or order number)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = order.productName.toLowerCase().includes(q);
        const matchCompany = order.companyName.toLowerCase().includes(q);
        const matchId = order.orderNumber.toLowerCase().includes(q);
        const matchBL = (order.billOfLadingNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchCompany && !matchId && !matchBL) {
          return false;
        }
      }

      // Year-wise filter
      if (selectedYear !== 'all') {
        if (order.year !== selectedYear) return false;
      }

      // Stage filter
      if (selectedStageFilter !== 'all') {
        if (order.currentStage !== selectedStageFilter) return false;
      }

      // Overdue toggle
      if (onlyOverdue) {
        if (!order.isOverdue) return false;
      }

      // Pending balance toggle
      if (onlyPendingBalance) {
        if (order.balancePaymentUSD <= 0) return false;
      }

      // Waiting for buyer PI toggle
      if (onlyWaitingPI) {
        if (!order.isWaitingForBuyerPI && order.currentStage !== 'pi_issued') return false;
      }

      return true;
    });
  }, [orders, searchQuery, selectedYear, selectedStageFilter, onlyOverdue, onlyPendingBalance, onlyWaitingPI]);

  // Stage progress helper: 1-8 step number and percentage
  const getStageStep = (stage: OrderStage) => {
    const idx = ORDER_STAGES.findIndex(s => s.id === stage);
    return idx >= 0 ? idx + 1 : 1;
  };

  const getStagePercentage = (stage: OrderStage, isCompleted: boolean) => {
    if (isCompleted) return 100;
    const step = getStageStep(stage);
    return Math.round((step / ORDER_STAGES.length) * 100);
  };

  // Extract available years for year-wise filter
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    orders.forEach(o => years.add(o.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  return (
    <div className="space-y-6" id="orders-view-root">
      
      {/* Search & Filter Command Center */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col items-stretch gap-4">
          
          {/* Search bar (Order names, commodity, and Company names) */}
          <div className="relative w-full min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="order-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders, companies, or IDs…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Groupings */}
          <div className="flex w-full flex-wrap items-center gap-2 text-xs xl:justify-end">
            {/* Year-wise Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-semibold">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Years</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Waiting for Buyer PI Toggle */}
            <button
              onClick={() => setOnlyWaitingPI(!onlyWaitingPI)}
              className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-xl border transition ${
                onlyWaitingPI
                  ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Waiting <span className="hidden sm:inline">Buyer </span>PI</span>
            </button>

            {/* Overdue Payments Toggle */}
            <button
              onClick={() => setOnlyOverdue(!onlyOverdue)}
              className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-xl border transition ${
                onlyOverdue
                  ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Overdue Only</span>
            </button>

            {/* Pending Balance Toggle */}
            <button
              onClick={() => setOnlyPendingBalance(!onlyPendingBalance)}
              className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-xl border transition ${
                onlyPendingBalance
                  ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              <span><span className="hidden sm:inline">Pending </span>Balances</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

            {/* View Layout Toggle */}
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                onClick={() => setViewLayout('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  viewLayout === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Cards<span className="hidden sm:inline"> View</span>
              </button>
              <button
                onClick={() => setViewLayout('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  viewLayout === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Table<span className="hidden sm:inline"> View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stage Filter Pills */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] shrink-0 mr-1">
            Stage:
          </span>
          <button
            onClick={() => setSelectedStageFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
              selectedStageFilter === 'all'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Stages ({orders.length})
          </button>

          {ORDER_STAGES.map((s) => {
            const count = orders.filter(o => o.currentStage === s.id).length;
            const isSelected = selectedStageFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStageFilter(s.id)}
                className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{s.shortName}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Results Counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-900">{filteredOrders.length}</strong> of{' '}
          <strong>{orders.length}</strong> SFA Globex orders
          {selectedYear !== 'all' && ` in ${selectedYear}`}
        </span>
        {searchQuery && (
          <span>Filtered by &quot;{searchQuery}&quot;</span>
        )}
      </div>

      {/* Empty state if 0 orders */}
      {orders.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 sm:p-14 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">
              Clean Trade Slate — SFA Globex FZCO
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Custom mock data has been cleared as requested. You can now register real trade orders for ferro alloys, metals, and minerals with dynamic AED rates (3.6725 / 3.6745 / custom) and tracking for buyer-signed PIs.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenOrderForm}
              id="empty-state-create-order-btn"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Trade Order</span>
            </button>
            {onLoadSampleOrder && (
              <button
                onClick={onLoadSampleOrder}
                id="empty-state-load-sample-btn"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Load Sample SFA Order</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty search results */}
      {orders.length > 0 && filteredOrders.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Search className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Orders Match Filters</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No active trade orders match the current search filters or year selection. Try clearing your filters or create a new order.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('all');
                setSelectedStageFilter('all');
                setOnlyOverdue(false);
                setOnlyPendingBalance(false);
                setOnlyWaitingPI(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
            >
              Reset Filters
            </button>
            <button
              onClick={onOpenOrderForm}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
            >
              + Create New Order
            </button>
          </div>
        </div>
      )}

      {/* Cards View: Rich Visual Progress Bars for Each Order */}
      {viewLayout === 'cards' && filteredOrders.length > 0 && (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const currentStageInfo = ORDER_STAGES.find(s => s.id === order.currentStage) || ORDER_STAGES[0];
            const currentStep = getStageStep(order.currentStage);
            const progressPercent = getStagePercentage(order.currentStage, order.isCompleted);
            const advanceRatio = order.totalAmountUSD > 0 
              ? Math.round((order.advancePaymentUSD / order.totalAmountUSD) * 100) 
              : 0;

            const isWaitingPI = order.isWaitingForBuyerPI || order.currentStage === 'pi_issued';

            return (
              <div
                key={order.id}
                id={`order-card-${order.orderNumber}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {/* Card Header: Unique ID, Company, Dates & Badges */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/60 via-white to-slate-50/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {order.year}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                            {order.orderNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {order.category}
                          </span>

                          {/* Specific SFA Globex Badge: Awaiting Signed PI */}
                          {isWaitingPI && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <FileCheck className="w-3 h-3 text-amber-700" />
                              AWAITING BUYER SIGNED PI
                            </span>
                          )}

                          {order.isOverdue && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 border border-rose-200 flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3" /> OVERDUE PAYMENT
                            </span>
                          )}
                          {order.isCompleted && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 100% COMPLETED
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                          <div className="flex min-w-0 basis-full items-center gap-1.5 sm:basis-auto">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                            <span className="font-semibold text-slate-800 sm:whitespace-nowrap">{order.companyName}</span>
                          </div>
                          <span className="hidden text-slate-300 sm:inline">•</span>
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>Booked: {order.orderDate}</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="whitespace-nowrap text-[11px] font-mono text-slate-500">
                            FX: 1 USD = {order.exchangeRateUsdToAed || 3.6725} AED
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick action buttons: Amend, Delete, PDF, Details */}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {/* Amend / Update Button */}
                      <button
                        onClick={() => onAmendOrder(order)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold border border-slate-200 hover:border-blue-300 transition"
                        title="Amend and Update Order Details"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Amend</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteOrder(order)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 transition"
                        title="Delete Order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* PDF Button */}
                      <button
                        onClick={() => generateOrderPDF(order)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                        title="Download PDF Order Report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* View Details */}
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-sm"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>

                {/* Card Body: Product Specs & Multi-Currency Balance Highlight */}
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    
                    {/* Left: Product & Logistics Route (5 cols) */}
                    <div className="lg:col-span-5 space-y-2">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Commodity / Product
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {order.productName}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Quantity: <strong className="text-slate-800">{order.quantity.toLocaleString()} {order.unit}</strong>
                          <span className="mx-2 text-slate-300">|</span>
                          Unit Price: <span className="font-semibold text-slate-800">{formatAED(order.unitPriceAED)}</span> ({formatUSD(order.unitPriceUSD)})
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <Ship className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="truncate">
                          <span className="font-medium text-slate-800">{order.originPort || 'Origin Port'}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-medium text-slate-800">{order.destinationPort || 'Destination Port'}</span>
                        </div>
                        {order.billOfLadingNumber && (
                          <span className="ml-auto text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 shrink-0">
                            BL: {order.billOfLadingNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Multi-Currency Financial Balances (USD & AED) (7 cols) */}
                    <div className="lg:col-span-7">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        
                        {/* Total Amount */}
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Full Amount
                          </div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">
                            {formatAED(order.totalAmountAED)}
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 font-mono">
                            {formatUSD(order.totalAmountUSD)}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-1 font-mono leading-tight space-y-0.5 border-t border-slate-100 pt-1">
                            <div>{order.quantity.toLocaleString()} {order.unit} × {formatAED(order.unitPriceAED)}</div>
                            <div>{order.quantity.toLocaleString()} {order.unit} × {formatUSD(order.unitPriceUSD)}</div>
                          </div>
                        </div>

                        {/* Advance */}
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Advance</span>
                            <span className="text-emerald-600 font-semibold">{advanceRatio}%</span>
                          </div>
                          <div className="text-sm font-black text-emerald-600 mt-0.5">
                            {formatAED(order.advancePaymentAED)}
                          </div>
                          <div className="text-[11px] font-medium text-emerald-700 font-mono">
                            {formatUSD(order.advancePaymentUSD)}
                          </div>
                        </div>

                        {/* Balance Payment */}
                        <div className={`p-2.5 rounded-lg border ${
                          order.balancePaymentUSD > 0
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        }`}>
                          <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                            <span>Balance Due</span>
                            <span className="text-[9px] font-bold px-1 rounded bg-white/70">
                              {hasAdvanceReceived(order) ? 'Full - Advance' : 'Full Amount'}
                            </span>
                          </div>
                          <div className={`text-sm font-black mt-0.5 ${
                            order.balancePaymentUSD > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {formatAED(order.balancePaymentAED)}
                          </div>
                          <div className="text-[11px] font-medium font-mono">
                            {formatUSD(order.balancePaymentUSD)}
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  {order.lots && order.lots.length > 0 && (
                    <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3" aria-label={`${order.orderNumber} lot breakdown`}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-black text-slate-900">Lot-wise order breakdown</h3>
                          <p className="text-[10px] text-slate-600">AED is primary. Final amounts reduce when the advance is recorded.</p>
                        </div>
                        <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-800">{order.lots.length} lots</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {order.lots.map((lot) => (
                          <div key={lot.lot_number} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black text-slate-900">Lot {lot.lot_number}</span>
                              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                                lot.status === 'fully_paid'
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : lot.status === 'partially_paid'
                                    ? 'border-amber-200 bg-amber-100 text-amber-800'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                              }`}>
                                {lot.status === 'fully_paid' ? 'Fully Paid' : lot.status === 'partially_paid' ? 'Partially Paid' : 'Pending'}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] font-semibold text-slate-600">{lot.quantity.toLocaleString()} MT</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px]">
                              <div>
                                <div className="font-bold uppercase tracking-wide text-slate-400">Advance</div>
                                <div className="mt-0.5 font-bold text-emerald-700">{formatAED(lot.advance_aed)}</div>
                                <div className="font-mono text-[9px] text-slate-500">{formatUSD(lot.advance_usd)}</div>
                              </div>
                              <div>
                                <div className="font-bold uppercase tracking-wide text-slate-400">Final amount</div>
                                <div className="mt-0.5 font-bold text-amber-800">{formatAED(lot.balance_aed)}</div>
                                <div className="font-mono text-[9px] text-slate-500">{formatUSD(lot.balance_usd)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* VISUAL PROGRESS BAR FOR EACH DELIVERY STAGE */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Order Progress:
                        </span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          Stage {currentStep} of {ORDER_STAGES.length}: {currentStageInfo.label}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        {progressPercent}% Complete
                      </div>
                    </div>

                    {/* Segmented Progress Bar */}
                    <div className="relative">
                      {/* Base rail */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {/* Visual Milestone Pins / Badges */}
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-center">
                        {ORDER_STAGES.map((stg, sIdx) => {
                          const isDone = sIdx < currentStep - 1 || order.isCompleted;
                          const isCurrent = sIdx === currentStep - 1 && !order.isCompleted;

                          return (
                            <div key={stg.id} className="flex flex-col items-center">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                                isDone
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                                  : isCurrent
                                  ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200 shadow-sm animate-pulse'
                                  : 'bg-white border-slate-300 text-slate-400'
                              }`}>
                                {isDone ? '✓' : stg.stepNumber}
                              </div>
                              <span className={`text-[9px] mt-1 font-semibold leading-tight line-clamp-2 px-0.5 ${
                                isCurrent
                                  ? 'text-blue-700 font-extrabold'
                                  : isDone
                                  ? 'text-slate-700'
                                  : 'text-slate-400'
                              }`}>
                                {stg.shortName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Card Footer: Quick Actions & Transition Prompt */}
                <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Due Date:</span>
                    <span className={order.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                      {order.paymentDueDate || 'As per agreement'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-slate-700">Shipment:</span>
                    <span>{order.shipmentDate || 'Scheduled upon advance'}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Advance Stage button if not completed */}
                    {!order.isCompleted && order.currentStage !== 'bl_surrender' && userRole !== 'auditor' && (
                      <button
                        onClick={() => onAdvanceStage(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition active:scale-95 shadow-sm"
                      >
                        <span>
                          {order.currentStage === 'pi_issued' ? 'Mark PI Signed' : 'Advance Stage'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Quick Pay Balance if balance > 0 */}
                    {order.balancePaymentUSD > 0 && userRole !== 'auditor' && (
                      <button
                        onClick={() => onQuickPayBalance(order)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition active:scale-95 shadow-sm"
                        title="Record full balance payment"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Settle Balance</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Table View Alternative */}
      {viewLayout === 'table' && filteredOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="py-3 px-4">Order ID & Year</th>
                  <th className="py-3 px-4">Buyer Company</th>
                  <th className="py-3 px-4">Product & Quantity</th>
                  <th className="py-3 px-4">Total Amount (AED / USD)</th>
                  <th className="py-3 px-4">Advance</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Stage & Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const currentStageInfo = ORDER_STAGES.find(s => s.id === order.currentStage) || ORDER_STAGES[0];
                  const step = getStageStep(order.currentStage);
                  const isWaitingPI = order.isWaitingForBuyerPI || order.currentStage === 'pi_issued';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="text-blue-700 font-extrabold">{order.orderNumber}</div>
                        <div className="text-[10px] text-slate-400">{order.year} • {order.orderDate}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {order.companyName}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{order.productName}</div>
                        <div className="text-[11px] text-slate-500">{order.quantity.toLocaleString()} {order.unit}</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        <div>{formatAED(order.totalAmountAED)}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-normal">{formatUSD(order.totalAmountUSD)}</div>
                        <div className="text-[9px] text-slate-400 font-normal mt-0.5 font-mono">
                          {order.quantity} {order.unit} × {formatUSD(order.unitPriceUSD)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600">
                        {formatAED(order.advancePaymentAED)}
                        <div className="text-[10px] text-slate-500">{formatUSD(order.advancePaymentUSD)}</div>
                        <div className="text-[10px]">Advance</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold">
                        <span className={order.balancePaymentUSD > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                          {formatAED(order.balancePaymentAED)}
                          <span className="block text-[10px] text-slate-500 font-normal">{formatUSD(order.balancePaymentUSD)}</span>
                        </span>
                        {order.isOverdue && (
                          <div className="text-[9px] font-bold text-rose-500">OVERDUE</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isWaitingPI ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 block w-fit">
                            Awaiting Signed PI
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 block w-fit">
                            {step}/{ORDER_STAGES.length} {currentStageInfo.shortName}
                          </span>
                        )}
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.round((step / ORDER_STAGES.length) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onAmendOrder(order)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700"
                            title="Amend & Update Order"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteOrder(order)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600"
                            title="Delete Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => generateOrderPDF(order)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectOrder(order)}
                            className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 text-[11px]"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
