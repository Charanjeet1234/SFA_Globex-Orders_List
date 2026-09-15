import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Plus, 
  CheckCircle2, 
  MapPin, 
  Mail, 
  Phone, 
  FileText, 
  DollarSign,
  Briefcase,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Company, Order } from '../types';
import { formatUSD, formatAED } from '../utils/pdfGenerator';

interface CompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  orders: Order[];
  onAddCompany: (company: Company) => void;
  onDeleteCompany?: (companyId: string) => void;
}

export const CompaniesModal: React.FC<CompaniesModalProps> = ({
  isOpen,
  onClose,
  companies,
  orders,
  onAddCompany,
  onDeleteCompany,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('United Arab Emirates');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30% Advance, 70% against BL');
  const [creditRating, setCreditRating] = useState<'AAA' | 'AA' | 'A' | 'BBB'>('AA');

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newComp: Company = {
      id: `comp-${Date.now()}`,
      name: name.trim(),
      country,
      contactPerson: contactPerson || 'Procurement Officer',
      email: email || `contact@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: phone || '+971 4 000 0000',
      taxRegistrationNumber: taxRegistrationNumber || `TRN-100${Math.floor(100000000 + Math.random() * 900000000)}0003`,
      paymentTerms,
      creditRating,
      totalOrdersCount: 0,
      totalOrderVolumeUSD: 0,
    };

    onAddCompany(newComp);
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setTaxRegistrationNumber('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              Corporate Enterprise Registry
            </span>
            <h2 className="text-xl font-black text-white mt-0.5">
              Buyer Companies Directory
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          
          {/* Add Company Form */}
          {showAddForm && (
            <form onSubmit={handleAddSubmit} className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-sky-200">
                <h3 className="text-sm font-bold text-sky-950 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>Register New Buyer Company</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-sky-700 hover:text-sky-900 font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Al-Rawabi Commodities FZC"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Country of Incorporation
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Key Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Tariq Al-Mansoor"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@company.ae"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tax / TRN Number
                  </label>
                  <input
                    type="text"
                    value={taxRegistrationNumber}
                    onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                    placeholder="TRN-10029482010003"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Standard Payment Terms
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="30% Advance, 70% against BL copy"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credit Rating
                  </label>
                  <select
                    value={creditRating}
                    onChange={(e) => setCreditRating(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="AAA">AAA (Prime Commercial)</option>
                    <option value="AA">AA (High Grade)</option>
                    <option value="A">A (Upper Medium Grade)</option>
                    <option value="BBB">BBB (Medium Grade)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm"
                >
                  Save Enterprise Company
                </button>
              </div>
            </form>
          )}

          {/* Companies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((company) => {
              const companyOrders = orders.filter(o => o.companyId === company.id);
              const totalUSD = companyOrders.reduce((sum, o) => sum + o.totalAmountUSD, 0);

              return (
                <div 
                  key={company.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">{company.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {company.creditRating}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{company.country}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-50 text-sky-800">
                        {companyOrders.length} Orders
                      </span>
                      {onDeleteCompany && (
                        <button
                          type="button"
                          onClick={() => setCompanyToDelete(company)}
                          title="Delete Company"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Booked Volume:</span>
                      <span className="font-extrabold text-slate-900">{formatUSD(totalUSD)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payment Terms:</span>
                      <span className="font-medium text-slate-800">{company.paymentTerms}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">TRN / Tax ID:</span>
                      <span className="font-mono text-slate-800">{company.taxRegistrationNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Contact:</span>
                      <span>{company.contactPerson} ({company.email})</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{companies.length} Registered Enterprise Partners</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            Close
          </button>
        </div>

      </div>

      {/* Delete Confirmation Dialog */}
      {companyToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Buyer Company?</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900">{companyToDelete.name}</span> from the directory?
            </p>

            {orders.filter(o => o.companyId === companyToDelete.id).length > 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                Notice: This company has <span className="font-bold">{orders.filter(o => o.companyId === companyToDelete.id).length} associated trade order(s)</span>. Existing trade orders will retain the company name for auditing purposes.
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCompany) {
                    onDeleteCompany(companyToDelete.id);
                  }
                  setCompanyToDelete(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
