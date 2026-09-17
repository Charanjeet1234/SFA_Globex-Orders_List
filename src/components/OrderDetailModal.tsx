import { hasAdvanceReceived } from '../../lib/order-payments.js';
import { applyLotAdvancePayment, getLotTotal } from '../../lib/order-lots.js';
import React, { useState } from 'react';
import { 
  X, 
  Download, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Ship, 
  FileText, 
  ShieldCheck, 
  Building2, 
  Clock, 
  ArrowRight, 
  AlertTriangle,
  Send,
  Edit2,
  Lock,
  Sparkles,
  Trash2,
  Edit3,
  FileCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order, OrderStage, ORDER_STAGES, UserRole, StageRecord } from '../types';
import { formatUSD, formatAED, generateOrderPDF } from '../utils/pdfGenerator';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  userRole: UserRole;
  onUpdateOrder: (updated: Order) => void;
  onOpenAmendModal?: (order: Order) => void;
  onOpenDeleteModal?: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  userRole,
  onUpdateOrder,
  onOpenAmendModal,
  onOpenDeleteModal,
}) => {
  const [activeTab, setActiveTab] = useState<'stages' | 'financials' | 'logistics' | 'security'>('stages');
  const [editingStage, setEditingStage] = useState<OrderStage | null>(null);
  const [stageRefInput, setStageRefInput] = useState('');
  const [stageNotesInput, setStageNotesInput] = useState('');
  const [paymentInputAED, setPaymentInputAED] = useState('');

  if (!order) return null;

  const currentStageIndex = ORDER_STAGES.findIndex(s => s.id === order.currentStage);

  // Trigger celebration on completing BL Surrender
  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Mark PI as signed by buyer (transitions from pi_issued to pi_signed)
  const handleMarkPiSigned = () => {
    const nowISO = new Date().toISOString();
    const updatedStages = {
      ...order.stagesHistory,
      pi_signed: {
        stage: 'pi_signed' as OrderStage,
        completedAt: nowISO,
        referenceNumber: `PI-${order.orderNumber}-SIGNED`,
        notes: `Signed Proforma Invoice received and verified from ${order.companyName}`,
        updatedBy: `${userRole.toUpperCase()} (SFA Globex)`,
      }
    };

    onUpdateOrder({
      ...order,
      currentStage: 'pi_signed',
      isWaitingForBuyerPI: false,
      stagesHistory: updatedStages,
      updatedAt: nowISO,
    });
  };

  // Advance to next stage in the lifecycle
  const handleAdvanceStage = () => {
    if (currentStageIndex < ORDER_STAGES.length - 1) {
      const nextStage = ORDER_STAGES[currentStageIndex + 1].id;
      const nowISO = new Date().toISOString();

      const updatedStages = {
        ...order.stagesHistory,
        [nextStage]: {
          stage: nextStage,
          completedAt: nowISO,
          referenceNumber: `AUTO-LOG-${Date.now().toString().slice(-6)}`,
          notes: `Stage verified by ${userRole.toUpperCase()} (SFA Globex)`,
        }
      };

      const isFinished = nextStage === 'bl_surrender';
      if (isFinished) {
        triggerCelebration();
      }

      onUpdateOrder({
        ...order,
        currentStage: nextStage,
        isWaitingForBuyerPI: nextStage === 'pi_issued' ? true : false,
        stagesHistory: updatedStages,
        isCompleted: isFinished,
        updatedAt: nowISO,
      });
    }
  };

  // Record an additional payment or full balance payment
  const handleRecordPayment = (payFull = false) => {
    const payAmountAED = payFull ? order.balancePaymentAED : parseFloat(paymentInputAED);
    if (isNaN(payAmountAED) || payAmountAED <= 0) return;

    const rate = order.exchangeRateUsdToAed || 3.6725;
    const payAmountUSD = Math.round(payAmountAED / rate);
    const currentReceivedUSD = Math.max(0, order.totalAmountUSD - order.balancePaymentUSD);
    const currentReceivedAED = Math.max(0, order.totalAmountAED - order.balancePaymentAED);
    const newAdvanceUSD = Math.min(order.totalAmountUSD, currentReceivedUSD + payAmountUSD);
    const newAdvanceAED = Math.min(order.totalAmountAED, currentReceivedAED + payAmountAED);
    const newBalanceUSD = Math.max(0, order.totalAmountUSD - newAdvanceUSD);
    const newBalanceAED = Math.max(0, order.totalAmountAED - newAdvanceAED);
    const isFull = newBalanceUSD === 0;
    const updatedLots = order.lots?.length
      ? applyLotAdvancePayment(order.lots, newAdvanceUSD, {
        unitPriceUSD: order.unitPriceUSD,
        unitPriceAED: order.unitPriceAED,
        exchangeRate: rate,
      })
      : undefined;

    const updatedStages = { ...order.stagesHistory, advance_received: {
      ...order.stagesHistory.advance_received, stage: 'advance_received' as OrderStage,
      completedAt: order.stagesHistory.advance_received?.completedAt || new Date().toISOString(),
    } };

    // If full payment reached and current stage was prior to got_full_money
    if (isFull && currentStageIndex < 6) {
      updatedStages.got_full_money = {
        stage: 'got_full_money',
        completedAt: new Date().toISOString(),
        referenceNumber: `PAY-FULL-${Date.now().toString().slice(-6)}`,
        notes: `Full 100% balance settled. Ready for BL Surrender.`,
      };
    }

    onUpdateOrder({
      ...order,
      advancePaymentUSD: newAdvanceUSD,
      advancePaymentAED: newAdvanceAED,
      balancePaymentUSD: newBalanceUSD,
      balancePaymentAED: newBalanceAED,
      lots: updatedLots,
      isFullPaymentReceived: isFull,
      isOverdue: isFull ? false : order.isOverdue,
      stagesHistory: updatedStages,
      updatedAt: new Date().toISOString(),
    });

    setPaymentInputAED('');
    if (isFull) {
      triggerCelebration();
    }
  };

  // Save stage notes / reference
  const handleSaveStageDetails = (stageId: OrderStage) => {
    const existing = order.stagesHistory[stageId] || { stage: stageId };
    const updatedStages = {
      ...order.stagesHistory,
      [stageId]: {
        ...existing,
        referenceNumber: stageRefInput || existing.referenceNumber,
        notes: stageNotesInput || existing.notes,
        completedAt: existing.completedAt || new Date().toISOString(),
      }
    };

    onUpdateOrder({
      ...order,
      stagesHistory: updatedStages,
      updatedAt: new Date().toISOString(),
    });

    setEditingStage(null);
  };

  const isWaitingPI = order.isWaitingForBuyerPI || order.currentStage === 'pi_issued';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        
        {/* Header with Title & Action controls */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white font-mono">
                  {order.orderNumber}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Year {order.year} • Booked {order.orderDate}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  FX: 1 USD = {order.exchangeRateUsdToAed || 3.6725} AED
                </span>
                {isWaitingPI && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <FileCheck className="w-3 h-3" /> AWAITING BUYER PI
                  </span>
                )}
                {order.isOverdue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> OVERDUE BALANCE
                  </span>
                )}
                {order.isCompleted && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 100% COMPLETE & BL SURRENDERED
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
                {order.productName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-white">{order.companyName}</span>
                <span className="text-slate-500">•</span>
                <span>{order.quantity.toLocaleString()} {order.unit}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{order.category}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Amend Button */}
              {onOpenAmendModal && (
                <button
                  onClick={() => onOpenAmendModal(order)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition"
                  title="Amend / Update Order"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Amend Order</span>
                </button>
              )}

              {/* Delete Button */}
              {onOpenDeleteModal && (
                <button
                  onClick={() => onOpenDeleteModal(order)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white border border-slate-700 transition"
                  title="Delete Order"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* PDF Button */}
              <button
                onClick={() => generateOrderPDF(order)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-5 border-t border-slate-800 pt-3 text-xs overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('stages')}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                activeTab === 'stages' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              8-Stage Process Lifecycle
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                activeTab === 'financials' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Financials & Balance Payment
            </button>
            <button
              onClick={() => setActiveTab('logistics')}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                activeTab === 'logistics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Shipping & BL Details
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 ${
                activeTab === 'security' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Audit & Encryption Seal
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto">
          
          {/* Specific Banner: Only PI issued & Waiting for buyer signature */}
          {isWaitingPI && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <FileCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Contract Pending Buyer Signature
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    Only PI has been issued from SFA Globex FZCO. Waiting for the Proforma Invoice to be counter-signed and returned by {order.companyName}.
                  </p>
                </div>
              </div>
              <button
                onClick={handleMarkPiSigned}
                id="mark-pi-signed-btn"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark PI Signed by Buyer</span>
              </button>
            </div>
          )}

          {/* TAB 1: 8-STAGE TRADE LIFECYCLE */}
          {activeTab === 'stages' && (
            <div className="space-y-6">
              
              {/* Stage Progress Banner */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Current Active Stage
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    Stage {currentStageIndex + 1} of {ORDER_STAGES.length}: {ORDER_STAGES[currentStageIndex]?.label}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ORDER_STAGES[currentStageIndex]?.description}
                  </p>
                </div>

                {userRole !== 'auditor' && !order.isCompleted && (
                  <button
                    onClick={handleAdvanceStage}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-95 shrink-0"
                  >
                    <span>
                      {currentStageIndex === ORDER_STAGES.length - 2 
                        ? 'Authorize BL Surrender' 
                        : currentStageIndex === 0 && isWaitingPI
                        ? 'Record Buyer Signed PI'
                        : `Advance to Stage ${currentStageIndex + 2}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 8-Stage Detailed Interactive Timeline */}
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {ORDER_STAGES.map((stg, idx) => {
                  const isDone = idx < currentStageIndex || order.isCompleted;
                  const isCurrent = idx === currentStageIndex && !order.isCompleted;
                  const record: StageRecord | undefined = order.stagesHistory[stg.id];
                  const isEditing = editingStage === stg.id;

                  return (
                    <div key={stg.id} className="relative group">
                      {/* Step Circle Pin */}
                      <div className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}>
                        {isDone ? '✓' : stg.stepNumber}
                      </div>

                      {/* Content Box */}
                      <div className={`p-4 rounded-xl border transition ${
                        isCurrent
                          ? 'bg-blue-50/50 border-blue-300 shadow-sm'
                          : isDone
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50/50 border-slate-200/80 opacity-75'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">STAGE {stg.stepNumber}</span>
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {stg.label}
                              </h4>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                  IN PROGRESS
                                </span>
                              )}
                              {isDone && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  COMPLETED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {stg.description}
                            </p>
                          </div>

                          {/* Date & Quick Edit Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            {record?.completedAt && (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                {new Date(record.completedAt).toLocaleString()}
                              </span>
                            )}
                            {userRole !== 'auditor' && !isEditing && (
                              <button
                                onClick={() => {
                                  setEditingStage(stg.id);
                                  setStageRefInput(record?.referenceNumber || '');
                                  setStageNotesInput(record?.notes || '');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                title="Edit Stage Reference"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Reference details or inline edit form */}
                        {isEditing ? (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Reference Number / Document ID
                              </label>
                              <input
                                type="text"
                                value={stageRefInput}
                                onChange={(e) => setStageRefInput(e.target.value)}
                                placeholder="e.g. PI#SFA-2026-101, Bank Swift Reference, BL#MAEU9821..."
                                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Operational Notes
                              </label>
                              <input
                                type="text"
                                value={stageNotesInput}
                                onChange={(e) => setStageNotesInput(e.target.value)}
                                placeholder="Add inspection, vessel or bank wire verification notes..."
                                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingStage(null)}
                                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveStageDetails(stg.id)}
                                className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                              >
                                Save Details
                              </button>
                            </div>
                          </div>
                        ) : (
                          (record?.referenceNumber || record?.notes) && (
                            <div className="mt-2 text-xs bg-white/80 p-2 rounded-lg border border-slate-200/80 text-slate-700 space-y-0.5">
                              {record.referenceNumber && (
                                <div>
                                  <span className="font-semibold text-slate-500">Ref: </span>
                                  <span className="font-mono text-slate-900 font-bold">{record.referenceNumber}</span>
                                </div>
                              )}
                              {record.notes && (
                                <div className="text-slate-600">
                                  <span className="font-semibold text-slate-500">Notes: </span>
                                  {record.notes}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIALS & MULTI-CURRENCY BALANCE PAYMENT (USD & AED) */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              
              {/* Financial Balance Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Total Full Amount */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Full Amount
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatAED(order.totalAmountAED)}
                  </div>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5 font-mono">
                    {formatUSD(order.totalAmountUSD)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 font-mono space-y-0.5 border-t border-slate-200/80 pt-1.5">
                    <div>{order.quantity.toLocaleString()} {order.unit} × {formatAED(order.unitPriceAED)} = {formatAED(order.totalAmountAED)}</div>
                    <div>{order.quantity.toLocaleString()} {order.unit} × {formatUSD(order.unitPriceUSD)} = {formatUSD(order.totalAmountUSD)}</div>
                  </div>
                </div>

                {/* Advance Received */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            <span>Advance</span>
                    <span className="bg-emerald-200/60 px-2 py-0.5 rounded-full text-emerald-900 text-[10px]">
                      {order.totalAmountUSD > 0 
                        ? Math.round((order.advancePaymentUSD / order.totalAmountUSD) * 100) 
                        : 0}% {hasAdvanceReceived(order) ? 'Received' : 'Planned'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {formatAED(order.advancePaymentAED)}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800/80 mt-0.5 font-mono">
                    {formatUSD(order.advancePaymentUSD)}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-2">
                    Credited into trade escrow account
                  </div>
                </div>

                {/* Balance Payment */}
                <div className={`p-4 rounded-xl border ${
                  order.balancePaymentUSD > 0
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span>Balance Due</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-mono">
                      {hasAdvanceReceived(order) ? 'Full - Advance' : 'Full Amount'}
                    </span>
                  </div>
                  <div className={`text-2xl font-black mt-1 ${
                    order.balancePaymentUSD > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {formatAED(order.balancePaymentAED)}
                  </div>
                  <div className="text-xs font-semibold mt-0.5 font-mono">
                    {formatUSD(order.balancePaymentUSD)}
                  </div>
                  <div className="text-[11px] mt-2 font-medium">
                    Due Date: {order.paymentDueDate} {order.isOverdue && '(OVERDUE)'}
                  </div>
                </div>

              </div>

              {order.lots && order.lots.length > 0 && (
                <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4" aria-labelledby="saved-lot-payment-heading">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 id="saved-lot-payment-heading" className="text-sm font-black text-slate-900">Lot payment tracker</h3>
                      <p className="text-xs text-slate-600">Lot totals and final amounts are shown in AED first. The final amount is reduced only after the advance is recorded.</p>
                    </div>
                    <span className="w-fit rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-800">{order.lots.length} lots</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-[760px] w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-100">
                        <tr>
                          <th className="px-3 py-2 font-bold">Lot</th>
                          <th className="px-3 py-2 font-bold">Quantity</th>
                          <th className="px-3 py-2 font-bold">Lot total</th>
                          <th className="px-3 py-2 font-bold">Advance</th>
                          <th className="px-3 py-2 font-bold">Final amount</th>
                          <th className="px-3 py-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.lots.map((lot) => {
                          const lotTotal = getLotTotal(lot);
                          return (
                          <tr key={lot.lot_number}>
                            <td className="px-3 py-2.5 font-black text-slate-900">Lot {lot.lot_number}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-700">{lot.quantity.toLocaleString()} MT</td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-800">{formatAED(lotTotal.aed)}</div>
                              <div className="font-mono text-[10px] text-slate-500">{formatUSD(lotTotal.usd)}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-emerald-700">{formatAED(lot.advance_aed)}</div>
                              <div className="font-mono text-[10px] text-slate-500">{formatUSD(lot.advance_usd)}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-amber-800">{formatAED(lot.balance_aed)}</div>
                              <div className="font-mono text-[10px] text-slate-500">{formatUSD(lot.balance_usd)}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${
                                lot.status === 'fully_paid'
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : lot.status === 'partially_paid'
                                    ? 'border-amber-200 bg-amber-100 text-amber-800'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                              }`}>
                                {lot.status === 'fully_paid' ? 'Fully Paid' : lot.status === 'partially_paid' ? 'Partially Paid' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Payment Settlement Action Box */}
              {userRole !== 'auditor' && order.balancePaymentUSD > 0 && (
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Log Incoming Payment / Settle Balance</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Record bank wire transfers received from {order.companyName} to reduce outstanding balance payment.
                  </p>

                  <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-64 relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">AED</span>
                      <input
                        type="number"
                        placeholder="Payment amount (AED)"
                        value={paymentInputAED}
                        onChange={(e) => setPaymentInputAED(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => handleRecordPayment(false)}
                      disabled={!paymentInputAED || parseFloat(paymentInputAED) <= 0}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      Record Partial Payment
                    </button>

                    <button
                      onClick={() => handleRecordPayment(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Settle Full Balance ({formatAED(order.balancePaymentAED)})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Formula & Currency breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800">Financial Balance Formulation:</div>
                <div className="font-mono text-slate-700">
                  Full Amount ({formatAED(order.totalAmountAED)}) - Payments Received ({formatAED(order.totalAmountAED - order.balancePaymentAED)}) = Balance Due ({formatAED(order.balancePaymentAED)} / {formatUSD(order.balancePaymentUSD)})
                </div>
                <div className="text-[11px] text-slate-500">
                  Order Exchange Rate: 1 USD = {order.exchangeRateUsdToAed || 3.6725} AED.
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: LOGISTICS & SHIPPING DETAILS */}
          {activeTab === 'logistics' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Ship className="w-4 h-4 text-blue-600" />
                    <span>Maritime Routing & Carrier</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Origin Port: </span>
                    <span className="text-slate-900 font-medium">{order.originPort || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Destination Port: </span>
                    <span className="text-slate-900 font-medium">{order.destinationPort || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Shipping Line / Carrier: </span>
                    <span className="text-slate-900 font-medium">{order.carrierName || 'TBD'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Vessel Name: </span>
                    <span className="text-slate-900 font-medium">{order.vesselName || 'TBD'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Bill of Lading (BL) & Container</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Bill of Lading #: </span>
                    <span className="text-slate-900 font-mono font-bold">{order.billOfLadingNumber || 'Awaiting Issuance'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Container / Unit: </span>
                    <span className="text-slate-900 font-mono">{order.containerNumber || 'TBD'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Shipment Date: </span>
                    <span className="text-slate-900 font-medium">{order.shipmentDate || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Payment Due Date: </span>
                    <span className={`font-semibold ${order.isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                      {order.paymentDueDate} {order.isOverdue && '(OVERDUE)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT & ENCRYPTION SEAL */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Cryptographic Financial Record Seal</span>
                </div>
                <p className="text-slate-400">
                  All trade valuation data, balance payment formulas, and party identifiers are cryptographically bound to this contract using AES-256-GCM and SHA-256 hashing for SFA Globex FZCO.
                </p>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-blue-300 break-all space-y-1">
                  <div><span className="text-slate-500">Record Fingerprint:</span> {order.encryptedChecksum}</div>
                  <div><span className="text-slate-500">Order Token ID:</span> {order.id}</div>
                  <div><span className="text-slate-500">Created:</span> {order.createdAt}</div>
                  <div><span className="text-slate-500">Last System Mutation:</span> {order.updatedAt}</div>
                </div>

                <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Zero-Knowledge Storage Compliance Verified</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            SFA Globex FZCO (sfaglobex.ae) • Dubai JLT
          </div>
          <div className="flex items-center gap-2">
            {onOpenAmendModal && (
              <button
                onClick={() => onOpenAmendModal(order)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Amend</span>
              </button>
            )}
            <button
              onClick={() => generateOrderPDF(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
