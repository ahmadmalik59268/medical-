import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  PackagePlus,
  Plus,
  Search,
  Tag,
  Truck,
} from 'lucide-react';
import {
  AppLanguageMode,
  Medicine,
  MedicineBatch,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierTransaction,
} from '../types/pharmacy';
import { formatPKR, pickText, UI_COPY } from '../i18n/translations';
import {
  daysUntilDate,
  formatStockReadable,
  getBatchHealth,
  getTotalSellableUnits,
} from '../utils/fefo';
import { ExpiryAlertsView } from './ExpiryAlertsView';
import { PurchasesView } from './PurchasesView';

interface InventoryViewProps {
  langMode: AppLanguageMode;
  medicines: Medicine[];
  batches: MedicineBatch[];
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  purchaseOrders: PurchaseOrder[];
  onAddMedicine: () => void;
  onEditMedicine: (medicine: Medicine) => void;
  onAddBatch: (medicine: Medicine) => void;
  onPrintBarcode: (medicine: Medicine, batch: MedicineBatch | null) => void;
  onQuarantineBatch: (batchId: string) => void;
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

export const InventoryView: React.FC<InventoryViewProps> = ({
  langMode,
  medicines,
  batches,
  suppliers,
  supplierTransactions,
  purchaseOrders,
  onAddMedicine,
  onEditMedicine,
  onAddBatch,
  onPrintBarcode,
  onQuarantineBatch,
  onAddSupplier,
  onPaySupplier,
  onCreatePO,
  onReceivePO,
  onRecordDirectSupply,
}) => {
  const [subSection, setSubSection] = useState<'catalog' | 'expiry' | 'purchases'>('catalog');
  const [search, setSearch] = useState('');
  const [expandedMedId, setExpandedMedId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let expiredBatchCount = 0;
    let nearExpiryCount = 0;

    for (const med of medicines) {
      const sellableUnits = getTotalSellableUnits(med.id, batches);
      totalRetailValue += (sellableUnits / Math.max(1, med.packSize)) * med.mrpPerPack;
      if (sellableUnits <= med.minStockUnits) lowStockCount++;
    }

    for (const batch of batches) {
      if (batch.quantityUnits <= 0) continue;
      const days = daysUntilDate(batch.expiryDate);
      if (batch.quarantined || days <= 0) {
        expiredBatchCount++;
      } else if (days <= 90) {
        nearExpiryCount++;
      }
    }

    return {
      totalSkus: medicines.length,
      totalRetailValue,
      lowStockCount,
      expiredBatchCount,
      alertTotal: lowStockCount + expiredBatchCount + nearExpiryCount,
    };
  }, [medicines, batches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(
      (m) =>
        m.nameEn.toLowerCase().includes(q) ||
        m.nameUr.toLowerCase().includes(q) ||
        m.genericSalt.toLowerCase().includes(q) ||
        m.barcode.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q)
    );
  }, [medicines, search]);

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            {pickText(UI_COPY.inventory.title, langMode)}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete stock catalog, FEFO expiry radar, barcode sticker printing, and supplier purchase orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSubSection('purchases')}
            className={`h-11 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap transition-colors ${
              subSection === 'purchases'
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>
              {langMode === 'ur' ? 'سپلائرز / مال وصولی' : 'Suppliers & Stock In'}
            </span>
          </button>
          <button
            type="button"
            onClick={onAddMedicine}
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{langMode === 'ur' ? UI_COPY.inventory.addMedicine.ur : UI_COPY.inventory.addMedicine.en}</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.inventory.totalSkus, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {metrics.totalSkus}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.inventory.sellableStockValue, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
            {formatPKR(metrics.totalRetailValue)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.inventory.lowStockCount, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-amber-600 dark:text-amber-400 mt-1">
            {metrics.lowStockCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.inventory.expiredCount, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-rose-600 dark:text-rose-400 mt-1">
            {metrics.expiredBatchCount}
          </div>
        </div>
      </div>

      {/* Sub-navigation Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setSubSection('catalog')}
          className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subSection === 'catalog'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur' ? 'ادویات اور بیچز' : `Stock & Batches (${medicines.length})`}
        </button>
        <button
          type="button"
          onClick={() => setSubSection('expiry')}
          className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subSection === 'expiry'
              ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur'
            ? `ایکسپائری و کم اسٹاک (${metrics.alertTotal})`
            : `Expiry & Low-Stock (${metrics.alertTotal})`}
        </button>
        <button
          type="button"
          onClick={() => setSubSection('purchases')}
          className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subSection === 'purchases'
              ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur'
            ? `سپلائرز اور خریداری (${purchaseOrders.length})`
            : `Suppliers & Purchase Orders (${purchaseOrders.length})`}
        </button>
      </div>

      {subSection === 'catalog' && (
        <>
          <div className="relative max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inventory by brand, Urdu name, salt, barcode, or rack..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                    <th className="py-3 px-4">Medicine (EN / اردو) & Salt</th>
                    <th className="py-3 px-3">Barcode & Rack</th>
                    <th className="py-3 px-3 text-right">MRP / Cost</th>
                    <th className="py-3 px-3 text-right">Sellable Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filtered.map((med) => {
                    const medBatches = batches
                      .filter((b) => b.medicineId === med.id)
                      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
                    const sellableUnits = getTotalSellableUnits(med.id, batches);
                    const isLow = sellableUnits <= med.minStockUnits;
                    const isExpanded = expandedMedId === med.id;

                    return (
                      <React.Fragment key={med.id}>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedMedId(isExpanded ? null : med.id)}
                              className="flex items-start gap-2 text-left group"
                            >
                              <span className="mt-0.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </span>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {med.nameEn}
                                </div>
                                <div className="font-urdu text-xs text-slate-600 dark:text-slate-400" dir="rtl">
                                  {med.nameUr}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {med.genericSalt} · {med.manufacturer}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono-num text-xs">
                            <div className="text-slate-800 dark:text-slate-200">{med.barcode}</div>
                            <div className="text-slate-500 dark:text-slate-400">
                              Rack {med.rackLocation} · {medBatches.length} batches
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatPKR(med.mrpPerPack)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Cost {formatPKR(med.costPerPack)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num">
                            <div
                              className={`font-semibold ${
                                sellableUnits === 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isLow
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {formatStockReadable(sellableUnits, med)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Min: {med.minStockUnits}u
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onPrintBarcode(med, medBatches[0] || null)}
                                title="Print Barcode Sticker"
                                className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Label</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onAddBatch(med)}
                                title="Receive New Batch"
                                className="h-9 px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 inline-flex items-center gap-1"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Batch</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditMedicine(med)}
                                title="Edit Medicine"
                                className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-950/60">
                            <td colSpan={5} className="px-6 py-3">
                              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                Batches (Sorted by FEFO — First Expiry First Out)
                              </div>
                              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                                {medBatches.map((b) => {
                                  const health = getBatchHealth(b);
                                  const days = daysUntilDate(b.expiryDate);
                                  return (
                                    <div
                                      key={b.id}
                                      className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-num"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                          {b.batchNumber}
                                        </span>
                                        <span className="text-slate-500">Mfg: {b.mfgDate}</span>
                                        <span className="text-slate-700 dark:text-slate-300">
                                          Exp: {b.expiryDate} (
                                          {days > 0 ? `${days}d left` : `${Math.abs(days)}d ago`})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span
                                          className={`font-semibold ${
                                            health === 'expired' || health === 'quarantined'
                                              ? 'text-rose-600 dark:text-rose-400'
                                              : health === 'critical' || health === 'warning'
                                              ? 'text-amber-600 dark:text-amber-400'
                                              : 'text-emerald-700 dark:text-emerald-400'
                                          }`}
                                        >
                                          {health.toUpperCase()} · {b.quantityUnits} base units
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => onPrintBarcode(med, b)}
                                          className="text-emerald-700 dark:text-emerald-400 hover:underline font-sans font-medium"
                                        >
                                          Print Sticker
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {subSection === 'expiry' && (
        <ExpiryAlertsView
          langMode={langMode}
          medicines={medicines}
          batches={batches}
          onQuarantineBatch={onQuarantineBatch}
          onAddBatch={onAddBatch}
        />
      )}

      {subSection === 'purchases' && (
        <PurchasesView
          langMode={langMode}
          medicines={medicines}
          suppliers={suppliers}
          supplierTransactions={supplierTransactions}
          purchaseOrders={purchaseOrders}
          onAddSupplier={onAddSupplier}
          onPaySupplier={onPaySupplier}
          onCreatePO={onCreatePO}
          onReceivePO={onReceivePO}
          onRecordDirectSupply={onRecordDirectSupply}
        />
      )}
    </div>
  );
};
