import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Truck,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppLanguageMode,
  Medicine,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierTransaction,
} from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';

interface PurchasesViewProps {
  langMode: AppLanguageMode;
  medicines: Medicine[];
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  purchaseOrders: PurchaseOrder[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onPaySupplier: (
    supplierId: string,
    amount: number,
    collectedBy?: string,
    note?: string
  ) => void;
  onCreatePO: (po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'status'>) => void;
  onReceivePO: (
    poId: string,
    supplierInvoiceNo: string,
    deliveredBy?: string,
    paidNow?: number
  ) => void;
  onRecordDirectSupply: (payload: {
    supplierId: string;
    deliveredBy: string;
    supplierInvoiceNo: string;
    items: PurchaseOrderItem[];
    paidNow: number;
    notes?: string;
  }) => void;
}

function addMonthsIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  langMode,
  medicines,
  suppliers,
  supplierTransactions,
  purchaseOrders,
  onAddSupplier,
  onPaySupplier,
  onCreatePO,
  onReceivePO,
  onRecordDirectSupply,
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'suppliers'>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | 'received' | 'ordered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showDirectSupplyModal, setShowDirectSupplyModal] = useState(false);
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);

  // Pay Supplier modal
  const [payModalSupplier, setPayModalSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payCollectedBy, setPayCollectedBy] = useState('');
  const [payNote, setPayNote] = useState('');

  // Receive pending PO modal
  const [receivePoTarget, setReceivePoTarget] = useState<PurchaseOrder | null>(null);
  const [grnInvoiceNo, setGrnInvoiceNo] = useState('');
  const [grnDeliveredBy, setGrnDeliveredBy] = useState('');
  const [grnPaidNow, setGrnPaidNow] = useState('0');

  // 1-Step Direct Stock Delivery form state
  const [dsSupplierId, setDsSupplierId] = useState(suppliers[0]?.id || '');
  const [dsDeliveredBy, setDsDeliveredBy] = useState('');
  const [dsInvoiceNo, setDsInvoiceNo] = useState('');
  const [dsNotes, setDsNotes] = useState('');
  const [dsPaidNow, setDsPaidNow] = useState('0');
  const [dsItems, setDsItems] = useState<PurchaseOrderItem[]>([]);
  const [dsMedId, setDsMedId] = useState(medicines[0]?.id || '');
  const [dsBatch, setDsBatch] = useState('SUP-101');
  const [dsExpiry, setDsExpiry] = useState(() => addMonthsIso(18));
  const [dsPacks, setDsPacks] = useState(5);
  const [dsBonus, setDsBonus] = useState(0);
  const [dsCostPerPack, setDsCostPerPack] = useState<number>(medicines[0]?.costPerPack || 100);

  // New PO form state
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [lineMedId, setLineMedId] = useState(medicines[0]?.id || '');
  const [lineBatch, setLineBatch] = useState('NEW-401A');
  const [lineExpiry, setLineExpiry] = useState(() => addMonthsIso(18));
  const [linePacks, setLinePacks] = useState(5);
  const [lineBonus, setLineBonus] = useState(0);

  // New Supplier form state
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCity, setSupCity] = useState('Lahore');
  const [supLicense, setSupLicense] = useState('');

  // Aggregated KPIs
  const summaryStats = useMemo(() => {
    const totalSuppliedValue = supplierTransactions
      .filter((t) => t.type === 'delivery')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCashPaid =
      supplierTransactions
        .filter((t) => t.type === 'delivery')
        .reduce((sum, t) => sum + (t.paidAmount || 0), 0) +
      supplierTransactions
        .filter((t) => t.type === 'payment')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalRemainingPayable = suppliers.reduce((sum, s) => sum + s.payableBalance, 0);
    const receivedCount = purchaseOrders.filter((p) => p.status === 'received').length;
    const pendingCount = purchaseOrders.filter((p) => p.status === 'ordered').length;

    return {
      totalSuppliedValue,
      totalCashPaid,
      totalRemainingPayable,
      receivedCount,
      pendingCount,
    };
  }, [supplierTransactions, suppliers, purchaseOrders]);

  const supplierStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalSupplied: number;
        totalPaid: number;
        deliveriesCount: number;
        lastDelivery?: SupplierTransaction;
      }
    >();

    for (const sup of suppliers) {
      const txs = supplierTransactions.filter((t) => t.supplierId === sup.id);
      const deliveries = txs.filter((t) => t.type === 'delivery');
      const payments = txs.filter((t) => t.type === 'payment');

      const totalSupplied = deliveries.reduce((s, d) => s + d.amount, 0);
      const totalPaid =
        deliveries.reduce((s, d) => s + (d.paidAmount || 0), 0) +
        payments.reduce((s, p) => s + p.amount, 0);

      map.set(sup.id, {
        totalSupplied,
        totalPaid,
        deliveriesCount: deliveries.length,
        lastDelivery: deliveries[0],
      });
    }
    return map;
  }, [suppliers, supplierTransactions]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (orderFilter !== 'all' && po.status !== orderFilter) return false;
      if (!q) return true;
      return (
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        po.supplierInvoiceNo.toLowerCase().includes(q) ||
        (po.deliveredBy || '').toLowerCase().includes(q) ||
        po.items.some((i) => i.medicineNameEn.toLowerCase().includes(q))
      );
    });
  }, [purchaseOrders, orderFilter, searchQuery]);

  const dsTotalAmount = useMemo(
    () => dsItems.reduce((sum, item) => sum + item.packsOrdered * item.costPerPack, 0),
    [dsItems]
  );

  const openDirectSupplyModal = (preselectedSupplierId?: string) => {
    const supId = preselectedSupplierId || dsSupplierId || suppliers[0]?.id || '';
    const sup = suppliers.find((s) => s.id === supId);
    const defaultMed = medicines[0];
    setDsSupplierId(supId);
    setDsDeliveredBy(sup ? `${sup.contactPerson} (Delivery)` : '');
    setDsInvoiceNo(`CH-${Math.floor(10000 + Math.random() * 89999)}`);
    setDsNotes('');
    setDsPaidNow('0');
    setDsItems([]);
    if (defaultMed) {
      setDsMedId(defaultMed.id);
      setDsCostPerPack(defaultMed.costPerPack);
    }
    setDsBatch(`SUP-${Math.floor(100 + Math.random() * 899)}`);
    setDsExpiry(addMonthsIso(18));
    setDsPacks(5);
    setDsBonus(0);
    setShowDirectSupplyModal(true);
  };

  const handleAddDirectLine = () => {
    const med = medicines.find((m) => m.id === dsMedId);
    if (!med) return;
    const packs = Math.max(1, Number(dsPacks) || 1);
    const bonus = Math.max(0, Number(dsBonus) || 0);
    const cost = Math.max(1, Number(dsCostPerPack) || med.costPerPack);
    setDsItems((prev) => [
      ...prev,
      {
        medicineId: med.id,
        medicineNameEn: med.nameEn,
        batchNumber: dsBatch.trim() || `BAT-${String(Date.now()).slice(-4)}`,
        mfgDate: new Date().toISOString().slice(0, 10),
        expiryDate: dsExpiry,
        packsOrdered: packs,
        bonusPacks: bonus,
        costPerPack: cost,
      },
    ]);
  };

  const handleSubmitDirectSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dsSupplierId || dsItems.length === 0) return;
    const paid = Math.max(0, Number(dsPaidNow) || 0);
    onRecordDirectSupply({
      supplierId: dsSupplierId,
      deliveredBy: dsDeliveredBy.trim() || 'Supplier Delivery Rider',
      supplierInvoiceNo: dsInvoiceNo.trim() || `CH-${String(Date.now()).slice(-5)}`,
      items: dsItems,
      paidNow: paid,
      notes: dsNotes.trim(),
    });
    setDsItems([]);
    setShowDirectSupplyModal(false);
  };

  const handleAddPoLine = () => {
    const med = medicines.find((m) => m.id === lineMedId);
    if (!med) return;
    setPoItems((prev) => [
      ...prev,
      {
        medicineId: med.id,
        medicineNameEn: med.nameEn,
        batchNumber: lineBatch.trim() || 'BATCH-01',
        mfgDate: new Date().toISOString().slice(0, 10),
        expiryDate: lineExpiry,
        packsOrdered: Math.max(1, linePacks),
        bonusPacks: Math.max(0, lineBonus),
        costPerPack: med.costPerPack,
      },
    ]);
  };

  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier || poItems.length === 0) return;
    const totalAmount = poItems.reduce((sum, i) => sum + i.packsOrdered * i.costPerPack, 0);
    onCreatePO({
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierInvoiceNo: 'Pending GRN',
      items: poItems,
      totalAmount,
      paidAmount: 0,
    });
    setPoItems([]);
    setShowNewPoModal(false);
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    onAddSupplier({
      name: supName.trim(),
      contactPerson: supContact.trim() || 'Sales Rep',
      phone: supPhone.trim(),
      city: supCity.trim() || 'Lahore',
      ntnOrLicense: supLicense.trim() || 'DIST-REG',
      payableBalance: 0,
    });
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupLicense('');
    setShowSupplierModal(false);
  };

  const ledgerTxs = useMemo(() => {
    if (!ledgerSupplier) return [];
    return supplierTransactions.filter((t) => t.supplierId === ledgerSupplier.id);
  }, [ledgerSupplier, supplierTransactions]);

  return (
    <div className="space-y-5">
      {/* 4-Column Supplier Financial KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'کل وصول شدہ مال' : 'Total Goods Supplied · کل مال'}
          </div>
          <div className="font-mono-num font-bold text-xl text-slate-900 dark:text-slate-100 mt-1">
            {formatPKR(summaryStats.totalSuppliedValue)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'کل ادائیگی' : 'Total Paid to Suppliers · ادائیگی'}
          </div>
          <div className="font-mono-num font-bold text-xl text-emerald-700 dark:text-emerald-400 mt-1">
            {formatPKR(summaryStats.totalCashPaid)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'کل بقایا واجب الادا' : 'Remaining Payable · بقایا'}
          </div>
          <div
            className={`font-mono-num font-bold text-xl mt-1 ${
              summaryStats.totalRemainingPayable > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatPKR(summaryStats.totalRemainingPayable)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {langMode === 'ur' ? 'ڈلیوریز / زیر التواء آرڈرز' : 'Deliveries / Pending POs'}
          </div>
          <div className="font-mono-num font-bold text-xl text-slate-900 dark:text-slate-100 mt-1">
            {summaryStats.receivedCount} <span className="text-sm font-normal text-slate-400">/</span>{' '}
            <span className="text-amber-600 dark:text-amber-400">{summaryStats.pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab('orders')}
            className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'orders'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {langMode === 'ur'
              ? `مال کی وصولی و آرڈرز (${purchaseOrders.length})`
              : `Stock Deliveries & POs (${purchaseOrders.length})`}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('suppliers')}
            className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'suppliers'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {langMode === 'ur'
              ? `سپلائرز اور کھاتہ (${suppliers.length})`
              : `Suppliers & Khata Ledger (${suppliers.length})`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSupplierModal(true)}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <Building2 className="w-4 h-4" />
            <span>{langMode === 'ur' ? 'نیا سپلائر' : 'Add Supplier'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedSupplierId && suppliers[0]) setSelectedSupplierId(suppliers[0].id);
              setShowNewPoModal(true);
            }}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4" />
            <span>{langMode === 'ur' ? 'نیا آرڈر (PO)' : 'Create PO'}</span>
          </button>
          <button
            type="button"
            onClick={() => openDirectSupplyModal()}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>
              {langMode === 'ur'
                ? 'نیا مال / ڈلیوری اندراج'
                : 'Record Stock Delivery · نیا مال اندراج'}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: DELIVERIES & PURCHASE ORDERS */}
      {subTab === 'orders' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supplier, salesman/rider name, bill #, or medicine..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'received', label: 'Received Deliveries' },
                  { id: 'ordered', label: 'Pending POs' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOrderFilter(opt.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    orderFilter === opt.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500">
              No supplier deliveries or purchase orders match your search.
            </div>
          )}

          {filteredOrders.map((po) => {
            const remainingAmt = Math.max(0, po.totalAmount - (po.paidAmount || 0));
            return (
              <div
                key={po.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                        {po.poNumber}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {po.supplierName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span
                        className={`text-xs font-semibold ${
                          po.status === 'received'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {po.status === 'received'
                          ? 'Received in Stock'
                          : 'Ordered — Pending Delivery'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {langMode === 'ur' ? 'سامان لانے والا:' : 'Delivered By:'}{' '}
                          <strong>{po.deliveredBy || 'Pending Delivery'}</strong>
                        </span>
                      </span>
                      <span className="font-mono-num">Bill / Challan: {po.supplierInvoiceNo}</span>
                      <span className="font-mono-num">
                        {new Date(po.receivedAt || po.createdAt).toLocaleString('en-PK', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown for Delivery */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="grid grid-cols-3 gap-4 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-500">Goods Value · مال</div>
                        <div className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                          {formatPKR(po.totalAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Paid · ادا شدہ</div>
                        <div className="font-mono-num font-bold text-sm text-emerald-700 dark:text-emerald-400">
                          {formatPKR(po.paidAmount || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Remaining · بقایا</div>
                        <div
                          className={`font-mono-num font-bold text-sm ${
                            po.status === 'ordered'
                              ? 'text-slate-500'
                              : remainingAmt > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {po.status === 'ordered' ? '—' : formatPKR(remainingAmt)}
                        </div>
                      </div>
                    </div>

                    {po.status === 'ordered' && (
                      <button
                        type="button"
                        onClick={() => {
                          const sup = suppliers.find((s) => s.id === po.supplierId);
                          setReceivePoTarget(po);
                          setGrnInvoiceNo('CH-' + Math.floor(10000 + Math.random() * 89999));
                          setGrnDeliveredBy(sup ? `${sup.contactPerson} (Delivery)` : '');
                          setGrnPaidNow('0');
                        }}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Receive Stock (GRN)</span>
                      </button>
                    )}
                  </div>
                </div>

                {po.notes && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-lg">
                    Note: {po.notes}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {po.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.medicineNameEn}
                        </div>
                        <div className="font-mono-num text-[11px] text-slate-500">
                          Batch {item.batchNumber} · Exp {item.expiryDate} · {item.packsOrdered} Box
                          {item.bonusPacks > 0 ? ` + ${item.bonusPacks} Bonus` : ''} @{' '}
                          {formatPKR(item.costPerPack)}
                        </div>
                      </div>
                      <div className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {formatPKR(item.packsOrdered * item.costPerPack)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: SUPPLIERS & KHATA LEDGER */}
      {subTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => {
            const stats = supplierStatsMap.get(sup.id) || {
              totalSupplied: 0,
              totalPaid: 0,
              deliveriesCount: 0,
            };
            return (
              <div
                key={sup.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {sup.name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {sup.contactPerson} · {sup.phone || 'No Phone'}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-400 mt-0.5">
                        {sup.city} · {sup.ntnOrLicense}
                      </div>
                    </div>
                    <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>

                  {/* Per-Supplier Supply & Payment Totals */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] text-slate-500">Supplied · مال</div>
                      <div className="font-mono-num font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {formatPKR(stats.totalSupplied)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Paid · ادا شدہ</div>
                      <div className="font-mono-num font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                        {formatPKR(stats.totalPaid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Balance · بقایا</div>
                      <div
                        className={`font-mono-num font-bold text-xs ${
                          sup.payableBalance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatPKR(sup.payableBalance)}
                      </div>
                    </div>
                  </div>

                  {stats.lastDelivery && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Last Delivery:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {stats.lastDelivery.deliveredBy}
                      </strong>{' '}
                      · <span className="font-mono-num">{formatPKR(stats.lastDelivery.amount)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDirectSupplyModal(sup.id)}
                    className="h-9 px-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Stock In</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLedgerSupplier(sup)}
                      className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{langMode === 'ur' ? 'کھاتہ' : 'Ledger'}</span>
                    </button>

                    {sup.payableBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayModalSupplier(sup);
                          setPayAmount(String(sup.payableBalance));
                          setPayCollectedBy(sup.contactPerson || '');
                          setPayNote('');
                        }}
                        className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{langMode === 'ur' ? 'ادائیگی' : 'Pay'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1-STEP RECORD STOCK DELIVERY MODAL */}
      {showDirectSupplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitDirectSupply}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  Record Stock Delivery · نیا مال اور سپلائر اندراج
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Record who delivered the medicines, bill total, cash paid now & remaining balance. Stock is added immediately.
                </p>
              </div>
              <button type="button" onClick={() => setShowDirectSupplyModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Supplier + Who Delivered + Bill # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Distributor · سپلائر *
                  </label>
                  <select
                    value={dsSupplierId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setDsSupplierId(nextId);
                      const sup = suppliers.find((s) => s.id === nextId);
                      if (sup) setDsDeliveredBy(`${sup.contactPerson} (Delivery)`);
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Delivered By / Salesman · کون سامان لایا؟ *
                  </label>
                  <input
                    required
                    type="text"
                    value={dsDeliveredBy}
                    onChange={(e) => setDsDeliveredBy(e.target.value)}
                    placeholder="e.g. Kamran Rider / Tariq Salesman"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Bill / Challan # · بل نمبر
                  </label>
                  <input
                    type="text"
                    value={dsInvoiceNo}
                    onChange={(e) => setDsInvoiceNo(e.target.value)}
                    placeholder="e.g. MP-INV-90412"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-xs"
                  />
                </div>
              </div>

              {/* Add Medicine Line Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Add Delivered Medicines · وصول ہونے والی ادویات شامل کریں
                  </span>
                  <span className="text-[11px] font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                    Line Total: {formatPKR((Number(dsPacks) || 0) * (Number(dsCostPerPack) || 0))}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] text-slate-500 mb-1">Medicine · دوائی</label>
                    <select
                      value={dsMedId}
                      onChange={(e) => {
                        const med = medicines.find((m) => m.id === e.target.value);
                        setDsMedId(e.target.value);
                        if (med) setDsCostPerPack(med.costPerPack);
                      }}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nameEn} ({m.packSize}/box)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Boxes · ڈبے</label>
                    <input
                      type="number"
                      min={1}
                      value={dsPacks}
                      onChange={(e) => setDsPacks(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Bonus · بونس</label>
                    <input
                      type="number"
                      min={0}
                      value={dsBonus}
                      onChange={(e) => setDsBonus(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Cost / Box (Rs.) · ریٹ
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={dsCostPerPack}
                      onChange={(e) => setDsCostPerPack(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-slate-500 mb-1">Batch # · بیچ نمبر</label>
                    <input
                      type="text"
                      value={dsBatch}
                      onChange={(e) => setDsBatch(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-500">Expiry Date · ایکسپائری</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDsExpiry(addMonthsIso(12))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          +1 Yr
                        </button>
                        <button
                          type="button"
                          onClick={() => setDsExpiry(addMonthsIso(24))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          +2 Yr
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={dsExpiry}
                      onChange={(e) => setDsExpiry(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddDirectLine}
                      className="w-full h-9 px-3 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      + Add Medicine
                    </button>
                  </div>
                </div>
              </div>

              {/* Added Items List */}
              {dsItems.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Items in This Delivery ({dsItems.length})
                  </div>
                  {dsItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.medicineNameEn}
                        </span>
                        <span className="text-slate-500 font-mono-num ml-2">
                          {item.packsOrdered} Box{item.bonusPacks > 0 ? ` + ${item.bonusPacks} Bonus` : ''} · @{' '}
                          {formatPKR(item.costPerPack)} · Batch {item.batchNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                          {formatPKR(item.packsOrdered * item.costPerPack)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDsItems((p) => p.filter((_, i) => i !== idx))}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-center py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                  Add at least one medicine above using "+ Add Medicine".
                </div>
              )}

              {/* Payment Settlement Summary */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    Total Goods Value · کل سامان
                  </div>
                  <div className="font-mono-num font-bold text-lg text-slate-900 dark:text-slate-100">
                    {formatPKR(dsTotalAmount)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      Cash Paid Now · نقد ادائیگی (Rs.)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDsPaidNow(String(dsTotalAmount))}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white"
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setDsPaidNow('0')}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, dsTotalAmount)}
                    value={dsPaidNow}
                    onChange={(e) => setDsPaidNow(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-sm font-semibold"
                  />
                </div>

                <div className="sm:text-right">
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    Added to Supplier Balance · بقایا کھاتہ
                  </div>
                  <div
                    className={`font-mono-num font-bold text-lg ${
                      Math.max(0, dsTotalAmount - (Number(dsPaidNow) || 0)) > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatPKR(Math.max(0, dsTotalAmount - (Number(dsPaidNow) || 0)))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Delivery Note (Optional) · نوٹ
                </label>
                <input
                  type="text"
                  value={dsNotes}
                  onChange={(e) => setDsNotes(e.target.value)}
                  placeholder="e.g. Cold-chain ice box verified, balance payable next Tuesday"
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDirectSupplyModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dsItems.length === 0}
                className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Delivery & Add to Stock</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUPPLIER LEDGER MODAL (Who delivered, how much goods, how much paid/remaining) */}
      {ledgerSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  {ledgerSupplier.name} — Supply & Payment Ledger (کھاتہ)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ledgerSupplier.contactPerson} · {ledgerSupplier.phone} · Remaining Payable:{' '}
                  <strong className="text-rose-600 dark:text-rose-400 font-mono-num">
                    {formatPKR(ledgerSupplier.payableBalance)}
                  </strong>
                </p>
              </div>
              <button type="button" onClick={() => setLedgerSupplier(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2.5">
              {ledgerTxs.length === 0 ? (
                <div className="text-sm text-center py-8 text-slate-500">
                  No delivery or payment transactions recorded yet for this distributor.
                </div>
              ) : (
                ledgerTxs.map((tx) => {
                  const isDelivery = tx.type === 'delivery';
                  const unpaid = isDelivery ? Math.max(0, tx.amount - (tx.paidAmount || 0)) : 0;
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs font-bold ${
                              isDelivery
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isDelivery ? 'Stock Delivered · مال آیا' : 'Cash / Bank Paid · ادائیگی'}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono-num text-xs text-slate-600 dark:text-slate-400">
                            Ref: {tx.reference}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono-num text-[11px] text-slate-500">
                            {new Date(tx.date).toLocaleDateString('en-PK')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300">
                          {isDelivery ? 'Delivered By: ' : 'Received By: '}
                          <strong>{tx.deliveredBy || 'N/A'}</strong>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{tx.note}</div>
                      </div>

                      <div className="sm:text-right font-mono-num shrink-0">
                        <div
                          className={`font-bold text-sm ${
                            isDelivery
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isDelivery ? `Goods: ${formatPKR(tx.amount)}` : `Paid: ${formatPKR(tx.amount)}`}
                        </div>
                        {isDelivery && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Paid Now: {formatPKR(tx.paidAmount || 0)} ·{' '}
                            <span className={unpaid > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                              Bal: {formatPKR(unpaid)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = ledgerSupplier;
                  setLedgerSupplier(null);
                  openDirectSupplyModal(target.id);
                }}
                className="h-9 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Delivery</span>
              </button>

              <div className="flex items-center gap-2">
                {ledgerSupplier.payableBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = ledgerSupplier;
                      setLedgerSupplier(null);
                      setPayModalSupplier(target);
                      setPayAmount(String(target.payableBalance));
                      setPayCollectedBy(target.contactPerson || '');
                      setPayNote('');
                    }}
                    className="h-9 px-3.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Pay Balance</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLedgerSupplier(null)}
                  className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive GRN Modal */}
      {receivePoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                Receive Goods (GRN) — {receivePoTarget.poNumber}
              </h3>
              <button type="button" onClick={() => setReceivePoTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adds all ordered + bonus boxes into FEFO inventory for {receivePoTarget.supplierName} (Total Bill:{' '}
              <strong>{formatPKR(receivePoTarget.totalAmount)}</strong>).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Delivered By / Salesman · کون سامان لایا؟
                </label>
                <input
                  type="text"
                  value={grnDeliveredBy}
                  onChange={(e) => setGrnDeliveredBy(e.target.value)}
                  placeholder="e.g. Tariq Mahmood (Delivery Van)"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Distributor Invoice / Challan #</label>
                <input
                  type="text"
                  value={grnInvoiceNo}
                  onChange={(e) => setGrnInvoiceNo(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Cash Paid on Spot (Rs.) · نقد ادائیگی
                </label>
                <input
                  type="number"
                  min={0}
                  max={receivePoTarget.totalAmount}
                  value={grnPaidNow}
                  onChange={(e) => setGrnPaidNow(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceivePoTarget(null)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReceivePO(
                    receivePoTarget.id,
                    grnInvoiceNo || 'GRN-CONFIRMED',
                    grnDeliveredBy || 'Supplier Delivery Van',
                    Number(grnPaidNow) || 0
                  );
                  setReceivePoTarget(null);
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Add to Inventory</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {payModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                Pay Distributor · سپلائر ادائیگی
              </h3>
              <button type="button" onClick={() => setPayModalSupplier(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {payModalSupplier.name} · Payable:{' '}
              <strong className="font-mono-num text-rose-600 dark:text-rose-400">
                {formatPKR(payModalSupplier.payableBalance)}
              </strong>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Amount (Rs.) · رقم</label>
              <input
                type="number"
                min={1}
                max={payModalSupplier.payableBalance}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Collected By / Method · کس کو دیے؟
              </label>
              <input
                type="text"
                value={payCollectedBy}
                onChange={(e) => setPayCollectedBy(e.target.value)}
                placeholder="e.g. Kamran (Cash) / Meezan Bank"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Note (Optional)</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Weekly recovery slip #44"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayModalSupplier(null)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = Math.max(0, Number(payAmount));
                  if (amt > 0) {
                    onPaySupplier(payModalSupplier.id, amt, payCollectedBy, payNote);
                  }
                  setPayModalSupplier(null);
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      {showNewPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitPO}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                New Distributor Purchase Order (with Bonus Scheme)
              </h3>
              <button type="button" onClick={() => setShowNewPoModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium mb-1">Select Distributor</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-semibold">Add Medicine Line to PO</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={lineMedId}
                    onChange={(e) => setLineMedId(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nameEn} (Cost {formatPKR(m.costPerPack)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={lineBatch}
                    onChange={(e) => setLineBatch(e.target.value)}
                    placeholder="Batch #"
                    className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                  />
                  <input
                    type="date"
                    value={lineExpiry}
                    onChange={(e) => setLineExpiry(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      value={linePacks}
                      onChange={(e) => setLinePacks(Number(e.target.value))}
                      placeholder="Boxes"
                      className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={lineBonus}
                      onChange={(e) => setLineBonus(Number(e.target.value))}
                      placeholder="Bonus"
                      className="h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddPoLine}
                  className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium"
                >
                  + Add Line
                </button>
              </div>

              {poItems.length > 0 && (
                <div className="space-y-1.5">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <span>
                        <strong>{item.medicineNameEn}</strong> · {item.packsOrdered} Box
                        {item.bonusPacks > 0 ? ` (+${item.bonusPacks} bonus)` : ''} · Batch {item.batchNumber}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num font-semibold">
                          {formatPKR(item.packsOrdered * item.costPerPack)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPoItems((p) => p.filter((_, i) => i !== idx))}
                          className="text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPoModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={poItems.length === 0}
                className="h-10 px-5 rounded-xl bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-medium"
              >
                Save Purchase Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateSupplier}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                Add Pharmaceutical Distributor · نیا سپلائر
              </h3>
              <button type="button" onClick={() => setShowSupplierModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              required
              type="text"
              placeholder="Distributor Name (e.g. OBS Healthcare)"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Salesman / Contact Person"
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                placeholder="Phone"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="City"
                value={supCity}
                onChange={(e) => setSupCity(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                placeholder="Distributor License #"
                value={supLicense}
                onChange={(e) => setSupLicense(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-medium"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
