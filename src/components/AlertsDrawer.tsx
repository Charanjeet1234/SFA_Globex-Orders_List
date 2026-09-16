import React from 'react';
import { 
  X, 
  Bell, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  Send, 
  ArrowRight,
  ShieldAlert,
  Copy,
  Check
} from 'lucide-react';
import { AlertNotification, Order } from '../types';
import { formatUSD, formatAED } from '../utils/pdfGenerator';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertNotification[];
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onMarkAsRead: (alertId: string) => void;
  onSendDunningReminder: (alert: AlertNotification) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  orders,
  onSelectOrder,
  onMarkAsRead,
  onSendDunningReminder,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyNotice = (alert: AlertNotification) => {
    const noticeText = `[NEXUSINSIGHT OFFICIAL PAYMENT NOTICE]
To: ${alert.companyName}
Order Reference: ${alert.orderNumber}
Outstanding Balance: ${alert.amountUSD ? formatUSD(alert.amountUSD) : 'Pending'} (${alert.amountAED ? formatAED(alert.amountAED) : ''})
Due Date: ${alert.dueDate || 'Immediate'}
Notice: ${alert.message}
Please remit payment via designated bank escrow account.`;

    navigator.clipboard.writeText(noticeText);
    setCopiedId(alert.id);
    setTimeout(() => setCopiedId(null), 2500);
    onSendDunningReminder(alert);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Cash Flow Alerts & Notifications
              </h3>
              <p className="text-xs text-slate-400">
                Real-Time Overdue & Pending Invoices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body: Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-700">All Cash Flows Current</p>
              <p className="mt-1">No overdue balances or pending invoice alerts active.</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const matchedOrder = orders.find(o => o.id === alert.orderId || o.orderNumber === alert.orderNumber);

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border text-xs transition ${
                    alert.severity === 'critical'
                      ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                      : alert.severity === 'warning'
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${
                        alert.severity === 'critical' ? 'bg-rose-600 text-white' :
                        alert.severity === 'warning' ? 'bg-amber-500 text-white' :
                        'bg-sky-600 text-white'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-extrabold tracking-tight">
                        {alert.orderNumber}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-2 font-bold text-sm">
                    {alert.title}
                  </div>

                  <p className="mt-1 text-slate-700 leading-relaxed">
                    {alert.message}
                  </p>

                  {alert.amountUSD && (
                    <div className="mt-2.5 p-2 rounded-xl bg-white/90 border border-slate-200/80 flex items-center justify-between font-mono">
                      <span className="text-[11px] font-bold text-slate-500">Balance Due:</span>
                      <span className="font-black text-rose-600 text-xs">
                        {formatAED(alert.amountAED ?? alert.amountUSD * 3.6725)} ({formatUSD(alert.amountUSD)})
                      </span>
                    </div>
                  )}

                  {/* Actions inside alert */}
                  <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopyNotice(alert)}
                      className="flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900"
                    >
                      {copiedId === alert.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Notice Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Dunning Notice</span>
                        </>
                      )}
                    </button>

                    {matchedOrder && (
                      <button
                        onClick={() => {
                          onSelectOrder(matchedOrder);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition flex items-center gap-1"
                      >
                        <span>View Order</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Automated Sentinel Alert Service</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
