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
import { 
  AuthModal 
} from './components/AuthModal';
import { 
  AmendOrderModal 
} from './components/AmendOrderModal';
import { 
  DeleteOrderModal 
} from './components/DeleteOrderModal';

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

const STORAGE_KEY_ORDERS = 'sfa_globex_orders_v2';
const STORAGE_KEY_COMPANIES = 'sfa_globex_companies_v2';
const STORAGE_KEY_LOGS = 'sfa_globex_audit_logs_v2';

export default function App() {
  // State initialization with localStorage fallback
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPANIES);
      return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const [alerts, setAlerts] = useState<AlertNotification[]>(INITIAL_ALERTS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

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

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }, [companies]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(auditLogs));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }, [auditLogs]);

  // Helper to append secure audit log
  const logAudit = async (
    action: AuditLog['action'],
    targetId: string,
    targetType: AuditLog['targetType'],
    details: string
  ) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' GST';
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
    setAuditLogs(prev => [newLog, ...prev]);
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
  const handleSaveOrder = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    // update company order count
    setCompanies(prev => prev.map(c => {
      if (c.id === newOrder.companyId) {
        return {
          ...c,
          totalOrdersCount: c.totalOrdersCount + 1,
          totalOrderVolumeUSD: c.totalOrderVolumeUSD + newOrder.totalAmountUSD,
        };
      }
      return c;
    }));

    logAudit(
      'CREATE_ORDER', 
      newOrder.orderNumber, 
      'ORDER', 
      `Registered trade order for ${newOrder.quantity} ${newOrder.unit} of ${newOrder.productName} valued at $${newOrder.totalAmountUSD.toLocaleString()} USD (${newOrder.totalAmountAED.toLocaleString()} AED) with buyer ${newOrder.companyName}. FX Rate: 1 USD = ${newOrder.exchangeRateUsdToAed} AED.`
    );
  };

  // Update order (e.g. stage transition or payment balance update)
  const handleUpdateOrder = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    if (selectedOrderDetail && selectedOrderDetail.id === updated.id) {
      setSelectedOrderDetail(updated);
    }

    logAudit(
      'UPDATE_STAGE',
      updated.orderNumber,
      'STAGE',
      `Updated order status to '${updated.currentStage.replace(/_/g, ' ')}'. Balance due: $${updated.balancePaymentUSD.toLocaleString()} USD.`
    );
  };

  // Amend existing order (Full update of products, rates, quantities, PI status)
  const handleAmendOrder = (amendedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === amendedOrder.id ? amendedOrder : o));
    if (selectedOrderDetail && selectedOrderDetail.id === amendedOrder.id) {
      setSelectedOrderDetail(amendedOrder);
    }

    logAudit(
      'AMEND_ORDER',
      amendedOrder.orderNumber,
      'ORDER',
      `Amended trade order for ${amendedOrder.productName} (${amendedOrder.companyName}). Valuation: $${amendedOrder.totalAmountUSD.toLocaleString()} USD (${amendedOrder.totalAmountAED.toLocaleString()} AED). FX applied: 1 USD = ${amendedOrder.exchangeRateUsdToAed} AED. Current Stage: ${amendedOrder.currentStage}.`
    );

    setOrderToAmend(null);
  };

  // Delete order permanently
  const handleDeleteOrder = (orderId: string) => {
    const found = orders.find(o => o.id === orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
      setSelectedOrderDetail(null);
    }

    if (found) {
      setCompanies(prev => prev.map(c => {
        if (c.id === found.companyId) {
          return {
            ...c,
            totalOrdersCount: Math.max(0, c.totalOrdersCount - 1),
            totalOrderVolumeUSD: Math.max(0, c.totalOrderVolumeUSD - found.totalAmountUSD),
          };
        }
        return c;
      }));

      logAudit(
        'DELETE_ORDER',
        found.orderNumber,
        'ORDER',
        `Deleted trade order ${found.orderNumber} (${found.productName}) for buyer ${found.companyName}.`
      );
    }

    setOrderToDelete(null);
  };

  // Load sample SFA Globex order
  const handleLoadSampleOrder = () => {
    setOrders([SFA_SAMPLE_ORDER]);
    logAudit(
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
  const handleAddCompany = (newCompany: Company) => {
    setCompanies(prev => [...prev, newCompany]);
    logAudit(
      'CREATE_ORDER',
      newCompany.id,
      'ORDER',
      `Registered new enterprise partner company: ${newCompany.name} (${newCompany.country}).`
    );
  };

  // Delete company
  const handleDeleteCompany = (companyId: string) => {
    const comp = companies.find(c => c.id === companyId);
    setCompanies(prev => prev.filter(c => c.id !== companyId));
    logAudit(
      'DELETE_ORDER',
      companyId,
      'ORDER',
      `Deleted enterprise buyer company: ${comp?.name || companyId} from directory.`
    );
  };

  // Restore backup
  const handleRestoreBackup = (data: { orders: Order[]; companies: Company[] }) => {
    if (data.orders) setOrders(data.orders);
    if (data.companies) setCompanies(data.companies);
    logAudit(
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
    const totalAdvanceReceivedUSD = orders.reduce((sum, o) => sum + o.advancePaymentUSD, 0);
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
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);
    logAudit('LOGIN_MFA', user.id, 'AUTH', `User ${user.name} (${user.role}) authenticated with password & Google Authenticator 2FA.`);
  };

  // Mandatory Authentication Gate: Always prompt for password and 2FA on open
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans">
        <AuthModal
          isOpen={true}
          isMandatory={true}
          onLoginSuccess={handleLoginSuccess}
          availableUsers={INITIAL_USERS}
        />
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
        onLockSession={() => setIsAuthenticated(false)}
        alerts={alerts}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
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
            onQuickPayBalance={handleQuickPayBalance}
            onAmendOrder={(order) => setOrderToAmend(order)}
            onDeleteOrder={(order) => setOrderToDelete(order)}
            onLoadSampleOrder={handleLoadSampleOrder}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-4 text-slate-400">
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
              onClick={() => setIsAuthModalOpen(true)}
              className="hover:text-blue-400 transition"
            >
              MFA Security Gateway
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

      {/* 8. Multi-Factor Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        availableUsers={INITIAL_USERS}
      />

    </div>
  );
}
