import React, { useMemo, useState } from 'react';
import { Award, Plus, Search, ShieldAlert, UserPlus, Wallet, X } from 'lucide-react';
import { AppLanguageMode, CustomerProfile, KhataTransaction } from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';

interface CustomersKhataViewProps {
  langMode: AppLanguageMode;
  customers: CustomerProfile[];
  khataTransactions: KhataTransaction[];
  onAddCustomer: (customer: Omit<CustomerProfile, 'id'>) => void;
  onRecordKhataPayment: (customerId: string, amount: number, note: string) => void;
}

export const CustomersKhataView: React.FC<CustomersKhataViewProps> = ({
  langMode,
  customers,
  khataTransactions,
  onAddCustomer,
  onRecordKhataPayment,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<CustomerProfile | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('Cash recovery at counter');

  // New Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronicNotes, setChronicNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState(10000);

  const totalReceivable = useMemo(
    () => customers.reduce((sum, c) => sum + c.khataBalance, 0),
    [customers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.chronicNotes || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || filtered[0] || null;
  const activeTransactions = useMemo(
    () =>
      activeCustomer
        ? khataTransactions.filter((t) => t.customerId === activeCustomer.id)
        : [],
    [khataTransactions, activeCustomer]
  );

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCustomer({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      allergies: allergies.trim() || 'None reported',
      chronicNotes: chronicNotes.trim(),
      creditLimit: Math.max(0, Number(creditLimit)),
      khataBalance: 0,
      loyaltyPoints: 0,
    });
    setName('');
    setPhone('');
    setAddress('');
    setAllergies('');
    setChronicNotes('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            {langMode === 'ur'
              ? 'مریض پروفائل، الرجی اور کسٹمر کھاتہ (ادھار)'
              : 'Patient Profiles, Allergies & Credit Khata'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track patient allergies, chronic therapy notes, loyalty points, and recoverable Khata balances in PKR.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{langMode === 'ur' ? 'نیا کسٹمر شامل کریں' : 'Add Patient / Khata Account'}</span>
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Khata Receivable (ادھار وصولی)</div>
          <div className="font-mono-num font-bold text-2xl text-rose-600 dark:text-rose-400 mt-1">
            {formatPKR(totalReceivable)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Registered Patient Profiles</div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {customers.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Loyalty Points Issued</div>
          <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
            {customers.reduce((s, c) => s + c.loyaltyPoints, 0)} pts
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Searchable Customer List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name, mobile, or condition..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="space-y-2">
            {filtered.map((c) => {
              const selected = activeCustomer?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                    selected
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {c.name}
                      </div>
                      <div className="font-mono-num text-xs text-slate-500 mt-0.5">{c.phone}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono-num font-bold text-sm ${
                          c.khataBalance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatPKR(c.khataBalance)}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-500">
                        {c.loyaltyPoints} pts
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Patient Ledger & Clinical Profile */}
        <div className="lg:col-span-7">
          {activeCustomer ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                    {activeCustomer.name}
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num">
                    {activeCustomer.phone} · Credit Limit {formatPKR(activeCustomer.creditLimit)}
                  </div>
                  {activeCustomer.address && (
                    <div className="text-xs text-slate-500 mt-0.5">{activeCustomer.address}</div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Khata Balance</div>
                    <div
                      className={`font-mono-num font-bold text-xl ${
                        activeCustomer.khataBalance > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatPKR(activeCustomer.khataBalance)}
                    </div>
                  </div>
                  {activeCustomer.khataBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentModalCustomer(activeCustomer);
                        setPaymentAmount(String(activeCustomer.khataBalance));
                      }}
                      className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Receive Payment / وصولی</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Clinical Allergy & Loyalty Alert */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Allergies & Clinical Notes</span>
                  </div>
                  <div className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    <strong>Allergies:</strong> {activeCustomer.allergies || 'None reported'}
                  </div>
                  {activeCustomer.chronicNotes && (
                    <div className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                      <strong>Therapy:</strong> {activeCustomer.chronicNotes}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Loyalty Rewards</span>
                  </div>
                  <div className="font-mono-num font-bold text-lg text-emerald-700 dark:text-emerald-400 mt-1">
                    {activeCustomer.loyaltyPoints} Points
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Earned automatically at 1 pt per Rs. 100 spent
                  </div>
                </div>
              </div>

              {/* Khata Ledger History */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2.5">
                  Khata Ledger History (کھاتہ تفصیل)
                </h3>
                {activeTransactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No credit or recovery transactions recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {activeTransactions.map((tx) => (
                      <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {tx.type === 'debit_sale'
                              ? `Credit Sale (${tx.reference})`
                              : tx.type === 'credit_payment'
                              ? 'Payment Received (وصولی)'
                              : `Return Adjustment (${tx.reference})`}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {tx.note} · {new Date(tx.date).toLocaleString('en-PK')}
                          </div>
                        </div>
                        <span
                          className={`font-mono-num font-bold ${
                            tx.type === 'debit_sale'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {tx.type === 'debit_sale' ? '+' : '-'}
                          {formatPKR(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
              Select a patient profile to view Khata details.
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateCustomer}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">New Patient / Khata Account</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              required
              type="text"
              placeholder="Patient / Customer Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="tel"
                placeholder="Mobile (03XX-XXXXXXX) *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="Credit Limit (Rs.)"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Address (Optional)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              placeholder="Known Drug Allergies (e.g. Penicillin, Sulfa)"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              placeholder="Chronic Condition / Regular Medicines"
              value={chronicNotes}
              onChange={(e) => setChronicNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button type="submit" className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-medium">
                Save Patient Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receive Khata Payment Modal */}
      {paymentModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">Receive Khata Recovery</h3>
              <button type="button" onClick={() => setPaymentModalCustomer(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {paymentModalCustomer.name} · Due: {formatPKR(paymentModalCustomer.khataBalance)}
            </div>
            <input
              type="number"
              min={1}
              max={paymentModalCustomer.khataBalance}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
            />
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Note / Receipt ref"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaymentModalCustomer(null)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = Math.max(0, Number(paymentAmount));
                  if (amt > 0) {
                    onRecordKhataPayment(paymentModalCustomer.id, amt, paymentNote);
                  }
                  setPaymentModalCustomer(null);
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm Recovery</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
