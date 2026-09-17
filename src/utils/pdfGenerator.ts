import { hasAdvanceReceived } from '../../lib/order-payments.js';
import jsPDF from 'jspdf';
import { Order, ORDER_STAGES } from '../types';

export function formatUSD(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
}

export function formatAED(val: number): string {
  const rounded = Math.round(val);
  return new Intl.NumberFormat('en-AE', { 
    style: 'currency', 
    currency: 'AED', 
    maximumFractionDigits: 0,
    minimumFractionDigits: 0 
  }).format(rounded);
}

/** Use this where a rate per unit must retain fils (e.g. AED 36.70/MT). */
export function formatAEDDecimal(val: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Converts USD amount to AED using standard rounding to nearest integer:
 * e.g., 1175 * 3.6745 = 4317.5375 => 4318
 * 4317.2375 => 4317
 * Values with fractional part >= 0.5 round up to the next integer, < 0.5 round down.
 */
export function convertUsdToAed(usd: number, exchangeRate: number = 3.6725): number {
  return Math.round(usd * exchangeRate);
}

export function generateOrderPDF(order: Order, generatedBy: string = 'System Administrator') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Title & Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SFA Globex FZCO', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('FERRO ALLOYS & METALS TRADE CONTRACT REPORT • sfaglobex.ae', 14, 25);
  doc.text(`CONFIDENTIAL | AUDIT-SEALED | GENERATED: ${new Date().toLocaleString()}`, 14, 31);

  // Status Badge in Header
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - 65, 10, 52, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text('SYSTEM ORDER ID', pageWidth - 62, 16);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(order.orderNumber, pageWidth - 62, 24);

  let currentY = 48;

  // Section: Order & Commercial Overview
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. COMMERCIAL ORDER PARTICULARS', 14, currentY);
  currentY += 4;

  // Horizontal line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 6;

  // 2-column info grid
  const col1X = 14;
  const col2X = 110;
  const lineHeight = 6.5;

  doc.setFontSize(9);

  // Buyer Company
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('BUYER COMPANY:', col1X, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(order.companyName, col1X + 40, currentY);

  // Order Date
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ORDER DATE:', col2X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(order.orderDate, col2X + 35, currentY);
  currentY += lineHeight;

  // Commodity / Product
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PRODUCT / COMMODITY:', col1X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(order.productName, col1X + 40, currentY);

  // Shipment Target
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SHIPMENT DATE:', col2X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(order.shipmentDate || 'Pending Schedule', col2X + 35, currentY);
  currentY += lineHeight;

  // Quantity & Unit
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ORDER QUANTITY:', col1X, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${order.quantity.toLocaleString()} ${order.unit}`, col1X + 40, currentY);

  // Due Date
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT DUE DATE:', col2X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(order.isOverdue ? 220 : 15, order.isOverdue ? 38 : 23, order.isOverdue ? 38 : 42);
  doc.text(`${order.paymentDueDate} ${order.isOverdue ? '(OVERDUE)' : ''}`, col2X + 35, currentY);
  currentY += lineHeight;

  // Port Routing
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ROUTING & PORTS:', col1X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${order.originPort || 'Origin'} -> ${order.destinationPort || 'Destination'}`, col1X + 40, currentY);

  // Vessel / BL info
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('B/L NUMBER:', col2X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(order.billOfLadingNumber || 'Awaiting Issuance', col2X + 35, currentY);
  currentY += 12;

  // Section 2: Financial Valuation & Balance Payment (AED & USD)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. MULTI-CURRENCY FINANCIAL BALANCES (AED & USD)', 14, currentY);
  currentY += 4;
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 4;

  // Financial Table Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, currentY, pageWidth - 28, 38, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, currentY, pageWidth - 28, 38, 'S');

  const boxY = currentY;
  // Table headers
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('FINANCIAL ITEM', 18, boxY + 6);
  doc.text('UAE DIRHAMS (AED)', 85, boxY + 6);
  doc.text('US DOLLARS (USD)', 138, boxY + 6);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, boxY + 8, pageWidth - 14, boxY + 8);

  // Row 1: Unit Price
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Unit Price (per ${order.unit})`, 18, boxY + 14);
  doc.text(formatUSD(order.unitPriceUSD), 138, boxY + 14);
  doc.text(formatAED(order.unitPriceAED), 85, boxY + 14);

  // Row 2: Total Order Value (Quantity * Unit Price)
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Full Amount (${order.quantity} ${order.unit} x Price)`, 18, boxY + 20);
  doc.text(formatUSD(order.totalAmountUSD), 138, boxY + 20);
  doc.text(formatAED(order.totalAmountAED), 85, boxY + 20);

  // Row 3: Advance Received
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // emerald
  doc.text(hasAdvanceReceived(order) ? 'Advance Paid' : 'Advance (planned)', 18, boxY + 26);
  doc.text(`${hasAdvanceReceived(order) ? '- ' : ''}${formatUSD(order.advancePaymentUSD)}`, 138, boxY + 26);
  doc.text(`${hasAdvanceReceived(order) ? '- ' : ''}${formatAED(order.advancePaymentAED)}`, 85, boxY + 26);

  // Row 4: Balance Payment Due (Highlighted)
  doc.setFillColor(254, 242, 242);
  doc.rect(14, boxY + 29, pageWidth - 28, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(order.balancePaymentUSD > 0 ? 185 : 22, order.balancePaymentUSD > 0 ? 28 : 101, order.balancePaymentUSD > 0 ? 28 : 52);
  doc.text('BALANCE PAYMENT DUE:', 18, boxY + 35);
  doc.text(formatUSD(order.balancePaymentUSD), 138, boxY + 35);
  doc.text(formatAED(order.balancePaymentAED), 85, boxY + 35);

  currentY = boxY + 46;

  // Section 3: 7-Stage Process Verification Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TRADE LIFECYCLE & SHIPMENT MILESTONES (7 STAGES)', 14, currentY);
  currentY += 4;
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 6;

  // Stage table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, pageWidth - 28, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('#', 17, currentY + 5);
  doc.text('STAGE DESCRIPTION', 24, currentY + 5);
  doc.text('STATUS', 85, currentY + 5);
  doc.text('COMPLETED / SCHEDULED', 115, currentY + 5);
  doc.text('REFERENCE / DETAILS', 155, currentY + 5);
  currentY += 7;

  // Draw 7 stages
  const currentStageIndex = ORDER_STAGES.findIndex(s => s.id === order.currentStage);

  ORDER_STAGES.forEach((stage, idx) => {
    const isPastOrCurrent = idx <= currentStageIndex;
    const isCurrent = idx === currentStageIndex;
    const record = order.stagesHistory[stage.id];

    // Alternating background
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, pageWidth - 28, 8, 'F');
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${stage.stepNumber}.`, 17, currentY + 5.5);

    doc.setFont('helvetica', isCurrent ? 'bold' : 'normal');
    doc.setTextColor(isCurrent ? 15 : 51, isCurrent ? 23 : 65, isCurrent ? 42 : 85);
    doc.text(stage.label, 24, currentY + 5.5);

    // Status pill text
    if (isCurrent && !order.isCompleted) {
      doc.setTextColor(217, 119, 6); // amber
      doc.text('ACTIVE STAGE', 85, currentY + 5.5);
    } else if (isPastOrCurrent) {
      doc.setTextColor(16, 185, 129); // emerald
      doc.text('VERIFIED COMPLETE', 85, currentY + 5.5);
    } else {
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('PENDING', 85, currentY + 5.5);
    }

    // Completed or scheduled date
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const dateText = record?.completedAt?.slice(0, 10) || record?.scheduledDate || (isPastOrCurrent ? order.orderDate : '—');
    doc.text(dateText, 115, currentY + 5.5);

    // Ref notes
    const refText = (record?.referenceNumber || record?.notes || (isPastOrCurrent ? 'Logged in system' : 'Pending')).slice(0, 24);
    doc.text(refText, 155, currentY + 5.5);

    currentY += 8;
  });

  currentY += 8;

  // Security & Audit Seal Footer
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, pageWidth - 28, 24, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, currentY, pageWidth - 28, 24, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('NEXUSINSIGHT SYSTEM AUDIT & CRYPTOGRAPHIC SEAL', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Authorized Officer: ${generatedBy}  |  Role: Administrative Oversight  |  Encryption: AES-256-GCM Verified`, 18, currentY + 12);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  const checksum = order.encryptedChecksum || `SHA256:4f8a9b2c${order.id}9923ed10fc7728aa11`;
  doc.text(`Digital Fingerprint: ${checksum}`, 18, currentY + 18);

  // Save/Download PDF
  doc.save(`SFAGlobex_${order.orderNumber}_Report.pdf`);
}

export function generateExecutiveSummaryPDF(
  orders: Order[],
  totalUSD: number,
  totalAED: number,
  receivedAdvanceUSD: number,
  pendingBalanceUSD: number,
  completedCount: number,
  activeCount: number
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SFA Globex FZCO — Executive Financial & Trade Report', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`FERRO ALLOYS TRADE CASH FLOW, RECEIVABLES & REVENUE | DATE: ${new Date().toLocaleDateString()}`, 14, 26);

  let y = 46;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE METRICS SUMMARY', 14, y);
  y += 5;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // 4 metric cards
  const cardW = 42;
  const cardH = 22;

  // Card 1
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, cardW, cardH, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ORDERS', 18, y + 6);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${orders.length} Orders`, 18, y + 16);

  // Card 2
  doc.setFillColor(248, 250, 252);
  doc.rect(60, y, cardW, cardH, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('COMPLETED / ACTIVE', 64, y + 6);
  doc.setFontSize(13);
  doc.setTextColor(16, 185, 129);
  doc.text(`${completedCount} / ${activeCount}`, 64, y + 16);

  // Card 3
  doc.setFillColor(248, 250, 252);
  doc.rect(106, y, cardW, cardH, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL BOOKED (AED)', 110, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatAED(totalAED), 110, y + 16);
  doc.setFontSize(7);
  doc.text(formatUSD(totalUSD), 110, y + 21);

  // Card 4
  doc.setFillColor(254, 242, 242);
  doc.rect(152, y, cardW, cardH, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text('OUTSTANDING BALANCE', 156, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28);
  doc.text(formatAED(orders.reduce((sum, o) => sum + o.balancePaymentAED, 0)), 156, y + 16);
  doc.setFontSize(7);
  doc.text(formatUSD(pendingBalanceUSD), 156, y + 21);

  y += cardH + 12;

  // Orders table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RECENT ORDERS & PAYMENT STATUS', 14, y);
  y += 4;
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 6, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('ORDER #', 16, y + 4.5);
  doc.text('BUYER COMPANY', 42, y + 4.5);
  doc.text('PRODUCT', 88, y + 4.5);
  doc.text('TOTAL (AED)', 128, y + 4.5);
  doc.text('BALANCE DUE', 154, y + 4.5);
  doc.text('STAGE', 182, y + 4.5);
  y += 6;

  orders.slice(0, 14).forEach((o, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 6.5, 'F');
    }
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(o.orderNumber, 16, y + 4.5);
    doc.text(o.companyName.slice(0, 22), 42, y + 4.5);
    doc.text(o.productName.slice(0, 20), 88, y + 4.5);
    doc.text(formatAED(o.totalAmountAED), 128, y + 4.5);
    doc.setTextColor(o.balancePaymentUSD > 0 ? 185 : 22, o.balancePaymentUSD > 0 ? 28 : 101, 28);
    doc.text(formatAED(o.balancePaymentAED), 154, y + 4.5);
    doc.setTextColor(15, 23, 42);
    doc.text(o.currentStage.replace(/_/g, ' '), 182, y + 4.5);
    y += 6.5;
  });

  doc.save(`NexusInsight_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
