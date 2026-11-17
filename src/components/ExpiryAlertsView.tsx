import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, PackagePlus, ShieldAlert } from 'lucide-react';
import { AppLanguageMode, Medicine, MedicineBatch } from '../types/pharmacy';
import { formatPKR, pickText, UI_COPY } from '../i18n/translations';
import { daysUntilDate, formatStockReadable, getBatchHealth, getTotalSellableUnits } from '../utils/fefo';

interface ExpiryAlertsViewProps {
  langMode: AppLanguageMode;
  medicines: Medicine[];
  batches: MedicineBatch[];
  onQuarantineBatch: (batchId: string) => void;
  onAddBatch: (medicine: Medicine) => void;
}

export const ExpiryAlertsView: React.FC<ExpiryAlertsViewProps> = ({
  langMode,
  medicines,
  batches,
  onQuarantineBatch,
  onAddBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'expired' | 'near_expiry' | 'low_stock'>('expired');

  const { expiredList, nearExpiryList, lowStockList } = useMemo(() => {
    const expired: Array<{ batch: MedicineBatch; medicine: Medicine; days: number }> = [];
    const near: Array<{ batch: MedicineBatch; medicine: Medicine; days: number }> = [];
    const low: Array<{ medicine: Medicine; sellableUnits: number }> = [];

    for (const batch of batches) {
      if (batch.quantityUnits <= 0) continue;
      const med = medicines.find((m) => m.id === batch.medicineId);
      if (!med) continue;
      const health = getBatchHealth(batch);
      const days = daysUntilDate(batch.expiryDate);

      if (health === 'expired' || health === 'quarantined') {
        expired.push({ batch, medicine: med, days });
      } else if (health === 'critical' || health === 'warning') {
        near.push({ batch, medicine: med, days });
      }
    }

    for (const med of medicines) {
      const sellable = getTotalSellableUnits(med.id, batches);
      if (sellable <= med.minStockUnits) {
        low.push({ medicine: med, sellableUnits: sellable });
      }
    }

    expired.sort((a, b) => a.days - b.days);
    near.sort((a, b) => a.days - b.days);
    low.sort((a, b) => a.sellableUnits - b.sellableUnits);

    return { expiredList: expired, nearExpiryList: near, lowStockList: low };
  }, [medicines, batches]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
          {pickText(UI_COPY.expiry.title, langMode)}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Expired batches are automatically locked from POS billing. Quarantine or restock directly below.
        </p>
      </div>

      {/* Segmented Alert Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('expired')}
          className={`h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'expired'
              ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur' ? UI_COPY.expiry.expiredTab.ur : UI_COPY.expiry.expiredTab.en} ({expiredList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('near_expiry')}
          className={`h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'near_expiry'
              ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur' ? UI_COPY.expiry.nearExpiryTab.ur : UI_COPY.expiry.nearExpiryTab.en} ({nearExpiryList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('low_stock')}
          className={`h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'low_stock'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {langMode === 'ur' ? UI_COPY.expiry.lowStockTab.ur : UI_COPY.expiry.lowStockTab.en} ({lowStockList.length})
        </button>
      </div>

      {/* Expired List */}
      {activeTab === 'expired' && (
        <div className="space-y-3">
          {expiredList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Zero expired batches sitting in active racks.
              </p>
            </div>
          ) : (
            expiredList.map(({ batch, medicine, days }) => (
              <div
                key={batch.id}
                className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {medicine.nameEn}
                    </div>
                    <div className="font-urdu text-xs text-slate-600 dark:text-slate-400" dir="rtl">
                      {medicine.nameUr}
                    </div>
                    <div className="text-xs font-mono-num text-rose-700 dark:text-rose-400 mt-1">
                      Batch {batch.batchNumber} · Expired {batch.expiryDate} ({Math.abs(days)} days ago) · Rack {medicine.rackLocation} · {batch.quantityUnits} units
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {batch.quarantined ? (
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2">
                      {pickText(UI_COPY.expiry.quarantinedLabel, langMode)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onQuarantineBatch(batch.id)}
                      className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium whitespace-nowrap transition-colors"
                    >
                      {langMode === 'ur' ? UI_COPY.expiry.quarantineBtn.ur : UI_COPY.expiry.quarantineBtn.en}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAddBatch(medicine)}
                    className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    {langMode === 'ur' ? UI_COPY.expiry.restockBtn.ur : 'Restock Fresh Batch'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Near Expiry List */}
      {activeTab === 'near_expiry' && (
        <div className="space-y-3">
          {nearExpiryList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
              No batches expiring within the next 90 days.
            </div>
          ) : (
            nearExpiryList.map(({ batch, medicine, days }) => (
              <div
                key={batch.id}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {medicine.nameEn}
                    </div>
                    <div className="font-urdu text-xs text-slate-600 dark:text-slate-400" dir="rtl">
                      {medicine.nameUr}
                    </div>
                    <div className="text-xs font-mono-num text-amber-700 dark:text-amber-400 mt-1">
                      Batch {batch.batchNumber} · Exp {batch.expiryDate} ({days} days remaining) · {batch.quantityUnits} base units · Value {formatPKR((batch.quantityUnits / Math.max(1, medicine.packSize)) * medicine.mrpPerPack)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onQuarantineBatch(batch.id)}
                  className="h-10 px-4 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  Pull from Shelf (Quarantine)
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Low Stock Reorder List */}
      {activeTab === 'low_stock' && (
        <div className="space-y-3">
          {lowStockList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
              All medicines are stocked above minimum reorder thresholds.
            </div>
          ) : (
            lowStockList.map(({ medicine, sellableUnits }) => (
              <div
                key={medicine.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {medicine.nameEn}
                  </div>
                  <div className="font-urdu text-xs text-slate-600 dark:text-slate-400" dir="rtl">
                    {medicine.nameUr}
                  </div>
                  <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400 mt-1">
                    Remaining: <strong className="text-rose-600 dark:text-rose-400">{formatStockReadable(sellableUnits, medicine)}</strong> · Minimum Threshold: {medicine.minStockUnits}u · {medicine.manufacturer}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddBatch(medicine)}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>{langMode === 'ur' ? UI_COPY.expiry.restockBtn.ur : UI_COPY.expiry.restockBtn.en}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
