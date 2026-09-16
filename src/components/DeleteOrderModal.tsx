import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Order } from '../types';
import { formatUSD, formatAED } from '../utils/pdfGenerator';

interface DeleteOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (orderId: string) => void;
}

export const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-red-50 p-5 border-b border-red-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950">Delete Order</h3>
              <p className="text-xs text-red-700">Permanent Record Deletion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-red-100/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to delete order <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>? 
            This will remove all associated stage milestones, financial balances, and transaction history from SFA Globex records.
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Buyer Company:</span>
              <span className="font-semibold text-slate-800">{order.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Commodity:</span>
              <span className="font-semibold text-slate-800">{order.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Value:</span>
              <span className="font-bold text-slate-900">{formatAED(order.totalAmountAED)} ({formatUSD(order.totalAmountUSD)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Stage:</span>
              <span className="font-medium text-blue-600">{order.currentStage.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            Note: This deletion will be logged in the SFA Globex Immutable Security Audit Trail.
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-delete-order-btn"
            onClick={() => {
              onConfirmDelete(order.id);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-sm flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Order
          </button>
        </div>

      </div>
    </div>
  );
};
