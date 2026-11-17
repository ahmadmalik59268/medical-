import React from 'react';
import {
  Barcode,
  BookOpen,
  PackagePlus,
  Printer,
  ShoppingCart,
  X,
} from 'lucide-react';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddMedicine: () => void;
  onOpenPrinterSetup: () => void;
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenAddMedicine,
  onOpenPrinterSetup,
}) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: ShoppingCart,
      titleEn: '1. Fast Billing & Checkout (بل بنانا)',
      bodyEn:
        'Type medicine name or scan barcode with USB gun / Camera (F8). Tap "+ Patta" or "+ Add Box", pick Cash/Card/Easypaisa/Khata, then click Complete & Print.',
      bodyUr:
        'دوائی کا نام لکھیں یا بار کوڈ اسکین کریں (F8)۔ "+ پتہ" یا "+ ڈبہ" دبائیں، نقد/کارڈ/کھاتہ منتخب کریں اور پرنٹ نکالیں۔',
    },
    {
      icon: PackagePlus,
      titleEn: '2. Add New Medicine (نئی دوائی اور اسٹاک ڈالنا)',
      bodyEn:
        'Click "+ Add Medicine" directly from POS or Inventory. Enter Name, Box Sale/Cost Price, and number of Boxes received—patta, per-tablet price, and profit calculate automatically.',
      bodyUr:
        'POS یا انوینٹری سے "+ Add Medicine" دبائیں۔ نام، ڈبی کی قیمت اور کتنی ڈبیاں آئیں درج کریں — پتہ، گولی اور منافع خودکار نکل آئے گا۔',
    },
    {
      icon: Printer,
      titleEn: '3. Connect 58mm / 80mm Printer (پرنٹر جوڑنا)',
      bodyEn:
        'Click "Printer (80mm)" in the top bar anytime to select 58mm or 80mm roll, connect your USB or Bluetooth printer, and turn Auto-Print ON.',
      bodyUr:
        'اوپر بار میں "Printer (80mm)" بٹن دبا کر 58mm یا 80mm پیپر چنیں اور USB یا Bluetooth پرنٹر کنیکٹ کریں۔',
    },
    {
      icon: Barcode,
      titleEn: '4. Keyboard & USB Gun Shortcuts (شارٹ کٹس)',
      bodyEn:
        'Press F2 to jump straight to Medicine Search. Press F8 to open Camera Scanner. Any USB barcode gun scans directly into the bill without clicking.',
      bodyUr:
        'F2 دبانے سے سرچ کھلتا ہے، F8 سے کیمرہ اسکینر۔ USB بار کوڈ گن بغیر کلک کیے خودکار بل میں دوائی شامل کرتی ہے۔',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Easy Pharmacy Guide"
    >
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Quick Easy Guide · آسان استعمال گائیڈ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Everything anyone needs to run CurePlus Pharmacy POS in 60 seconds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.titleEn}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {step.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {step.bodyEn}
                  </p>
                  <p className="font-urdu text-xs text-slate-700 dark:text-slate-300" dir="rtl">
                    {step.bodyUr}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddMedicine();
              }}
              className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <PackagePlus className="w-4 h-4" />
              <span>+ Add New Medicine</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPrinterSetup();
              }}
              className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Connect Printer</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
