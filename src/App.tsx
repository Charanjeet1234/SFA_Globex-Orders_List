import { normalizeOrderPayments, receivedPaymentUSD } from '../lib/order-payments.js';
import { getLotStage, recordLotAdvance } from '../lib/order-lots.js';
import React, { useState, useEffect } from 'react';
import { 
  Navbar 
} from './components/Navbar';
import { 
  ExecutiveDashboard 
} from './components/ExecutiveDashboard';
import { 
  OrdersView 
} from './components/OrdersView';
import { 
  OrderDetailModal 
} from './components/OrderDetailModal';
import { 
  OrderFormModal 
} from './components/OrderFormModal';
import { 
  CompaniesModal 
} from './components/CompaniesModal';
import { 
  SecurityAuditModal 
} from './components/SecurityAuditModal';
import { 
  AlertsDrawer 
} from './components/AlertsDrawer';
import { AuthView } from '@neondatabase/auth-ui';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { 
  AmendOrderModal 
} from './components/AmendOrderModal';
import { 
  DeleteOrderModal 
} from './components/DeleteOrderModal';
import { DevelopmentLogin, type DevelopmentSessionUser } from './components/DevelopmentLogin';

import { 
  Order, 
  Company, 
  UserProfile, 
  UserRole, 
  AuditLog, 
  AlertNotification,
  ORDER_STAGES
} from './types';
import { 
  INITIAL_ORDERS, 
  INITIAL_COMPANIES, 
  INITIAL_USERS, 
  INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS,
  SFA_SAMPLE_ORDER
} from './utils/mockData';
import { 
  generateExecutiveSummaryPDF 
} from './utils/pdfGenerator';
import { 
  generateSecureAuditHash 
} from './utils/encryption';
import { databaseApi, DatabaseState } from './api';
import { authClient } from './auth';
const sessionAuth = authClient;
const IS_LOCAL_DEVELOPMENT = import.meta.env.DEV;

const LEGACY_STORAGE_KEY_ORDERS = 'sfa_globex_orders_v2';
const LEGACY_STORAGE_KEY_COMPANIES = 'sfa_globex_companies_v2';
const LEGACY_STORAGE_KEY_LOGS = 'sfa_globex_audit_logs_v2';
const SESSION_STORAGE_KEY = 'sfa_globex_session_v1';
const SESSION_INACTIVITY_LIMIT_MS = 60_000;
interface StoredSession {
  userId: string;
  expiresAt: number;
}

function readLegacyCollection<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveSession(userId: string): StoredSession {
  const session = {
    userId,
    expiresAt: Date.now() + SESSION_INACTIVITY_LIMIT_MS,
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export default function App() {
  const { data: neonSession, isPending: isAuthLoading } = sessionAuth.useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertNotification[]>(INITIAL_ALERTS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAccessChecking, setIsAccessChecking] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [developmentUser, setDevelopmentUser] = useState<DevelopmentSessionUser | null>(null);
  const [isDevelopmentSessionLoading, setIsDevelopmentSessionLoading] = useState(IS_LOCAL_DEVELOPMENT);

  // Search & Year Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'orders' | 'analytics' | 'pipeline'>('orders');

  // Modal Views
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState<boolean>(false);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState<boolean>(false);
  const [isSecurityAuditOpen, setIsSecurityAuditOpen] = useState<boolean>(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState<boolean>(false);

  // Amend & Delete Modal states
  const [orderToAmend, setOrderToAmend] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const applyDatabaseState = (state: DatabaseState) => {
    // Normalize legacy lot records as they are read. Earlier records only had
    // an order-level stage, so their confirmed advance must be derived once
    // for display without making sibling lots share future changes.
    setOrders(state.orders.map((order) => normalizeOrderPayments(order)));
    setCompanies(state.companies);
    setAuditLogs(state.auditLogs);
  };

  useEffect(() => {
    if (!IS_LOCAL_DEVELOPMENT) {
      setIsDevelopmentSessionLoading(false);
      return;
    }

    let isCurrent = true;
    void fetch('/api/development/session', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (isCurrent && result?.user) setDevelopmentUser(result.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) setIsDevelopmentSessionLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading && !developmentUser) return;

    const authUser = neonSession?.user;
    if (!authUser) {
      if (developmentUser) {
        setAuthMessage(null);
        setIsAccessChecking(false);
        setCurrentUser({
          id: developmentUser.id,
          username: developmentUser.email.split('@')[0] || 'developer',
          name: developmentUser.name,
          email: developmentUser.email,
          role: 'owner',
          roleTitle: 'Local Development Administrator',
          mfaEnabled: false,
          mfaVerified: true,
          lastLogin: new Date().toISOString(),
        });
        saveSession(developmentUser.id);
        setIsAuthenticated(true);
        return;
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setIsAccessChecking(false);
      setIsAuthenticated(false);
      return;
    }

    let isCurrent = true;
    setAuthMessage(null);
    setIsAccessChecking(true);

    const verifyPortalAccess = async () => {
      try {
        const accessResponse = await fetch('/api/access', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!accessResponse.ok) throw new Error('Administrator access was not approved.');

        if (!isCurrent) return;
        const existingUser = INITIAL_USERS.find((user) => user.email === authUser.email);
        setCurrentUser(existingUser || {
          id: authUser.id,
          username: authUser.email?.split('@')[0] || 'admin',
          name: authUser.name || authUser.email || 'Portal Administrator',
          email: authUser.email || '',
          role: 'owner',
          roleTitle: 'Portal Administrator',
          mfaEnabled: false,
          mfaVerified: true,
          lastLogin: new Date().toISOString(),
        });
        saveSession(authUser.id);
        setIsAuthenticated(true);
      } catch {
        if (!isCurrent) return;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setIsAuthenticated(false);
        setAuthMessage('This portal is restricted to its designated administrator.');
        void sessionAuth.signOut();
      } finally {
        if (isCurrent) setIsAccessChecking(false);
      }
    };

    void verifyPortalAccess();
    return () => {
      isCurrent = false;
    };
  }, [developmentUser, isAuthLoading, neonSession]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isCurrent = true;
    setIsDatabaseReady(false);

    const loadDatabase = async () => {
      try {
        let state = await databaseApi.getState();
        if (!state.initialized) {
          state = await databaseApi.initialize({
            // Import any data saved by the prior browser-only version once.
            // All subsequent reads and writes use SQLite through the local API.
            orders: readLegacyCollection(LEGACY_STORAGE_KEY_ORDERS, INITIAL_ORDERS),
            companies: readLegacyCollection(LEGACY_STORAGE_KEY_COMPANIES, INITIAL_COMPANIES),
            auditLogs: readLegacyCollection(LEGACY_STORAGE_KEY_LOGS, INITIAL_AUDIT_LOGS),
          });
        }
        if (isCurrent) {
          applyDatabaseState(state);
        }
      } catch (error) {
        console.error('Database load error', error);
        if (isCurrent) {
          setDatabaseError(error instanceof Error ? error.message : 'Unable to load the order database.');
        }
      } finally {
        if (isCurrent) {
          setIsDatabaseReady(true);
        }
      }
    };

    void loadDatabase();
    return () => {
      isCurrent = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: number | undefined;

    const endSession = () => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setIsAuthenticated(false);
      void sessionAuth.signOut();
    };

    const scheduleLogout = (expiresAt: number) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(endSession, Math.max(0, expiresAt - Date.now()));
    };

    const recordActivity = () => {
      scheduleLogout(saveSession(currentUser.id).expiresAt);
    };

    scheduleLogout(saveSession(currentUser.id).expiresAt);
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'focus'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity));

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [currentUser.id, isAuthenticated]);

  // Helper to append secure audit log
  const logAudit = async (
    action: AuditLog['action'],
    targetId: string,
    targetType: AuditLog['targetType'],
    details: string
  ) => {
    const now = new Date().toISOString();
    const hash = await generateSecureAuditHash(action, targetId, now, currentUser.id);
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: now,
      userId: currentUser.id,
      userName: `${currentUser.name} (${currentUser.role})`,
      userRole: currentUser.role,
      action,
      targetId,
      targetType,
      details,
      ipAddress: '194.170.21.84 (Corporate VPN Dubai - JLT)',
      securityHash: `sha256:${hash.slice(0, 32)}`,
    };
    try {
      await databaseApi.createAuditLog(newLog);
      setAuditLogs(prev => [newLog, ...prev]);
    } catch (error) {
      console.error('Audit log write error', error);
      setDatabaseError(error instanceof Error ? error.message : 'Unable to save the audit log.');
    }
  };

  // Switch role handler
  const handleSwitchRole = (newRole: UserRole) => {
    const foundUser = INITIAL_USERS.find(u => u.role === newRole) || {
      ...currentUser,
      role: newRole,
    };
    setCurrentUser(foundUser);
    logAudit('LOGIN_MFA', `role-switch-${newRole}`, 'AUTH', `Role context switched to ${newRole.toUpperCase()}`);
  };

  // Add new order
  const handleSaveOrder = async (newOrder: Order) => {
    try {
      const state = await databaseApi.createOrder(newOrder);
      setOrders(state.orders);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to save the order.');
      return;
    }

    void logAudit(
      'CREATE_ORDER', 
      newOrder.orderNumber, 
      'ORDER', 
      `Registered trade order for ${newOrder.quantity} ${newOrder.unit} of ${newOrder.productName} valued at $${newOrder.totalAmountUSD.toLocaleString()} USD (${newOrder.totalAmountAED.toLocaleString()} AED) with buyer ${newOrder.companyName}. FX Rate: 1 USD = ${newOrder.exchangeRateUsdToAed} AED.`
    );
  };

  // Update order (e.g. stage transition or payment balance update)
  const handleUpdateOrder = async (updated: Order) => {
    updated = normalizeOrderPayments(updated);
    try {
      const state = await databaseApi.updateOrder(updated);
      setOrders(state.orders);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to update the order.');
      return;
    }
    if (selectedOrderDetail && selectedOrderDetail.id === updated.id) {
      setSelectedOrderDetail(updated);
    }

    void logAudit(
      'UPDATE_STAGE',
      updated.orderNumber,
      'STAGE',
      `Updated order status to '${updated.currentStage.replace(/_/g, ' ')}'. Balance due: $${updated.balancePaymentUSD.toLocaleString()} USD.`
    );
  };

  // Amend existing order (Full update of products, rates, quantities, PI status)
  const handleAmendOrder = async (amendedOrder: Order) => {
    amendedOrder = normalizeOrderPayments(amendedOrder);
    try {
      const state = await databaseApi.updateOrder(amendedOrder);
      setOrders(state.orders);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to amend the order.');
      return;
    }
    if (selectedOrderDetail && selectedOrderDetail.id === amendedOrder.id) {
      setSelectedOrderDetail(amendedOrder);
    }

    void logAudit(
      'AMEND_ORDER',
      amendedOrder.orderNumber,
      'ORDER',
      `Amended trade order for ${amendedOrder.productName} (${amendedOrder.companyName}). Valuation: $${amendedOrder.totalAmountUSD.toLocaleString()} USD (${amendedOrder.totalAmountAED.toLocaleString()} AED). FX applied: 1 USD = ${amendedOrder.exchangeRateUsdToAed} AED. Current Stage: ${amendedOrder.currentStage}.`
    );

    setOrderToAmend(null);
  };

  // Delete order permanently
  const handleDeleteOrder = async (orderId: string) => {
    const found = orders.find(o => o.id === orderId);
    try {
      const state = await databaseApi.deleteOrder(orderId);
      setOrders(state.orders);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to delete the order.');
      return;
    }
    if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
      setSelectedOrderDetail(null);
    }

    if (found) {
      void logAudit(
        'DELETE_ORDER',
        found.orderNumber,
        'ORDER',
        `Deleted trade order ${found.orderNumber} (${found.productName}) for buyer ${found.companyName}.`
      );
    }

    setOrderToDelete(null);
  };

  // Load sample SFA Globex order
  const handleLoadSampleOrder = async () => {
    try {
      const state = await databaseApi.createOrder(SFA_SAMPLE_ORDER);
      setOrders(state.orders);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to load the sample order.');
      return;
    }
    void logAudit(
      'CREATE_ORDER',
      SFA_SAMPLE_ORDER.orderNumber,
      'ORDER',
      `Loaded SFA Globex sample order for Silico Manganese (SiMn 65/16) at AED rate 3.6725.`
    );
  };

  // Quick advance stage from orders listing
  const handleAdvanceStage = (order: Order) => {
    const currentIdx = ORDER_STAGES.findIndex(s => s.id === order.currentStage);
    if (currentIdx < ORDER_STAGES.length - 1) {
      const nextStage = ORDER_STAGES[currentIdx + 1].id;
      const nowISO = new Date().toISOString();
      const updatedStages = {
        ...order.stagesHistory,
        [nextStage]: {
          stage: nextStage,
          completedAt: nowISO,
          referenceNumber: `STAGE-ADV-${Date.now().toString().slice(-5)}`,
          notes: `Advanced by ${currentUser.name} (${currentUser.role})`,
        }
      };
      const isFinished = nextStage === 'bl_surrender';

      const updatedOrder: Order = {
        ...order,
        currentStage: nextStage,
        isWaitingForBuyerPI: nextStage === 'pi_issued' ? true : false,
        stagesHistory: updatedStages,
        isCompleted: isFinished,
        updatedAt: nowISO,
      };

      handleUpdateOrder(updatedOrder);
    }
  };

  // Lots are operationally independent: moving one lot never changes the
  // shipment stage or payment balance of its sibling lots.
  const handleAdvanceLotStage = (order: Order, lotNumber: number) => {
    if (!order.lots?.length) return;
    const targetLot = order.lots.find((lot) => lot.lot_number === lotNumber);
    if (!targetLot) return;
    const currentStage = getLotStage(targetLot, order.currentStage);
    const currentIndex = ORDER_STAGES.findIndex((stage) => stage.id === currentStage);
    if (currentIndex < 0 || currentIndex >= ORDER_STAGES.length - 1) return;

    const nextStage = ORDER_STAGES[currentIndex + 1].id;
    if (nextStage === 'advance_received') return;
    const nowISO = new Date().toISOString();
    const lots = order.lots.map((lot) => lot.lot_number === lotNumber
      ? { ...lot, current_stage: nextStage }
      : lot);

    void handleUpdateOrder({
      ...order,
      lots,
      updatedAt: nowISO,
    });
    void logAudit(
      'UPDATE_STAGE',
      `${order.orderNumber}-LOT-${lotNumber}`,
      'STAGE',
      `Lot ${lotNumber} advanced from ${currentStage.replace(/_/g, ' ')} to ${nextStage.replace(/_/g, ' ')}.`
    );
  };

  const handleRecordLotAdvance = (order: Order, lotNumber: number, receivedAdvanceAED: number) => {
    if (!order.lots?.length) return;
    const rate = order.exchangeRateUsdToAed || 3.6725;
    const requestedAED = Math.max(0, Math.round(Number(receivedAdvanceAED) || 0));
    if (requestedAED <= 0) return;
    const receivedAdvanceUSD = Math.round(requestedAED / rate);
    const targetLot = order.lots.find((lot) => lot.lot_number === lotNumber);
    if (!targetLot) return;
    const lots = order.lots.map((lot) => lot.lot_number === lotNumber
      ? recordLotAdvance(lot, receivedAdvanceUSD, {
        unitPriceUSD: order.unitPriceUSD,
        unitPriceAED: order.unitPriceAED,
        exchangeRate: rate,
      })
      : lot);
    const recordedLot = lots.find((lot) => lot.lot_number === lotNumber)!;
    const nowISO = new Date().toISOString();

    void handleUpdateOrder({
      ...order,
      lots,
      updatedAt: nowISO,
    });
    void logAudit(
      'RECORD_PAYMENT',
      `${order.orderNumber}-LOT-${lotNumber}`,
      'PAYMENT',
      `Recorded ${recordedLot.extra_advance_aed ? 'extra ' : ''}advance for Lot ${lotNumber}: AED ${recordedLot.advance_paid_aed?.toLocaleString() || 0}. Lot final amount: AED ${recordedLot.balance_aed.toLocaleString()}.`
    );
  };

  // Quick Pay Full Balance
  const handleQuickPayBalance = (order: Order) => {
    const updatedStages = { ...order.stagesHistory };
    const nowISO = new Date().toISOString();

    updatedStages.got_full_money = {
      stage: 'got_full_money',
      completedAt: nowISO,
      referenceNumber: `WIRE-FULL-${Date.now().toString().slice(-6)}`,
      notes: `Full balance of $${order.balancePaymentUSD.toLocaleString()} USD settled.`,
    };

    const updatedOrder: Order = {
      ...order,
      advancePaymentUSD: order.totalAmountUSD,
      advancePaymentAED: order.totalAmountAED,
      balancePaymentUSD: 0,
      balancePaymentAED: 0,
      isFullPaymentReceived: true,
      isOverdue: false,
      stagesHistory: updatedStages,
      updatedAt: nowISO,
    };

    handleUpdateOrder(updatedOrder);
    logAudit(
      'RECORD_PAYMENT',
      order.orderNumber,
      'PAYMENT',
      `Full 100% balance settled for ${order.companyName}. Balance: $0 USD.`
    );
  };

  // Add new company
  const handleAddCompany = async (newCompany: Company) => {
    try {
      const state = await databaseApi.createCompany(newCompany);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to save the company.');
      return;
    }
    void logAudit(
      'CREATE_ORDER',
      newCompany.id,
      'ORDER',
      `Registered new enterprise partner company: ${newCompany.name} (${newCompany.country}).`
    );
  };

  // Delete company
  const handleDeleteCompany = async (companyId: string) => {
    const comp = companies.find(c => c.id === companyId);
    try {
      const state = await databaseApi.deleteCompany(companyId);
      setCompanies(state.companies);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to delete the company.');
      return;
    }
    void logAudit(
      'DELETE_ORDER',
      companyId,
      'ORDER',
      `Deleted enterprise buyer company: ${comp?.name || companyId} from directory.`
    );
  };

  // Restore backup
  const handleRestoreBackup = async (data: { orders: Order[]; companies: Company[] }) => {
    try {
      const state = await databaseApi.replaceState({
        orders: data.orders,
        companies: data.companies,
        auditLogs,
      });
      applyDatabaseState(state);
      setDatabaseError(null);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Unable to restore the backup.');
      return;
    }
    void logAudit(
      'RESTORE_BACKUP',
      'system-database',
      'SECURITY',
      `Database snapshot restored with ${data.orders.length} orders.`
    );
  };

  // Download executive summary PDF
  const handleExecutivePDF = () => {
    const totalVolumeUSD = orders.reduce((sum, o) => sum + o.totalAmountUSD, 0);
    const totalVolumeAED = orders.reduce((sum, o) => sum + o.totalAmountAED, 0);
    const totalAdvanceReceivedUSD = orders.reduce((sum, o) => sum + receivedPaymentUSD(o), 0);
    const totalBalanceOutstandingUSD = orders.reduce((sum, o) => sum + o.balancePaymentUSD, 0);
    const completedCount = orders.filter(o => o.isCompleted || o.currentStage === 'bl_surrender').length;
    const wentThroughCount = orders.filter(o => o.currentStage !== 'pi_issued' && o.currentStage !== 'bl_surrender').length;

    generateExecutiveSummaryPDF(
      orders,
      totalVolumeUSD,
      totalVolumeAED,
      totalAdvanceReceivedUSD,
      totalBalanceOutstandingUSD,
      completedCount,
      wentThroughCount
    );

    logAudit('EXPORT_REPORT', 'executive-summary', 'REPORT', 'Executive financial & trade report exported to PDF.');
  };

  // Dunning reminder sent
  const handleSendReminder = (alert: AlertNotification) => {
    logAudit(
      'UPDATE_STAGE',
      alert.orderNumber,
      'PAYMENT',
      `Dispatched automated dunning notice to ${alert.companyName} for overdue balance of $${alert.amountUSD?.toLocaleString()} USD.`
    );
  };

  // Handle successful authentication
  const handleLockSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    if (developmentUser) {
      setDevelopmentUser(null);
      void fetch('/api/development/sign-out', { method: 'POST', credentials: 'include' });
    }
    void sessionAuth.signOut();
  };

  if ((isAuthLoading && !developmentUser) || isDevelopmentSessionLoading || isAccessChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm font-bold">Checking your secure session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="sfa-auth-ui min-h-[100dvh] overflow-y-auto bg-slate-950 px-4 py-6 text-slate-100 selection:bg-blue-600 selection:text-white sm:grid sm:place-items-center sm:p-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-blue-950/40">
          <div className="border-b border-slate-700/80 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 px-6 py-7 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 ring-2 ring-white/20">
              <LockKeyhole className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div className="mb-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />
              <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                SFA Globex · Secure Portal
              </span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">SFA Globex Security Gateway</h1>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
              Authorized Ferro Alloys &amp; Metals Trade Operations
            </p>
          </div>

          <div className="px-5 py-6 sm:px-6">
            {authMessage && (
              <div role="alert" className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-amber-100">
                {authMessage}
              </div>
            )}
              <p className="mb-5 text-center text-xs leading-relaxed text-slate-400">
                Use your email address as your username. Create an account, sign in with a password, use Google, or reset a forgotten password.
              </p>
              {IS_LOCAL_DEVELOPMENT && (
                <DevelopmentLogin onAuthenticated={setDevelopmentUser} />
              )}
              <AuthView pathname={window.location.pathname} className="mx-auto max-w-none border-0 bg-transparent p-0 shadow-none" />
          </div>

          <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-3 text-center text-[10px] font-medium tracking-wide text-slate-500">
            Encrypted session · Automatically signs out after 1 minute of inactivity
          </div>
        </div>
      </div>
    );
  }

  if (!isDatabaseReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm font-bold">Loading the secure order database…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white font-sans">
      
      {/* Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        onOpenNewOrder={() => setIsOrderFormOpen(true)}
        onOpenCompanies={() => setIsCompaniesOpen(true)}
        onOpenSecurityAudit={() => setIsSecurityAuditOpen(true)}
        onOpenAlerts={() => setIsAlertsDrawerOpen(true)}
        onOpenExecutivePDF={handleExecutivePDF}
        onLockSession={handleLockSession}
        alerts={alerts}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">

        {databaseError && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <strong>Database sync issue:</strong> {databaseError}. Your change was not saved; please try again.
          </div>
        )}
        
        {activeTab === 'analytics' ? (
          <ExecutiveDashboard
            orders={orders}
            companies={companies}
            alerts={alerts}
            onSelectOrder={(order) => setSelectedOrderDetail(order)}
            onOpenOrderForm={() => setIsOrderFormOpen(true)}
            onSendReminder={handleSendReminder}
          />
        ) : (
          <OrdersView
            orders={orders}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            userRole={currentUser.role}
            onSelectOrder={(order) => setSelectedOrderDetail(order)}
            onOpenOrderForm={() => setIsOrderFormOpen(true)}
            onAdvanceStage={handleAdvanceStage}
            onAdvanceLotStage={handleAdvanceLotStage}
            onRecordLotAdvance={handleRecordLotAdvance}
            onQuickPayBalance={handleQuickPayBalance}
            onAmendOrder={(order) => setOrderToAmend(order)}
            onDeleteOrder={(order) => setOrderToDelete(order)}
            onLoadSampleOrder={handleLoadSampleOrder}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-5 text-xs text-slate-400 sm:py-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
            <span className="font-bold text-white tracking-wider">SFA Globex FZCO</span>
            <span className="text-slate-600">|</span>
            <a 
              href="https://sfaglobex.ae" 
              target="_blank" 
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              sfaglobex.ae
            </a>
            <span className="text-slate-600">•</span>
            <span>Jumeirah Lakes Towers (JLT), Dubai, UAE</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-slate-400 sm:justify-end">
            <button
              onClick={() => setIsSecurityAuditOpen(true)}
              className="hover:text-emerald-400 transition"
            >
              AES-256-GCM Cryptographic Audit
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setIsCompaniesOpen(true)}
              className="hover:text-white transition"
            >
              Buyer Companies Directory
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={handleLockSession}
              className="hover:text-blue-400 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Slide-overs */}
      
      {/* 1. Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrderDetail}
        onClose={() => setSelectedOrderDetail(null)}
        userRole={currentUser.role}
        onUpdateOrder={handleUpdateOrder}
        onOpenAmendModal={(order) => setOrderToAmend(order)}
        onOpenDeleteModal={(order) => setOrderToDelete(order)}
      />

      {/* 2. Order Form Modal (Create New Order) */}
      <OrderFormModal
        isOpen={isOrderFormOpen}
        onClose={() => setIsOrderFormOpen(false)}
        companies={companies}
        onSaveOrder={handleSaveOrder}
        onOpenAddCompany={() => {
          setIsOrderFormOpen(false);
          setIsCompaniesOpen(true);
        }}
      />

      {/* 3. Amend / Update Order Modal */}
      <AmendOrderModal
        isOpen={!!orderToAmend}
        order={orderToAmend}
        onClose={() => setOrderToAmend(null)}
        companies={companies}
        onUpdateOrder={handleAmendOrder}
      />

      {/* 4. Delete Order Confirmation Modal */}
      <DeleteOrderModal
        isOpen={!!orderToDelete}
        order={orderToDelete}
        onClose={() => setOrderToDelete(null)}
        onConfirmDelete={handleDeleteOrder}
      />

      {/* 5. Companies Directory Modal */}
      <CompaniesModal
        isOpen={isCompaniesOpen}
        onClose={() => setIsCompaniesOpen(false)}
        companies={companies}
        orders={orders}
        onAddCompany={handleAddCompany}
        onDeleteCompany={handleDeleteCompany}
      />

      {/* 6. Security & Audit Modal */}
      <SecurityAuditModal
        isOpen={isSecurityAuditOpen}
        onClose={() => setIsSecurityAuditOpen(false)}
        auditLogs={auditLogs}
        orders={orders}
        companies={companies}
        onRestoreBackup={handleRestoreBackup}
      />

      {/* 7. Alerts Slide-over Drawer */}
      <AlertsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        alerts={alerts}
        orders={orders}
        onSelectOrder={(order) => setSelectedOrderDetail(order)}
        onMarkAsRead={(id) => {
          setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
        }}
        onSendDunningReminder={handleSendReminder}
      />

    </div>
  );
}
