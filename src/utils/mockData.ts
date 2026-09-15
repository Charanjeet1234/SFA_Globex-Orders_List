import { Company, Order, UserProfile, AuditLog, AlertNotification } from '../types';

export interface SfaProductItem {
  name: string;
  category: 'Ferro Alloys' | 'Minerals & Ores' | 'Recycled Metals & Scrap' | 'Steel Products';
  defaultUnit: 'MT' | 'Containers (TEU)' | 'KG' | 'Units' | 'Pcs';
  suggestedPriceUSD: number;
  specs: string;
}

// SFA Globex FZCO Official Product Catalog (from sfaglobex.ae)
export const SFA_PRODUCT_CATALOG: SfaProductItem[] = [
  // Ferro Alloys
  { name: 'Silico Manganese (SiMn 65/16)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 980, specs: 'Mn: 65% min, Si: 16% min, C: 2.0% max, P: 0.25% max' },
  { name: 'Silico Manganese (SiMn 60/14)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 910, specs: 'Mn: 60% min, Si: 14% min, C: 2.5% max, P: 0.30% max' },
  { name: 'High Carbon Ferro Manganese (HC FeMn 75%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 1150, specs: 'Mn: 75% min, C: 6-8%, Si: 1.5% max, P: 0.20% max' },
  { name: 'Medium Carbon Ferro Manganese (MC FeMn)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 1620, specs: 'Mn: 78-82%, C: 1.0-1.5% max, Si: 1.0% max' },
  { name: 'High Carbon Ferro Chrome (HC FeCr 60%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 1350, specs: 'Cr: 60% min, C: 6-8%, Si: 3.0% max, P: 0.04% max' },
  { name: 'Low Carbon Ferro Chrome (LC FeCr 65%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 2400, specs: 'Cr: 65% min, C: 0.10% max, Si: 1.5% max' },
  { name: 'Ferro Silicon (FeSi 75%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 1420, specs: 'Si: 75% min, Al: 1.5% max, C: 0.10% max, P: 0.04% max' },
  { name: 'Ferro Silicon (FeSi 72%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 1310, specs: 'Si: 72% min, Al: 2.0% max, C: 0.15% max' },
  { name: 'Ferro Molybdenum (FeMo 60%)', category: 'Ferro Alloys', defaultUnit: 'MT', suggestedPriceUSD: 44000, specs: 'Mo: 60% min, Cu: 0.5% max, S: 0.10% max' },
  
  // Minerals & Ores
  { name: 'Manganese Ore (High Grade 44-48% Lumpy)', category: 'Minerals & Ores', defaultUnit: 'MT', suggestedPriceUSD: 215, specs: 'Mn: 44-48%, Fe: 5% max, SiO2: 6% max, Size: 10-75mm' },
  { name: 'Chrome Ore Concentrate (40-42%)', category: 'Minerals & Ores', defaultUnit: 'MT', suggestedPriceUSD: 285, specs: 'Cr2O3: 40-42%, Cr/Fe ratio: 2.4:1, Moisture: 6% max' },
  { name: 'Chrome Ore Lumpy (38-40%)', category: 'Minerals & Ores', defaultUnit: 'MT', suggestedPriceUSD: 260, specs: 'Cr2O3: 38-40%, Lumpy size: 10-100mm' },

  // Recycled Metals & Scrap
  { name: 'Stainless Steel Scrap Grade 304', category: 'Recycled Metals & Scrap', defaultUnit: 'MT', suggestedPriceUSD: 1380, specs: 'Ni: 8% min, Cr: 18% min, Clean solids & bundles' },
  { name: 'Stainless Steel Scrap Grade 316', category: 'Recycled Metals & Scrap', defaultUnit: 'MT', suggestedPriceUSD: 2350, specs: 'Ni: 10-14%, Mo: 2-3%, Cr: 16-18%' },
  { name: 'Aluminium Scrap (Tense / Tabor)', category: 'Recycled Metals & Scrap', defaultUnit: 'MT', suggestedPriceUSD: 1820, specs: 'ISRI Tense / Tabor mixed casting, recovery 92%+' },
  { name: 'Heavy Melting Steel Scrap (HMS 1 & 2 80:20)', category: 'Recycled Metals & Scrap', defaultUnit: 'MT', suggestedPriceUSD: 395, specs: 'ISRI 200-206 compliant, sheared lengths' },

  // Steel Products
  { name: 'Mild Steel Billets (130x130mm 3sp/5sp)', category: 'Steel Products', defaultUnit: 'MT', suggestedPriceUSD: 540, specs: 'Grade 3sp/5sp prime continuous casting steel billets, 6m/12m' },
  { name: 'Mild Steel Billets (150x150mm)', category: 'Steel Products', defaultUnit: 'MT', suggestedPriceUSD: 545, specs: 'Carbon 0.16-0.24%, Mn 0.60-0.90%, Length 12m' },
  { name: 'Stainless Steel Bright Round Bars (SS 304)', category: 'Steel Products', defaultUnit: 'MT', suggestedPriceUSD: 2900, specs: 'Cold drawn & peeled, h9 tolerance, dia 10mm-120mm' },
  { name: 'Stainless Steel Cold Rolled Coils (SS 304 2B)', category: 'Steel Products', defaultUnit: 'MT', suggestedPriceUSD: 2650, specs: 'Thickness: 0.5mm - 3.0mm, Width 1219mm/1500mm, Prime' },
  { name: 'Stainless Steel Welded & Seamless Pipes', category: 'Steel Products', defaultUnit: 'MT', suggestedPriceUSD: 3200, specs: 'ASTM A312 / A358, Schedule 10/40, Grade 304/316L' },
];

// Clean registered trade buyers for SFA Globex (Steel producers & distributors)
export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'comp-sfa-1',
    name: 'Jindal Shadeed Iron & Steel LLC',
    country: 'Sultanate of Oman',
    contactPerson: 'Rajesh Sharma (Commercial)',
    email: 'procurement@jindalshadeed.com',
    phone: '+968 2685 0200',
    taxRegistrationNumber: 'OM-100289410',
    paymentTerms: '20% Advance, 80% against BL copy',
    creditRating: 'AAA',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  },
  {
    id: 'comp-sfa-2',
    name: 'Emirates Steel Arkan PJSC',
    country: 'United Arab Emirates',
    contactPerson: 'Ahmed Al-Rumaithi',
    email: 'supplychain@emiratessteel.com',
    phone: '+971 2 550 1111',
    taxRegistrationNumber: 'TRN-100239019200003',
    paymentTerms: '25% Advance, 75% on BL Surrender',
    creditRating: 'AAA',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  },
  {
    id: 'comp-sfa-3',
    name: 'Conares Metal Supply Ltd',
    country: 'United Arab Emirates',
    contactPerson: 'Vikram Bedi (Logistics)',
    email: 'trade@conares.com',
    phone: '+971 4 883 9933',
    taxRegistrationNumber: 'TRN-10091823740003',
    paymentTerms: '30% Advance, 70% against BL',
    creditRating: 'AA',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  },
  {
    id: 'comp-sfa-4',
    name: 'Tosyali Iron & Steel Industry FZE',
    country: 'Algeria / Turkey',
    contactPerson: 'Murat Yilmaz',
    email: 'procurement@tosyali-holding.com',
    phone: '+90 326 656 2100',
    taxRegistrationNumber: 'TR-8590123910',
    paymentTerms: '15% Advance, 85% on CAD against BL',
    creditRating: 'AA',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  },
  {
    id: 'comp-sfa-5',
    name: 'Ezz Steel Corporation',
    country: 'Egypt',
    contactPerson: 'Tamer El-Masry',
    email: 'rawmaterials@ezzsteel.com',
    phone: '+20 2 2798 1000',
    taxRegistrationNumber: 'EG-312984120',
    paymentTerms: '30% Advance, 70% on BL release',
    creditRating: 'A',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  },
  {
    id: 'comp-sfa-6',
    name: 'Al Ittefaq Steel Products Co.',
    country: 'Saudi Arabia',
    contactPerson: 'Fahad Al-Dossary',
    email: 'purchase@ispc.com.sa',
    phone: '+966 13 812 1111',
    taxRegistrationNumber: 'SA-300189201900003',
    paymentTerms: '20% Advance, 80% on BL presentation',
    creditRating: 'AA',
    totalOrdersCount: 0,
    totalOrderVolumeUSD: 0,
  }
];

// Clean SFA Globex FZCO Authorized Team
export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-sfa-owner',
    username: 'admin',
    name: 'SFA Globex Management',
    email: 'marketing@sfaglobex.ae',
    role: 'owner',
    roleTitle: 'Managing Director & Partner',
    mfaEnabled: true,
    mfaVerified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-15 08:30:00 GST',
  },
  {
    id: 'usr-sfa-fin',
    username: 'finance',
    name: 'Trade Finance Desk',
    email: 'finance@sfaglobex.ae',
    role: 'finance',
    roleTitle: 'Head of Banking & LC Operations',
    mfaEnabled: true,
    mfaVerified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-15 07:15:00 GST',
  },
  {
    id: 'usr-sfa-log',
    username: 'logistics',
    name: 'Chartering & BL Operations',
    email: 'logistics@sfaglobex.ae',
    role: 'logistics',
    roleTitle: 'Logistics & Vessel Operations Specialist',
    mfaEnabled: true,
    mfaVerified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-14 16:45:00 GST',
  },
  {
    id: 'usr-sfa-audit',
    username: 'auditor',
    name: 'Compliance & Audit Officer',
    email: 'compliance@sfaglobex.ae',
    role: 'auditor',
    roleTitle: 'Dubai Trade Compliance Auditor',
    mfaEnabled: true,
    mfaVerified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-12 11:20:00 GST',
  }
];

// Removed custom mock data! Initial orders array starts empty as requested by user.
export const INITIAL_ORDERS: Order[] = [];

// Optional sample SFA Globex order in case user wants to test with 1 click
export function createSampleSfaOrder(): Order {
  const rate = 3.6725;
  const qty = 500; // 500 MT Silico Manganese
  const unitPriceUSD = 980;
  const unitPriceAED = Math.round(unitPriceUSD * rate);
  const totalAmountUSD = qty * unitPriceUSD; // quantity * USD price
  const totalAmountAED = qty * unitPriceAED; // quantity * AED price
  const advancePercent = 0.20; // 20%
  const advanceUSD = Math.round(totalAmountUSD * advancePercent);
  const advanceAED = Math.round(advanceUSD * rate);
  const balanceUSD = totalAmountUSD - advanceUSD;
  const balanceAED = totalAmountAED - advanceAED;

  return {
    id: 'sfa-2026-001',
    orderNumber: 'SFA-2026-001',
    companyId: 'comp-sfa-1',
    companyName: 'Jindal Shadeed Iron & Steel LLC',
    productName: 'Silico Manganese (SiMn 65/16)',
    category: 'Ferro Alloys',
    quantity: qty,
    unit: 'MT',
    exchangeRateUsdToAed: rate,
    unitPriceUSD,
    unitPriceAED,
    totalAmountUSD,
    totalAmountAED,
    advancePaymentUSD: advanceUSD,
    advancePaymentAED: advanceAED,
    balancePaymentUSD: balanceUSD,
    balancePaymentAED: balanceAED,
    currentStage: 'pi_issued',
    isWaitingForBuyerPI: true, // "Only PI issued from company and waiting for PI to be signed from buyer"
    stagesHistory: {
      pi_issued: {
        stage: 'pi_issued',
        completedAt: new Date().toISOString(),
        referenceNumber: 'PI-SFA-2026-0881',
        notes: 'PI issued from SFA Globex FZCO; waiting for buyer to sign and return counter-copy.',
        updatedBy: 'SFA Globex Management'
      },
      pi_signed: { stage: 'pi_signed' },
      advance_received: { stage: 'advance_received' },
      date_of_shipment: { stage: 'date_of_shipment' },
      shipment_dispatched: { stage: 'shipment_dispatched' },
      bl_received: { stage: 'bl_received' },
      got_full_money: { stage: 'got_full_money' },
      bl_surrender: { stage: 'bl_surrender' },
    },
    orderDate: new Date().toISOString().slice(0, 10),
    year: new Date().getFullYear(),
    month: new Date().toISOString().slice(0, 7),
    paymentDueDate: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10),
    shipmentDate: new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10),
    originPort: 'Nhava Sheva Port, India',
    destinationPort: 'Sohar Port, Sultanate of Oman',
    carrierName: 'Maersk Line / Hapag-Lloyd',
    vesselName: 'MV Desert Trader v.240',
    containerNumber: 'MSKU-829104-2 / 20x20ft FCL',
    billOfLadingNumber: 'MAEU-918239102',
    isFullPaymentReceived: false,
    isCompleted: false,
    isOverdue: false,
    notes: 'Contract FOB Nhava Sheva / CIF Sohar. Pre-shipment inspection by SGS required.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const SFA_SAMPLE_ORDER: Order = createSampleSfaOrder();

export const INITIAL_ALERTS: AlertNotification[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-sfa-init',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' GST',
    userId: 'usr-sfa-owner',
    userName: 'SFA Globex Management',
    userRole: 'owner',
    action: 'LOGIN_MFA',
    targetId: 'auth-session-sfa-01',
    targetType: 'AUTH',
    details: 'System initialized for SFA Globex FZCO (sfaglobex.ae), JLT Dubai. Ready for trade management.',
    ipAddress: '194.170.21.84 (Dubai, UAE)',
    securityHash: 'sha256:sfa98124b8a1c2d3e4f5a6b7c8d9e0f1',
  }
];
