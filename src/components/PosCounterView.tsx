import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Banknote,
  BookOpenCheck,
  CreditCard,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Trash2,
  TriangleAlert,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AppLanguageMode,
  CartItem,
  CustomerProfile,
  HeldBill,
  Medicine,
  MedicineBatch,
  MedicineCategory,
  PaymentMethod,
  SaleUnitType,
} from '../types/pharmacy';
import {
  CATEGORY_LABELS,
  formatPKR,
  PAYMENT_LABELS,
  pickText,
  UI_COPY,
  UNIT_LABELS,
} from '../i18n/translations';
import { DOSAGE_PRESETS, DRUG_INTERACTIONS } from '../data/seedCatalog';
import {
  daysUntilDate,
  formatStockReadable,
  getBatchHealth,
  getBestFefoBatch,
  getExpiredOrQuarantinedBatches,
  getTotalSellableUnits,
} from '../utils/fefo';

interface PosCounterViewProps {
  langMode: AppLanguageMode;
  medicines: Medicine[];
  batches: MedicineBatch[];
  customers: CustomerProfile[];
  cart: CartItem[];
  heldBills: HeldBill[];
  defaultTaxPercent: number;
  todaySales: number;
  todayBillsCount: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenScanner: () => void;
  onAddToCart: (medicine: Medicine, unitType?: SaleUnitType) => void;
  onUpdateCartItemQty: (cartItemId: string, delta: number) => void;
  onChangeCartItemUnit: (cartItemId: string, unitType: SaleUnitType) => void;
  onUpdateCartItemDiscount: (cartItemId: string, discountPercent: number) => void;
  onUpdateCartItemDosage: (cartItemId: string, dosageLabel: string) => void;
  onRemoveCartItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onHoldCurrentBill: (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    doctorName: string;
    rxNumber: string;
    extraDiscountRs: number;
  }) => void;
  onResumeHeldBill: (heldBillId: string) => HeldBill | null;
  onDeleteHeldBill: (heldBillId: string) => void;
  onOpenSubstitutes: (medicine: Medicine) => void;
  onQuickAddMedicine: () => void;
  onJumpToInventory: () => void;
  onJumpToReports: () => void;
  onCompleteSale: (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    doctorName: string;
    rxNumber: string;
    extraDiscountRs: number;
    taxPercent: number;
    paymentMethod: PaymentMethod;
    cashTendered: number;
  }) => void;
}

const CATEGORIES: Array<MedicineCategory | 'All'> = [
  'All',
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Drops',
  'Ointment',
  'Surgical',
];

export const PosCounterView: React.FC<PosCounterViewProps> = ({
  langMode,
  medicines,
  batches,
  customers,
  cart,
  heldBills,
  defaultTaxPercent,
  todaySales,
  todayBillsCount,
  searchInputRef,
  onOpenScanner,
  onAddToCart,
  onUpdateCartItemQty,
  onChangeCartItemUnit,
  onUpdateCartItemDiscount,
  onUpdateCartItemDosage,
  onRemoveCartItem,
  onClearCart,
  onHoldCurrentBill,
  onResumeHeldBill,
  onDeleteHeldBill,
  onOpenSubstitutes,
  onQuickAddMedicine,
  onJumpToInventory,
  onJumpToReports,
  onCompleteSale,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MedicineCategory | 'All'>('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [rxNumber, setRxNumber] = useState('');
  const [extraDiscountRs, setExtraDiscountRs] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(defaultTaxPercent);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [heldModalOpen, setHeldModalOpen] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const handleSelectCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
    } else {
      setCustomerName('');
      setCustomerPhone('');
      if (paymentMethod === 'khata') setPaymentMethod('cash');
    }
  };

  // Clinical Drug-to-Drug Interaction Detection across active cart items
  const interactionWarnings = useMemo(() => {
    if (cart.length < 2) return [];
    const salts = cart.map((c) => c.genericSalt.toLowerCase());
    const matches = [];
    for (const rule of DRUG_INTERACTIONS) {
      if (rule.saltKeywordA === rule.saltKeywordB) {
        const count = salts.filter((s) => s.includes(rule.saltKeywordA)).length;
        if (count >= 2) matches.push(rule);
      } else {
        const hasA = salts.some((s) => s.includes(rule.saltKeywordA));
        const hasB = salts.some((s) => s.includes(rule.saltKeywordB));
        if (hasA && hasB) matches.push(rule);
      }
    }
    return matches;
  }, [cart]);

  // Customer Allergy Warning vs Active Cart
  const allergyAlert = useMemo(() => {
    if (!selectedCustomer?.allergies) return null;
    const allergyLower = selectedCustomer.allergies.toLowerCase();
    if (allergyLower.includes('none') || allergyLower.includes('n/a')) return null;
    if (allergyLower.includes('penicillin')) {
      const hasAmox = cart.some((c) => c.genericSalt.toLowerCase().includes('amoxicillin'));
      if (hasAmox) {
        return `ALLERGY ALERT: ${selectedCustomer.name} has "${selectedCustomer.allergies}" — Amoxicillin/Augmentin detected in bill!`;
      }
    }
    return null;
  }, [selectedCustomer, cart]);

  const liveAlerts = useMemo(() => {
    const nearExpiry = batches.filter(
      (b) => b.quantityUnits > 0 && !b.quarantined && daysUntilDate(b.expiryDate) <= 90
    ).length;
    const lowStock = medicines.filter(
      (m) => getTotalSellableUnits(m.id, batches) <= m.minStockUnits
    ).length;
    return { nearExpiry, lowStock };
  }, [medicines, batches]);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return medicines.filter((m) => {
      if (selectedCategory !== 'All' && m.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        m.nameEn.toLowerCase().includes(q) ||
        m.nameUr.toLowerCase().includes(q) ||
        m.genericSalt.toLowerCase().includes(q) ||
        m.barcode.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [medicines, searchQuery, selectedCategory]);

  // Bill Totals including optional GST/Tax
  const { subtotal, itemDiscounts, taxAmount, netPayable, totalItemCount } = useMemo(() => {
    let rawSub = 0;
    let lineDisc = 0;
    let count = 0;
    for (const item of cart) {
      const gross = item.unitPrice * item.quantity;
      const disc = (gross * item.discountPercent) / 100;
      rawSub += gross;
      lineDisc += disc;
      count += item.quantity;
    }
    const afterItemDisc = Math.max(0, rawSub - lineDisc);
    const safeExtra = Math.min(afterItemDisc, Math.max(0, extraDiscountRs || 0));
    const taxableBase = Math.max(0, afterItemDisc - safeExtra);
    const tax = Math.round(((taxableBase * Math.max(0, taxPercent)) / 100) * 100) / 100;
    const net = Math.max(0, Math.round((taxableBase + tax) * 100) / 100);
    return {
      subtotal: Math.round(rawSub * 100) / 100,
      itemDiscounts: Math.round(lineDisc * 100) / 100,
      taxAmount: tax,
      netPayable: net,
      totalItemCount: count,
    };
  }, [cart, extraDiscountRs, taxPercent]);

  const parsedCashTendered =
    paymentMethod === 'cash'
      ? cashTenderedInput.trim() === ''
        ? netPayable
        : Math.max(0, parseFloat(cashTenderedInput) || 0)
      : netPayable;

  const changeDue = Math.max(0, Math.round((parsedCashTendered - netPayable) * 100) / 100);
  const insufficientCash = paymentMethod === 'cash' && parsedCashTendered < netPayable;
  const khataOverLimit =
    paymentMethod === 'khata' &&
    (!selectedCustomer || selectedCustomer.khataBalance + netPayable > selectedCustomer.creditLimit);

  const handleCheckoutSubmit = () => {
    if (cart.length === 0 || insufficientCash || khataOverLimit) return;
    onCompleteSale({
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      doctorName: doctorName.trim(),
      rxNumber: rxNumber.trim(),
      extraDiscountRs: Math.max(0, extraDiscountRs || 0),
      taxPercent: Math.max(0, taxPercent || 0),
      paymentMethod,
      cashTendered: parsedCashTendered,
    });
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setRxNumber('');
    setExtraDiscountRs(0);
    setCashTenderedInput('');
    setPaymentMethod('cash');
    setMobileCartOpen(false);
  };

  const handleParkBill = () => {
    if (cart.length === 0) return;
    onHoldCurrentBill({
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      doctorName: doctorName.trim(),
      rxNumber: rxNumber.trim(),
      extraDiscountRs: Math.max(0, extraDiscountRs || 0),
    });
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setRxNumber('');
    setExtraDiscountRs(0);
    setCashTenderedInput('');
  };

  const handleResumeBill = (heldId: string) => {
    const resumed = onResumeHeldBill(heldId);
    if (resumed) {
      setSelectedCustomerId(resumed.customerId || '');
      setCustomerName(resumed.customerName);
      setCustomerPhone(resumed.customerPhone);
      setDoctorName(resumed.doctorName);
      setRxNumber(resumed.rxNumber);
      setExtraDiscountRs(resumed.extraDiscountRs);
      setHeldModalOpen(false);
    }
  };

  const renderCartRegister = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* High-Contrast Customer-Facing Register Header */}
      <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="font-display font-semibold text-sm text-white truncate">
              {pickText(UI_COPY.pos.activeBill, langMode)}
            </h2>
          </div>
          <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
            {cart.length} {cart.length === 1 ? 'medicine' : 'medicines'} · {totalItemCount} qty
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Net Total</div>
          <div className="font-mono-num font-bold text-lg text-emerald-400 leading-tight">
            {formatPKR(netPayable)}
          </div>
        </div>
      </div>

      {/* Quick Bill Actions Strip */}
      {(heldBills.length > 0 || cart.length > 0) && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {heldBills.length > 0 && (
              <button
                type="button"
                onClick={() => setHeldModalOpen(true)}
                className="h-7 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-medium text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume Held ({heldBills.length})</span>
              </button>
            )}
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={handleParkBill}
                title="Park / Hold Bill for later"
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>{langMode === 'ur' ? 'ہولڈ' : 'Hold Bill'}</span>
              </button>
              <button
                type="button"
                onClick={onClearCart}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
              >
                {langMode === 'ur' ? UI_COPY.pos.clearBill.ur : UI_COPY.pos.clearBill.en}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clinical Drug Interaction / Allergy Warnings */}
      {(allergyAlert || interactionWarnings.length > 0) && (
        <div className="px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
          {allergyAlert && (
            <div className="flex items-start gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{allergyAlert}</span>
            </div>
          )}
          {interactionWarnings.map((w) => (
            <div key={w.id} className="flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-medium">
                  [{w.severity} Interaction] {w.messageEn}
                </div>
                {langMode !== 'en' && (
                  <div className="font-urdu text-[11px]" dir="rtl">
                    {w.messageUr}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 min-h-[160px] max-h-[320px] lg:max-h-[380px]">
        {cart.length === 0 ? (
          <div className="py-10 px-5 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {langMode === 'ur' ? UI_COPY.pos.emptyCartTitle.ur : UI_COPY.pos.emptyCartTitle.en}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              {langMode === 'ur' ? UI_COPY.pos.emptyCartHint.ur : UI_COPY.pos.emptyCartHint.en}
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const med = medicines.find((m) => m.id === item.medicineId);
            const gross = item.unitPrice * item.quantity;
            const netLine = gross - (gross * item.discountPercent) / 100;
            const canStrip = med && med.stripSize > 1 && med.stripSize <= med.packSize;
            const canLoose = med && med.allowLooseSale && med.packSize > 1;

            return (
              <div key={item.cartItemId} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {item.nameEn}
                    </div>
                    {langMode !== 'en' && (
                      <div className="font-urdu text-xs text-slate-600 dark:text-slate-400 mt-0.5" dir="rtl">
                        {item.nameUr}
                      </div>
                    )}
                    <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 mt-0.5">
                      Batch {item.batchNumber} · Exp {item.expiryDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                      {formatPKR(netLine)}
                    </div>
                    <div className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      @ {formatPKR(item.unitPrice)}
                    </div>
                  </div>
                </div>

                {/* Unit Type + Qty Stepper + Discount */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(['pack', ...(canStrip ? ['strip'] : []), ...(canLoose ? ['loose'] : [])] as SaleUnitType[]).map(
                      (uType) => (
                        <button
                          key={uType}
                          type="button"
                          onClick={() => onChangeCartItemUnit(item.cartItemId, uType)}
                          className={`px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
                            item.saleUnitType === uType
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {langMode === 'ur' ? UNIT_LABELS[uType].ur : UNIT_LABELS[uType].en}
                        </button>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onUpdateCartItemQty(item.cartItemId, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={item.quantity >= item.maxAvailableSelectedUnits}
                        onClick={() => onUpdateCartItemQty(item.cartItemId, 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <select
                      aria-label="Line discount percentage"
                      value={item.discountPercent}
                      onChange={(e) =>
                        onUpdateCartItemDiscount(item.cartItemId, Number(e.target.value))
                      }
                      className="h-8 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-[11px] text-slate-700 dark:text-slate-300"
                    >
                      {[0, 5, 10, 12, 15].map((d) => (
                        <option key={d} value={d}>
                          {d === 0 ? '0%' : `-${d}%`}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onRemoveCartItem(item.cartItemId)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bilingual Dosage Instructions Selector (Printed on Thermal Receipt) */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 shrink-0">Dosage / خوراک:</span>
                  <select
                    value={item.dosageLabel || ''}
                    onChange={(e) => onUpdateCartItemDosage(item.cartItemId, e.target.value)}
                    className="flex-1 h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    {DOSAGE_PRESETS.map((preset) => (
                      <option key={preset.labelEn} value={preset.value}>
                        {preset.value || 'No Dosage Label'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Controls Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2.5">
        {/* Registered Customer / Khata Picker */}
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCustomerId}
            onChange={(e) => handleSelectCustomer(e.target.value)}
            className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="">Walk-in Patient / Customer (عام کسٹمر)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) · Khata: {formatPKR(c.khataBalance)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={langMode === 'ur' ? UI_COPY.pos.customerName.ur : 'Patient Name'}
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="03XX-XXXXXXX"
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num text-xs"
          />
          <input
            type="text"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Dr. Name"
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
          />
          <input
            type="text"
            value={rxNumber}
            onChange={(e) => setRxNumber(e.target.value)}
            placeholder="Rx #"
            className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num text-xs"
          />
        </div>

        {/* 4 Payment Methods: Cash, Card, Easypaisa/JazzCash, Customer Khata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(
            [
              { key: 'cash', icon: Banknote, label: PAYMENT_LABELS.cash },
              { key: 'card', icon: CreditCard, label: PAYMENT_LABELS.card },
              { key: 'easypaisa_jazzcash', icon: Smartphone, label: PAYMENT_LABELS.easypaisa_jazzcash },
              { key: 'khata', icon: BookOpenCheck, label: PAYMENT_LABELS.khata },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              disabled={key === 'khata' && !selectedCustomer}
              onClick={() => setPaymentMethod(key)}
              title={key === 'khata' && !selectedCustomer ? 'Select a registered customer first' : ''}
              className={`h-8 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap disabled:opacity-45 ${
                paymentMethod === key
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{langMode === 'ur' ? label.ur.split(' ')[0] : label.en.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {khataOverLimit && selectedCustomer && (
          <div className="text-[11px] text-rose-600 font-medium">
            Khata limit exceeded (Limit: {formatPKR(selectedCustomer.creditLimit)}, Current: {formatPKR(selectedCustomer.khataBalance)})
          </div>
        )}

        {/* Totals & Extra Discount + Tax */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>{pickText(UI_COPY.pos.subtotal, langMode)}</span>
            <span className="font-mono-num">{formatPKR(subtotal - itemDiscounts)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-1.5 text-slate-600 dark:text-slate-400">
              <span>Disc (Rs.)</span>
              <input
                type="number"
                min={0}
                value={extraDiscountRs || ''}
                onChange={(e) => setExtraDiscountRs(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-16 h-7 px-1.5 text-right rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num text-xs"
              />
            </div>
            <div className="flex items-center justify-between gap-1.5 text-slate-600 dark:text-slate-400">
              <span>GST %</span>
              <input
                type="number"
                min={0}
                max={25}
                step="0.5"
                value={taxPercent || ''}
                onChange={(e) => setTaxPercent(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-16 h-7 px-1.5 text-right rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num text-xs"
              />
            </div>
          </div>

          {taxAmount > 0 && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Tax Amount ({taxPercent}%)</span>
              <span className="font-mono-num">{formatPKR(taxAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <span className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
              {pickText(UI_COPY.pos.netPayable, langMode)}
            </span>
            <span className="font-mono-num font-bold text-lg text-emerald-700 dark:text-emerald-400">
              {formatPKR(netPayable)}
            </span>
          </div>
        </div>

        {/* Cash Tendered + Quick Notes */}
        {paymentMethod === 'cash' && cart.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-600 dark:text-slate-400">
                {langMode === 'ur' ? UI_COPY.pos.cashTendered.ur : UI_COPY.pos.cashTendered.en}
              </label>
              <input
                type="number"
                min={0}
                value={cashTenderedInput}
                onChange={(e) => setCashTenderedInput(e.target.value)}
                placeholder={String(netPayable)}
                className="w-28 h-8 px-2.5 text-right rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-xs font-semibold"
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 flex-wrap">
                {[500, 1000, 2000, 5000].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setCashTenderedInput(String(note))}
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono-num text-[11px] hover:border-emerald-500"
                  >
                    {note}
                  </button>
                ))}
              </div>
              <div className="text-xs font-mono-num">
                {insufficientCash ? (
                  <span className="text-rose-600 font-semibold">Short Cash</span>
                ) : (
                  <span>
                    Change: <strong>{formatPKR(changeDue)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={cart.length === 0 || insufficientCash || khataOverLimit}
          onClick={handleCheckoutSubmit}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {langMode === 'ur'
              ? UI_COPY.pos.completeSale.ur
              : `${UI_COPY.pos.completeSale.en} (${formatPKR(netPayable)})`}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Live 4-Column Store Pulse Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={onJumpToReports}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 rounded-xl px-4 py-3 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'آج کی کل فروخت' : 'Total Sales Revenue'}
          </div>
          <div className="font-mono-num font-bold text-xl text-emerald-700 dark:text-emerald-400 mt-0.5">
            {formatPKR(todaySales)}
          </div>
        </button>

        <button
          type="button"
          onClick={onJumpToReports}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-slate-400 rounded-xl px-4 py-3 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'مکمل بلز' : 'Completed Invoices'}
          </div>
          <div className="font-mono-num font-bold text-xl text-slate-900 dark:text-slate-100 mt-0.5">
            {todayBillsCount} {langMode === 'ur' ? 'رسیدیں' : 'bills'}
          </div>
        </button>

        <button
          type="button"
          onClick={onJumpToInventory}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 rounded-xl px-4 py-3 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'قریب المیعاد بیچز' : 'Expiring ≤ 90 Days'}
          </div>
          <div className="font-mono-num font-bold text-xl text-amber-600 dark:text-amber-400 mt-0.5">
            {liveAlerts.nearExpiry} {langMode === 'ur' ? 'بیچ' : 'batches'}
          </div>
        </button>

        <button
          type="button"
          onClick={onJumpToInventory}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500/60 rounded-xl px-4 py-3 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'کم اسٹاک ادویات' : 'Low Stock Alerts'}
          </div>
          <div className="font-mono-num font-bold text-xl text-rose-600 dark:text-rose-400 mt-0.5">
            {liveAlerts.lowStock} {langMode === 'ur' ? 'آئٹمز' : 'SKUs'}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left 7/8 cols: Search, Category Filters & Medicine Catalog */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                langMode === 'ur'
                  ? UI_COPY.pos.searchPlaceholder.ur
                  : UI_COPY.pos.searchPlaceholder.en
              }
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenScanner}
              className="h-11 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>{langMode === 'ur' ? 'کیمرہ اسکین' : 'Camera Scan'}</span>
            </button>
            <button
              type="button"
              onClick={onQuickAddMedicine}
              className="h-11 px-3.5 rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{langMode === 'ur' ? 'نئی دوائی' : 'Add Medicine'}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {langMode === 'ur' ? CATEGORY_LABELS[cat].ur : CATEGORY_LABELS[cat].en}
              </button>
            );
          })}
        </div>

        {/* Medicine Catalog Grid */}
        {filteredMedicines.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No medicines matched “{searchQuery}”
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium"
              >
                Reset Filter
              </button>
              <button
                type="button"
                onClick={onQuickAddMedicine}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Medicine (نئی دوائی ڈالیں)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMedicines.map((med) => {
              const bestBatch = getBestFefoBatch(med.id, batches);
              const totalUnits = getTotalSellableUnits(med.id, batches);
              const expiredBatches = getExpiredOrQuarantinedBatches(med.id, batches);
              const isExpiredLocked = !bestBatch && expiredBatches.length > 0;
              const isOutOfStock = !bestBatch && expiredBatches.length === 0;
              const isLowStock = bestBatch && totalUnits <= med.minStockUnits;
              const batchHealth = bestBatch ? getBatchHealth(bestBatch) : null;
              const daysLeft = bestBatch ? daysUntilDate(bestBatch.expiryDate) : 0;
              const stripPrice =
                med.packSize > 1
                  ? Math.round((med.mrpPerPack / med.packSize) * med.stripSize * 100) / 100
                  : med.mrpPerPack;
              const loosePrice =
                med.packSize > 1
                  ? Math.round((med.mrpPerPack / med.packSize) * 100) / 100
                  : med.mrpPerPack;

              return (
                <div
                  key={med.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 ${
                    isExpiredLocked
                      ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/30 dark:bg-rose-950/10'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/70 hover:shadow-md hover:shadow-emerald-950/[0.04]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-display font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {med.category.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                            {med.nameEn}
                          </h3>
                          {langMode !== 'en' && (
                            <div className="font-urdu text-xs text-slate-700 dark:text-slate-300" dir="rtl">
                              {med.nameUr}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                          {formatPKR(med.mrpPerPack)}
                        </div>
                        {med.stripSize < med.packSize && (
                          <div className="font-mono-num text-[11px] text-emerald-700 dark:text-emerald-400">
                            {formatPKR(stripPrice)} / patta
                          </div>
                        )}
                        {med.allowLooseSale && med.packSize > 1 && (
                          <div className="font-mono-num text-[10px] text-slate-500 dark:text-slate-400">
                            {formatPKR(loosePrice)} / piece
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {med.genericSalt}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{med.manufacturer}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">Rack {med.rackLocation}</span>
                      {med.requiresPrescription && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">Rx</span>
                        </>
                      )}
                    </div>

                    <div className="pt-1 text-[11px] font-mono-num flex flex-wrap items-center gap-x-2 gap-y-1">
                      {isExpiredLocked ? (
                        <span className="text-rose-700 dark:text-rose-400 font-semibold inline-flex items-center gap-1">
                          <TriangleAlert className="w-3.5 h-3.5" />
                          <span>
                            {langMode === 'ur'
                              ? UI_COPY.pos.expiredLocked.ur
                              : 'Expired Batch Locked — Cannot Dispense'}
                          </span>
                        </span>
                      ) : isOutOfStock ? (
                        <span className="text-slate-500 font-semibold">
                          {pickText(UI_COPY.pos.outOfStock, langMode)}
                        </span>
                      ) : (
                        <>
                          <span
                            className={
                              isLowStock
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-emerald-700 dark:text-emerald-400 font-medium'
                            }
                          >
                            Stock: {formatStockReadable(totalUnits, med)}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={
                              batchHealth === 'critical' || batchHealth === 'warning'
                                ? 'text-amber-700 dark:text-amber-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            FEFO: {bestBatch?.batchNumber} (Exp {bestBatch?.expiryDate} · {daysLeft}d)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => onOpenSubstitutes(med)}
                      className="h-9 px-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{langMode === 'ur' ? 'متبادل' : 'Alt'}</span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {bestBatch && med.allowLooseSale && med.packSize > 1 && (
                        <button
                          type="button"
                          onClick={() => onAddToCart(med, 'loose')}
                          className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap active:scale-[0.98] transition-all duration-150"
                        >
                          + {langMode === 'ur' ? '1 پیس' : 'Piece'}
                        </button>
                      )}
                      {bestBatch && med.stripSize < med.packSize && (
                        <button
                          type="button"
                          onClick={() => onAddToCart(med, 'strip')}
                          className="h-9 px-2.5 rounded-lg border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium whitespace-nowrap active:scale-[0.98] transition-all duration-150"
                        >
                          + {langMode === 'ur' ? 'پتہ' : 'Patta'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!bestBatch}
                        onClick={() => onAddToCart(med, 'pack')}
                        className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-medium flex items-center gap-1 whitespace-nowrap active:scale-[0.98] transition-all duration-150"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {med.packSize === 1
                            ? langMode === 'ur'
                              ? 'شامل کریں'
                              : 'Add Item'
                            : langMode === 'ur'
                            ? 'ڈبہ'
                            : 'Add Box'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right 5/4 cols: Desktop Sticky POS Register */}
      <div className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20">
        {renderCartRegister()}
      </div>
      </div>

      {/* Mobile Floating Bill Bar */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full h-12 px-4 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-950/25 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {langMode === 'ur' ? 'موجودہ بل دیکھیں' : 'View Active Bill'} ({totalItemCount})
              </span>
            </div>
            <span className="font-mono-num font-bold text-sm">{formatPKR(netPayable)}</span>
          </button>
        </div>
      )}

      {/* Mobile Slide-Up Checkout Drawer */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500"
                aria-label="Close bill sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{renderCartRegister()}</div>
          </div>
        </div>
      )}

      {/* Held / Parked Bills Modal */}
      {heldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                Held / Parked Bills ({heldBills.length})
              </h3>
              <button type="button" onClick={() => setHeldModalOpen(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
              {heldBills.map((hb) => (
                <div
                  key={hb.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {hb.label}
                    </div>
                    <div className="text-xs font-mono-num text-slate-500 mt-0.5">
                      {hb.cart.length} items · Held {new Date(hb.heldAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleResumeBill(hb.id)}
                      className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHeldBill(hb.id)}
                      className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
