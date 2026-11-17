import React from 'react';
import { ArrowRightLeft, Plus, X } from 'lucide-react';
import { Medicine, MedicineBatch } from '../types/pharmacy';
import { findSaltSubstitutes, formatStockReadable } from '../utils/fefo';
import { formatPKR } from '../i18n/translations';

interface SubstitutesModalProps {
  sourceMedicine: Medicine | null;
  allMedicines: Medicine[];
  batches: MedicineBatch[];
  onClose: () => void;
  onAddSubstitute: (medicine: Medicine) => void;
}

export const SubstitutesModal: React.FC<SubstitutesModalProps> = ({
  sourceMedicine,
  allMedicines,
  batches,
  onClose,
  onAddSubstitute,
}) => {
  if (!sourceMedicine) return null;

  const substitutes = findSaltSubstitutes(sourceMedicine, allMedicines, batches);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Generic Salt Substitutes"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Generic Salt Substitutes
              </h2>
              <p className="font-urdu text-xs text-slate-500 dark:text-slate-400" dir="rtl">
                یکساں فارمولے والی متبادل ادویات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close substitutes modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">Selected Medicine · Salt Formula</div>
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
              {sourceMedicine.nameEn}
            </div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              {sourceMedicine.genericSalt}
            </div>
          </div>

          {substitutes.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No alternative brands with the same generic salt formula found in catalog.
              <div className="font-urdu text-xs mt-1" dir="rtl">
                اس فارمولے کی کوئی متبادل دوائی اسٹاک میں موجود نہیں ہے
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {substitutes.map(({ medicine, sellableUnits, bestBatch }) => (
                <div
                  key={medicine.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {medicine.nameEn}
                    </div>
                    <div className="font-urdu text-xs text-slate-600 dark:text-slate-400" dir="rtl">
                      {medicine.nameUr}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-num">
                      {medicine.manufacturer} · Rack {medicine.rackLocation} ·{' '}
                      {sellableUnits > 0
                        ? formatStockReadable(sellableUnits, medicine)
                        : 'Out of Stock'}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                      {formatPKR(medicine.mrpPerPack)}
                    </div>
                    <button
                      type="button"
                      disabled={!bestBatch}
                      onClick={() => {
                        onAddSubstitute(medicine);
                        onClose();
                      }}
                      className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
