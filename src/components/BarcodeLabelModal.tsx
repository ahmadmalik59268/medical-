import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Tag, X } from 'lucide-react';
import { Medicine, MedicineBatch } from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';
import { BarcodeSvg } from './BarcodeSvg';
import { resetBarcodePageRule } from '../utils/printService';

interface BarcodeLabelModalProps {
  medicine: Medicine | null;
  batch: MedicineBatch | null;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  medicine,
  batch,
  onClose,
}) => {
  const [copies, setCopies] = useState(4);

  useEffect(() => {
    if (!medicine) {
      if (document.body.dataset.printMode === 'barcode') {
        delete document.body.dataset.printMode;
      }
      return;
    }
    document.body.dataset.printMode = 'barcode';
    resetBarcodePageRule();
    return () => {
      if (document.body.dataset.printMode === 'barcode') {
        delete document.body.dataset.printMode;
      }
    };
  }, [medicine]);

  if (!medicine) return null;

  const labelCards = Array.from({ length: copies }).map((_, idx) => (
    <div
      key={idx}
      className="bg-white text-black border border-black rounded-lg p-3 flex flex-col justify-between break-inside-avoid"
    >
      <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
        <span className="font-display font-bold text-[10px] uppercase tracking-wide">
          CurePlus Pharmacy
        </span>
        <span className="font-mono-num font-bold text-xs">
          {formatPKR(medicine.mrpPerPack)}
        </span>
      </div>
      <div className="text-xs font-bold truncate">{medicine.nameEn}</div>
      <div className="font-urdu text-[10px] text-black truncate" dir="rtl">
        {medicine.nameUr}
      </div>
      <div className="my-1.5 flex justify-center">
        <BarcodeSvg value={medicine.barcode} height={30} />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono-num text-black pt-1 border-t border-black">
        <span>Rack: {medicine.rackLocation}</span>
        <span>
          {batch ? `B:${batch.batchNumber} Exp:${batch.expiryDate}` : medicine.manufacturer}
        </span>
      </div>
    </div>
  ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Print Medicine Barcode Stickers"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Shelf & Box Barcode Stickers
              </h2>
              <p className="font-urdu text-xs text-slate-500 dark:text-slate-400" dir="rtl">
                دوائی کے اسٹیکر بار کوڈ لیبل پرنٹ کریں
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close barcode label modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{medicine.nameEn}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span className="font-urdu">{medicine.nameUr}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Sticker Copies:
              </label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {[1, 4, 8, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCopies(n)}
                    className={`px-2.5 py-1 text-xs font-mono-num rounded-md transition-colors ${
                      copies === n
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            id="printable-barcode-area"
            className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {labelCards}
          </div>
          {typeof document !== 'undefined' &&
            createPortal(<div id="barcode-print-portal">{labelCards}</div>, document.body)}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              resetBarcodePageRule();
              window.print();
            }}
            className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copies} Barcode Labels</span>
          </button>
        </div>
      </div>
    </div>
  );
};
