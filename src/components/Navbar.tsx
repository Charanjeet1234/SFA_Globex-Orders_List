import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Bell, 
  Search, 
  Building2, 
  PlusCircle, 
  FileText, 
  Lock, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Layers,
  Database,
  BarChart3,
  Globe
} from 'lucide-react';
import { UserProfile, UserRole, AlertNotification } from '../types';

interface NavbarProps {
  currentUser: UserProfile;
  onSwitchRole: (role: UserRole) => void;
  onOpenNewOrder: () => void;
  onOpenCompanies: () => void;
  onOpenSecurityAudit: () => void;
  onOpenAlerts: () => void;
  onOpenExecutivePDF: () => void;
  onLockSession: () => void;
  alerts: AlertNotification[];
  activeTab: 'orders' | 'analytics' | 'pipeline';
  setActiveTab: (tab: 'orders' | 'analytics' | 'pipeline') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedYear: number | 'all';
  setSelectedYear: (year: number | 'all') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSwitchRole,
  onOpenNewOrder,
  onOpenCompanies,
  onOpenSecurityAudit,
  onOpenAlerts,
  onOpenExecutivePDF,
  onLockSession,
  alerts,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  selectedYear,
  setSelectedYear,
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;
  const overdueAlertsCount = alerts.filter(a => a.type === 'overdue_payment' && !a.isRead).length;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Dubai',
        }) + ' GST (Dubai)'
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const roles: { role: UserRole; title: string; desc: string }[] = [
    { role: 'owner', title: 'Executive Owner', desc: 'Full administrative & financial clearance' },
    { role: 'finance', title: 'Finance Officer', desc: 'Payments, invoices & revenue balance' },
    { role: 'logistics', title: 'Logistics Manager', desc: 'Shipment dispatch & BL operations' },
    { role: 'auditor', title: 'Compliance Auditor', desc: 'Read-only security & audit logs' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      {/* Top tier: Brand, Search, Security status & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-2 py-3 sm:gap-3 sm:py-0">
          
          {/* Brand Identity */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <span className="font-black text-white text-base tracking-wider">SFA</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-extrabold text-base tracking-tight text-white sm:text-xl">SFA Globex FZCO</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full tracking-wide">
                  sfaglobex.ae
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                Ferro Alloys, Metals & Minerals Trade Governance • JLT, Dubai
              </p>
            </div>
          </div>

          {/* Search bar with Year filter */}
          <div className="flex-1 max-w-md hidden lg:flex items-center gap-2 bg-slate-800/80 rounded-lg px-3 py-1.5 border border-slate-700/80 focus-within:border-sky-500 transition-colors">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search orders, products or company names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-white px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
            <div className="h-4 w-[1px] bg-slate-700 mx-1" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-800 text-[11px] font-medium text-slate-200 border-none rounded focus:ring-0 cursor-pointer pr-1"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Actions & Utilities */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            
            {/* Live Clock */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-[11px]">{currentTime}</span>
            </div>

            {/* End-to-End Encryption & Security Audit Badge */}
            <button
              onClick={onOpenSecurityAudit}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 p-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-900/50 sm:px-2.5 sm:py-1.5"
              title="AES-256-GCM End-to-End Encrypted Data & Audit Logs"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">E2EE Sealed</span>
            </button>

            {/* Alert Notifications Trigger */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Real-Time Overdue & Pending Invoice Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full ${
                  overdueAlertsCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                }`}>
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Add Order Button */}
            {currentUser.role !== 'auditor' && (
              <button
                onClick={onOpenNewOrder}
                className="flex items-center gap-1.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-sky-500/20 transition active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">New Order</span>
              </button>
            )}

            {/* Role & Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-2 transition hover:bg-slate-700 sm:px-2.5 sm:py-1.5"
              >
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.role[0]}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-white leading-tight capitalize">
                    {currentUser.role}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    MFA Active
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="text-xs font-bold text-white">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-400">{currentUser.email}</div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> MFA Verified (TOTP 256)
                    </div>
                  </div>

                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Switch Active Role
                  </div>

                  {roles.map((r) => (
                    <button
                      key={r.role}
                      onClick={() => {
                        onSwitchRole(r.role);
                        setRoleMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2 text-xs transition ${
                        currentUser.role === r.role
                          ? 'bg-sky-950/80 text-sky-300 border-l-2 border-sky-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="mt-0.5">
                        {currentUser.role === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                      </div>
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-[10px] text-slate-400">{r.desc}</div>
                      </div>
                    </button>
                  ))}

                  <div className="border-t border-slate-800 mt-2 pt-2 px-2">
                    <button
                      onClick={() => {
                        setRoleMenuOpen(false);
                        onLockSession();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock / Switch User Credentials</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lower tier: Navigation tabs & quick metrics */}
        <div className="overflow-x-auto border-t border-slate-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-4 py-2.5">
            <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'orders'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Orders & Shipment Tracking</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Executive Analytics & Graphs</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold transition ${
                activeTab === 'analytics' ? 'bg-white text-sky-900' : 'bg-sky-400/20 text-sky-300'
              }`}>
                Visual
              </span>
            </button>

            <button
              onClick={onOpenCompanies}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Companies Directory</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenExecutivePDF}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition"
              title="Generate Downloadable Executive Financial PDF"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Export PDF Report</span>
            </button>
          </div>
        </div>
        </div>

        {/* Mobile Search input */}
        <div className="lg:hidden pb-3">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search orders, products, companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-900 text-[11px] font-medium text-slate-200 border border-slate-700 rounded px-1.5 py-0.5"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
