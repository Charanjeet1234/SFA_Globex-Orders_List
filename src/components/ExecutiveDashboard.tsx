import React, { useState } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Building2, 
  FileText, 
  ArrowUpRight, 
  Calendar, 
  ChevronRight,
  ShieldCheck,
  Send,
  Download,
  Percent,
  Compass
} from 'lucide-react';
import { Order, Company, AlertNotification, ORDER_STAGES } from '../types';
import { formatUSD, formatAED, generateExecutiveSummaryPDF } from '../utils/pdfGenerator';

interface ExecutiveDashboardProps {
  orders: Order[];
  companies: Company[];
  alerts: AlertNotification[];
  onSelectOrder: (order: Order) => void;
  onOpenOrderForm: () => void;
  onSendReminder: (alert: AlertNotification) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  orders,
  companies,
  alerts,
  onSelectOrder,
  onOpenOrderForm,
  onSendReminder,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'AED'>('USD');
  const [drilldownCompany, setDrilldownCompany] = useState<string | null>(null);

  // Core KPI Calculations
  const totalOrdersCount = orders.length;
  
  // "Went through": Dispatched or actively moving through stages (not yet fully completed)
  const wentThroughCount = orders.filter(
    o => o.currentStage !== 'pi_issued' && o.currentStage !== 'pi_signed' && o.currentStage !== 'bl_surrender'
  ).length;

  // Completed: Reached BL surrender and fully settled
  const completedCount = orders.filter(o => o.isCompleted || o.currentStage === 'bl_surrender').length;

  // Full payment received count
  const fullPaymentReceivedCount = orders.filter(o => o.isFullPaymentReceived || o.balancePaymentUSD <= 0).length;
  const paymentCollectionRatio = totalOrdersCount > 0 ? Math.round((fullPaymentReceivedCount / totalOrdersCount) * 100) : 0;

  // Financial totals
  const totalVolumeUSD = orders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
  const totalVolumeAED = orders.reduce((sum, o) => sum + o.totalAmountAED, 0);
  const totalAdvanceReceivedUSD = orders.reduce((sum, o) => sum + o.advancePaymentUSD, 0);
  const totalBalanceOutstandingUSD = orders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);
  const totalBalanceOutstandingAED = orders.reduce((sum, o) => sum + o.balancePaymentAED, 0);

  // Overdue count & sum
  const overdueOrders = orders.filter(o => o.isOverdue && o.balancePaymentUSD > 0);
  const totalOverdueUSD = overdueOrders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);

  // Month-wise unique list
  const months: string[] = Array.from(new Set<string>(orders.map(o => o.month))).sort();

  // Monthly Revenue Projections data
  const monthlyProjections = months.map(mKey => {
    const monthOrders = orders.filter(o => o.month === mKey);
    const orderCount = monthOrders.length;
    const projectedRevenueUSD = monthOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const projectedRevenueAED = monthOrders.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const confirmedCashUSD = monthOrders.reduce((sum, o) => sum + o.advancePaymentUSD, 0);
    const pendingBalanceUSD = monthOrders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);

    // Format label like "Aug 2026"
    const [y, m] = mKey.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      monthKey: mKey,
      monthName,
      orderCount,
      projectedRevenueUSD,
      projectedRevenueAED,
      confirmedCashUSD,
      pendingBalanceUSD,
    };
  });

  const handleExportPDF = () => {
    generateExecutiveSummaryPDF(
      orders,
      totalVolumeUSD,
      totalVolumeAED,
      totalAdvanceReceivedUSD,
      totalBalanceOutstandingUSD,
      completedCount,
      wentThroughCount
    );
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner: Owner Executive Overview & Currency Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Executive Owner Intelligence
              </span>
              <span className="text-xs text-slate-400">Live Port & Financial Telemetry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              Commercial Trade & Revenue Performance
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Real-time monitoring of trade lifecycles, advance deposits, outstanding balance receivables, and company-wise shipment velocity.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Currency toggle */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setSelectedCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedCurrency === 'USD' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setSelectedCurrency('AED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedCurrency === 'AED' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                AED (د.إ)
              </button>
            </div>

            {/* Download PDF report */}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Executive PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Overdue Alert Callout (if any overdue) */}
      {overdueOrders.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-5 text-rose-200 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-rose-100">
                    URGENT: {overdueOrders.length} Order(s) With Overdue Balance Payments
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-300">
                    Total: {formatUSD(totalOverdueUSD)} / {formatAED(totalOverdueUSD * 3.6725)}
                  </span>
                </div>
                <p className="text-xs text-rose-300/80 mt-1">
                  Cargo or BL is released but final balance remains unpaid past the agreed credit due date. Automated dunning notices queued.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {overdueOrders.map(o => (
                <button
                  key={o.id}
                  onClick={() => onSelectOrder(o)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition"
                >
                  Review {o.orderNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5 Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1: Total Orders Received */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Orders Received</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {totalOrdersCount} <span className="text-xs font-normal text-slate-500">Contracts</span>
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-1">
              {selectedCurrency === 'USD' ? formatUSD(totalVolumeUSD) : formatAED(totalVolumeAED)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Volume Booked</span>
            <span className="font-semibold text-blue-600">100% Tracked</span>
          </div>
        </div>

        {/* Metric 2: Went Through (Active / In Transit) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orders Went Through</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {wentThroughCount} <span className="text-xs font-normal text-slate-500">In Motion</span>
            </div>
            <div className="text-xs font-semibold text-amber-700 mt-1">
              Dispatched & Transit Underway
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Stages 2 through 6</span>
            <span className="font-semibold text-amber-600">Active Flow</span>
          </div>
        </div>

        {/* Metric 3: Completed Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Orders</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">
              {completedCount} <span className="text-xs font-normal text-slate-500">Settled</span>
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-1">
              BL Surrendered & Released
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Closure Rate</span>
            <span className="font-semibold text-emerald-600">
              {totalOrdersCount > 0 ? Math.round((completedCount / totalOrdersCount) * 100) : 0}% Complete
            </span>
          </div>
        </div>

        {/* Metric 4: Full Payment Received */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Payment Received</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {fullPaymentReceivedCount} <span className="text-xs font-normal text-slate-500">of {totalOrdersCount}</span>
            </div>
            <div className="text-xs font-semibold text-indigo-600 mt-1">
              {paymentCollectionRatio}% Collection Rate
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Advance Inflow</span>
            <span className="font-semibold text-slate-800">{formatUSD(totalAdvanceReceivedUSD)}</span>
          </div>
        </div>

        {/* Metric 5: Outstanding Balance Receivables */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Balance</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">
              {selectedCurrency === 'USD' ? formatUSD(totalBalanceOutstandingUSD) : formatAED(totalBalanceOutstandingAED)}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Full Amount - Advance Received
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Overdue Amount</span>
            <span className="font-semibold text-rose-600">{formatUSD(totalOverdueUSD)}</span>
          </div>
        </div>

      </div>

      {/* Section 1: Summary Section for Total Monthly Revenue Projections */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Total Monthly Revenue Projections & Cash Flow Clarity
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                USD & AED Forecast
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial visibility into confirmed advance payments, forecasted balance collections, and pipeline growth.
            </p>
          </div>
        </div>

        {/* Projections Table & Visual Cards */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Projection Month</th>
                <th className="py-3 px-4">Order Volume</th>
                <th className="py-3 px-4">Projected Revenue (USD)</th>
                <th className="py-3 px-4">Projected Revenue (AED)</th>
                <th className="py-3 px-4">Confirmed Advance Inflow</th>
                <th className="py-3 px-4">Pending Balance Pipeline</th>
                <th className="py-3 px-4">Cash Settlement Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyProjections.map((p) => {
                const advancePercent = p.projectedRevenueUSD > 0 
                  ? Math.round((p.confirmedCashUSD / p.projectedRevenueUSD) * 100) 
                  : 0;

                return (
                  <tr key={p.monthKey} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-sky-600" />
                        <span>{p.monthName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full font-semibold bg-slate-100 text-slate-800">
                        {p.orderCount} Orders
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      {formatUSD(p.projectedRevenueUSD)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {formatAED(p.projectedRevenueAED)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600">
                      {formatUSD(p.confirmedCashUSD)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-rose-600">
                      {formatUSD(p.pendingBalanceUSD)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>{advancePercent}% Received</span>
                          <span className="text-slate-400">100% Target</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full"
                            style={{ width: `${Math.min(advancePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Individual Orders from Companies Month-Wise Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Individual Orders From Companies (Month-Wise Matrix)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                Buyer Relationship Matrix
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cross-tabulation of order volumes and contracts booked per corporate buyer across operational months.
            </p>
          </div>
        </div>

        {/* Company Month-Wise Matrix */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="py-3 px-4 rounded-tl-xl">Buyer Enterprise</th>
                <th className="py-3 px-3">Country / Rating</th>
                {months.map(m => {
                  const [y, mm] = m.split('-');
                  const dateObj = new Date(parseInt(y), parseInt(mm) - 1, 1);
                  const mLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  return (
                    <th key={m} className="py-3 px-3 text-center">
                      {mLabel}
                    </th>
                  );
                })}
                <th className="py-3 px-4 text-right rounded-tr-xl">Total Booked Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {companies.map((company) => {
                const companyOrders = orders.filter(o => o.companyId === company.id);
                const companyTotalUSD = companyOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);

                return (
                  <tr 
                    key={company.id}
                    onClick={() => setDrilldownCompany(drilldownCompany === company.id ? null : company.id)}
                    className="hover:bg-sky-50/50 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{company.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {company.taxRegistrationNumber}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                        {company.creditRating} Rating
                      </span>
                    </td>

                    {/* Month-wise cell values */}
                    {months.map(m => {
                      const mOrders = companyOrders.filter(o => o.month === m);
                      const mVolume = mOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
                      
                      return (
                        <td key={m} className="py-3.5 px-3 text-center">
                          {mOrders.length > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                                {mOrders.length} {mOrders.length === 1 ? 'Order' : 'Orders'}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-600 mt-0.5">
                                {formatUSD(mVolume)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                      {formatUSD(companyTotalUSD)}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {formatAED(companyTotalUSD * 3.6725)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Drilldown view if company selected */}
        {drilldownCompany && (
          <div className="mt-4 p-4 rounded-xl bg-sky-50/80 border border-sky-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                Orders Breakdown for {companies.find(c => c.id === drilldownCompany)?.name}
              </h4>
              <button 
                onClick={() => setDrilldownCompany(null)}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900"
              >
                Close Drilldown
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {orders
                .filter(o => o.companyId === drilldownCompany)
                .map(order => (
                  <div 
                    key={order.id}
                    onClick={() => onSelectOrder(order)}
                    className="p-3 bg-white rounded-lg border border-sky-200 hover:border-sky-400 cursor-pointer shadow-sm transition"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-sky-700">{order.orderNumber}</span>
                      <span className="text-slate-500">{order.orderDate}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-900 mt-1 truncate">
                      {order.productName}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Total: {formatUSD(order.totalAmountUSD)}</span>
                      <span className={`font-semibold ${order.balancePaymentUSD > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Bal: {formatUSD(order.balancePaymentUSD)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
