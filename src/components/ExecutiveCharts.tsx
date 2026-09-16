import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Order, Company, ORDER_STAGES } from '../types';
import { formatUSD, formatAED, convertUsdToAed } from '../utils/pdfGenerator';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  Ship, 
  Building2,
  CheckCircle2
} from 'lucide-react';

interface ExecutiveChartsProps {
  orders: Order[];
  companies: Company[];
  selectedCurrency: 'USD' | 'AED';
  exchangeRate?: number;
}

// Stage visual color mapping
const STAGE_COLORS: Record<string, string> = {
  pi_issued: '#94a3b8',        // slate-400
  pi_signed: '#60a5fa',        // blue-400
  advance_received: '#0284c7', // sky-600
  date_of_shipment: '#f59e0b', // amber-500
  shipment_dispatched: '#8b5cf6', // purple-500
  bl_received: '#ec4899',      // pink-500
  got_full_money: '#10b981',   // emerald-500
  bl_surrender: '#059669',     // emerald-600
};

export const ExecutiveCharts: React.FC<ExecutiveChartsProps> = ({
  orders,
  companies,
  selectedCurrency,
  exchangeRate = 3.6725,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'cashflow' | 'stages' | 'buyers'>('all');

  // 1. Monthly Revenue & Cash Inflow Aggregates
  const months: string[] = Array.from(new Set<string>(orders.map(o => o.month))).sort();
  const monthlyData = months.map(mKey => {
    const monthOrders = orders.filter(o => o.month === mKey);
    const totalUSD = monthOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const advanceUSD = monthOrders.reduce((sum, o) => sum + o.advancePaymentUSD, 0);
    const balanceUSD = monthOrders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);

    const totalAED = monthOrders.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const advanceAED = monthOrders.reduce((sum, o) => sum + o.advancePaymentAED, 0);
    const balanceAED = monthOrders.reduce((sum, o) => sum + o.balancePaymentAED, 0);

    const [y, m] = mKey.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    return {
      monthKey: mKey,
      monthLabel,
      orderCount: monthOrders.length,
      // USD values
      totalUSD,
      advanceUSD,
      balanceUSD,
      // AED values
      totalAED,
      advanceAED,
      balanceAED,
      // Display values based on selected currency
      displayTotal: selectedCurrency === 'USD' ? totalUSD : totalAED,
      displayAdvance: selectedCurrency === 'USD' ? advanceUSD : advanceAED,
      displayBalance: selectedCurrency === 'USD' ? balanceUSD : balanceAED,
    };
  });

  // 2. Stages Distribution Data
  const stageDistributionData = ORDER_STAGES.map(stage => {
    const matching = orders.filter(o => o.currentStage === stage.id);
    const totalUSD = matching.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const totalAED = matching.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const totalTonnage = matching.reduce((sum, o) => sum + o.quantity, 0);

    return {
      id: stage.id,
      name: stage.shortName,
      count: matching.length,
      color: STAGE_COLORS[stage.id] || '#64748b',
      totalUSD,
      totalAED,
      displayValue: selectedCurrency === 'USD' ? totalUSD : totalAED,
      totalTonnage,
    };
  }).filter(s => s.count > 0);

  // 3. Buyer Volume & Exposure Data (Top Buyers)
  const buyerExposureData = companies.map(company => {
    const compOrders = orders.filter(o => o.companyId === company.id);
    const totalUSD = compOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const advanceUSD = compOrders.reduce((sum, o) => sum + o.advancePaymentUSD, 0);
    const balanceUSD = compOrders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);

    const totalAED = compOrders.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const advanceAED = compOrders.reduce((sum, o) => sum + o.advancePaymentAED, 0);
    const balanceAED = compOrders.reduce((sum, o) => sum + o.balancePaymentAED, 0);

    const displayName = company.name.length > 20 ? `${company.name.slice(0, 18)}...` : company.name;

    return {
      id: company.id,
      name: displayName,
      fullName: company.name,
      country: company.country,
      ordersCount: compOrders.length,
      // Display values
      displayAdvance: selectedCurrency === 'USD' ? advanceUSD : advanceAED,
      displayBalance: selectedCurrency === 'USD' ? balanceUSD : balanceAED,
      displayTotal: selectedCurrency === 'USD' ? totalUSD : totalAED,
      totalUSD,
      advanceUSD,
      balanceUSD,
      totalAED,
      advanceAED,
      balanceAED,
    };
  })
  .filter(b => b.ordersCount > 0)
  .sort((a, b) => b.displayTotal - a.displayTotal)
  .slice(0, 7);

  // 4. Commodity Breakdown Data
  const categories = Array.from(new Set(orders.map(o => o.category)));
  const commodityData = categories.map(cat => {
    const catOrders = orders.filter(o => o.category === cat);
    const totalUSD = catOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const totalAED = catOrders.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const tonnage = catOrders.reduce((sum, o) => sum + o.quantity, 0);

    return {
      name: cat,
      ordersCount: catOrders.length,
      totalUSD,
      totalAED,
      displayValue: selectedCurrency === 'USD' ? totalUSD : totalAED,
      tonnage,
    };
  });

  const currencySymbol = selectedCurrency === 'USD' ? '$' : 'AED ';

  // Custom Recharts Tooltip for Monthly Cash Flow
  const CustomCashFlowTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs min-w-[220px]">
          <div className="font-bold text-sky-400 border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span>{data.monthLabel} Timeline</span>
            <span className="text-[10px] text-slate-400">{data.orderCount} Orders</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Advance Received:
              </span>
              <span className="font-bold text-emerald-400">
                {selectedCurrency === 'USD' ? formatUSD(data.advanceUSD) : formatAED(data.advanceAED)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Pending Balance:
              </span>
              <span className="font-bold text-amber-400">
                {selectedCurrency === 'USD' ? formatUSD(data.balanceUSD) : formatAED(data.balanceAED)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-bold">
              <span className="text-white">Total Order Volume:</span>
              <span className="text-sky-300">
                {selectedCurrency === 'USD' ? formatUSD(data.totalUSD) : formatAED(data.totalAED)}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 text-right pt-0.5 font-mono">
              {selectedCurrency === 'USD' ? formatAED(data.totalAED) : formatUSD(data.totalUSD)}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Stages Donut
  const CustomStageTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs min-w-[200px]">
          <div className="font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </div>
          <div className="mt-2 space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span>Trade Orders:</span>
              <span className="font-bold text-white">{data.count} Orders</span>
            </div>
            <div className="flex justify-between">
              <span>Total Volume:</span>
              <span className="font-bold text-emerald-400">
                {selectedCurrency === 'USD' ? formatUSD(data.totalUSD) : formatAED(data.totalAED)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Metric Tonnage:</span>
              <span className="font-bold text-slate-200">{data.totalTonnage.toLocaleString()} MT</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Visual Tabs */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Executive Visual Analytics & Trade Intelligence
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
              Active In {selectedCurrency}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive graphical view of monthly revenue trajectories, trade stage pipelines, and buyer exposure.
          </p>
        </div>

        {/* Chart View Filters */}
        <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold sm:flex sm:w-auto sm:self-auto">
          <button
            onClick={() => setActiveChartTab('all')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition ${
              activeChartTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Complete View
          </button>
          <button
            onClick={() => setActiveChartTab('cashflow')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition ${
              activeChartTab === 'cashflow'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cash Flow
          </button>
          <button
            onClick={() => setActiveChartTab('stages')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition ${
              activeChartTab === 'stages'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stages Pipeline
          </button>
          <button
            onClick={() => setActiveChartTab('buyers')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition ${
              activeChartTab === 'buyers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buyer Exposure
          </button>
        </div>
      </div>

      {/* Grid of Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Monthly Revenue & Cash Inflow Stacked Bar Chart */}
        {(activeChartTab === 'all' || activeChartTab === 'cashflow') && (
          <div className={`${activeChartTab === 'cashflow' ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between`}>
            <div>
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Monthly Cash Inflow vs Pending Receivables
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Advance deposits collected vs remaining cargo balances ({selectedCurrency})
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Advance
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
                  </span>
                </div>
              </div>

              {/* Chart Container */}
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="monthLabel" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      tickFormatter={(value) => `${currencySymbol}${value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'}`}
                    />
                    <Tooltip content={<CustomCashFlowTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                    />
                    <Bar 
                      dataKey="displayAdvance" 
                      name="Advance Collected" 
                      fill="#10b981" 
                      stackId="cashflow" 
                      radius={[0, 0, 4, 4]} 
                    />
                    <Bar 
                      dataKey="displayBalance" 
                      name="Pending Balance" 
                      fill="#f59e0b" 
                      stackId="cashflow" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Summary Row */}
            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-center text-xs min-[420px]:grid-cols-3">
              <div className="p-2 bg-slate-50 rounded-xl">
                <div className="text-[10px] text-slate-500">Total Tracked Revenue</div>
                <div className="font-extrabold text-slate-900 mt-0.5">
                  {selectedCurrency === 'USD' 
                    ? formatUSD(monthlyData.reduce((s, m) => s + m.totalUSD, 0))
                    : formatAED(monthlyData.reduce((s, m) => s + m.totalAED, 0))}
                </div>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl">
                <div className="text-[10px] text-emerald-700">Total Confirmed Advance</div>
                <div className="font-extrabold text-emerald-700 mt-0.5">
                  {selectedCurrency === 'USD' 
                    ? formatUSD(monthlyData.reduce((s, m) => s + m.advanceUSD, 0))
                    : formatAED(monthlyData.reduce((s, m) => s + m.advanceAED, 0))}
                </div>
              </div>
              <div className="p-2 bg-amber-50 rounded-xl">
                <div className="text-[10px] text-amber-700">Total Pending Balance</div>
                <div className="font-extrabold text-amber-700 mt-0.5">
                  {selectedCurrency === 'USD' 
                    ? formatUSD(monthlyData.reduce((s, m) => s + m.balanceUSD, 0))
                    : formatAED(monthlyData.reduce((s, m) => s + m.balanceAED, 0))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart 2: Trade Lifecycle Stages Donut Chart */}
        {(activeChartTab === 'all' || activeChartTab === 'stages') && (
          <div className={`${activeChartTab === 'stages' ? 'lg:col-span-12' : 'lg:col-span-5'} bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between`}>
            <div>
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                    <PieChartIcon className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Trade Lifecycle Pipeline
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  {orders.length} Active Orders
                </span>
              </div>

              {/* Donut Chart Container */}
              <div className="h-56 w-full mt-2 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stageDistributionData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {stageDistributionData.map((entry) => (
                        <Cell key={`cell-${entry.id}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomStageTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900">{orders.length}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contracts</span>
                </div>
              </div>
            </div>

            {/* Stage breakdown list */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {stageDistributionData.map(st => (
                <div key={st.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <span className="font-medium text-slate-700 truncate max-w-[150px]">{st.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">{st.count}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {selectedCurrency === 'USD' ? formatUSD(st.totalUSD) : formatAED(st.totalAED)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Row 2: Buyer Volume & Credit Exposure Horizontal Bar Chart */}
      {(activeChartTab === 'all' || activeChartTab === 'buyers') && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-extrabold text-slate-900">
                  Top Buyer Companies: Advance Received vs Balance Exposure
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial risk and collection breakdown across principal corporate buyers ({selectedCurrency})
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Advance Paid
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Balance Outstanding
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={buyerExposureData}
                margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis 
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={(val) => `${currencySymbol}${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : (val / 1000).toFixed(0) + 'k'}`}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${selectedCurrency === 'USD' ? formatUSD(Number(value)) : formatAED(Number(value))}`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="displayAdvance" 
                  name="Advance Paid" 
                  fill="#10b981" 
                  stackId="buyer" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="displayBalance" 
                  name="Balance Outstanding" 
                  fill="#f43f5e" 
                  stackId="buyer" 
                  radius={[0, 4, 4, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Commodity Portfolio Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {commodityData.map((cat) => (
          <div key={cat.name} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                {cat.ordersCount} Orders
              </span>
            </div>
            <div className="mt-2 text-xl font-black text-slate-900">
              {cat.tonnage.toLocaleString()} <span className="text-xs font-normal text-slate-500">MT</span>
            </div>
            <div className="mt-1 text-xs font-bold text-slate-700 flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">Valuation:</span>
              <span className="font-mono">{selectedCurrency === 'USD' ? formatUSD(cat.totalUSD) : formatAED(cat.totalAED)}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
