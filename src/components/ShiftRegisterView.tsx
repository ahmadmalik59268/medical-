import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  ClipboardList,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import {
  AppLanguageMode,
  CashShift,
  PettyExpense,
  PharmacyProfile,
  PrinterSettings,
  SaleInvoice,
} from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';
import { renderZReportEscPosBlocks } from '../utils/receiptRenderer';
import { applyThermalPageRule, executePrintJob } from '../utils/printService';

interface ShiftRegisterViewProps {
  langMode: AppLanguageMode;
  profile: PharmacyProfile;
  printerSettings: PrinterSettings;
  shift: CashShift;
  invoices: SaleInvoice[];
  expenses: PettyExpense[];
  onAddExpense: (expense: Omit<PettyExpense, 'id' | 'createdAt' | 'recordedBy'>) => void;
  onCloseShift: (actualCashCounted: number) => void;
  onReopenNewShift: (openingFloat: number) => void;
  onOpenZReportShare: () => void;
}

export const ShiftRegisterView: React.FC<ShiftRegisterViewProps> = ({
  langMode,
  profile,
  printerSettings,
  shift,
  invoices,
  expenses,
  onAddExpense,
  onCloseShift,
  onReopenNewShift,
  onOpenZReportShare,
}) => {
  const [expCategory, setExpCategory] = useState<PettyExpense['category']>('Courier & Delivery');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [countedCashInput, setCountedCashInput] = useState('');
  const [newFloatInput, setNewFloatInput] = useState('10000');
  const [showZReportModal, setShowZReportModal] = useState(false);

  useEffect(() => {
    if (!showZReportModal) {
      if (document.body.dataset.printMode === 'thermal') {
        delete document.body.dataset.printMode;
      }
      return;
    }
    document.body.dataset.printMode = 'thermal';
    applyThermalPageRule(printerSettings.paperWidthChars === 32 ? '58mm' : '80mm');
    return () => {
      if (document.body.dataset.printMode === 'thermal') {
        delete document.body.dataset.printMode;
      }
    };
  }, [showZReportModal, printerSettings.paperWidthChars]);

  const shiftStats = useMemo(() => {
    let cashSales = 0;
    let cardSales = 0;
    let mobileWalletSales = 0;
    let khataSales = 0;
    let returnedTotal = 0;

    for (const inv of invoices) {
      if (inv.status === 'returned') {
        returnedTotal += inv.netPayable;
        continue;
      }
      if (inv.paymentMethod === 'cash') cashSales += inv.netPayable;
      else if (inv.paymentMethod === 'card') cardSales += inv.netPayable;
      else if (inv.paymentMethod === 'easypaisa_jazzcash') mobileWalletSales += inv.netPayable;
      else if (inv.paymentMethod === 'khata') khataSales += inv.netPayable;
    }

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const expectedCashInDrawer = Math.max(
      0,
      shift.openingFloat + cashSales - totalExpenses
    );

    return {
      cashSales,
      cardSales,
      mobileWalletSales,
      khataSales,
      returnedTotal,
      totalExpenses,
      expectedCashInDrawer,
      grandTotalSales: cashSales + cardSales + mobileWalletSales + khataSales,
    };
  }, [invoices, expenses, shift.openingFloat]);

  // Controlled / Rx Dispensing Log
  const rxRecords = useMemo(() => {
    const rows: Array<{
      invoiceNumber: string;
      date: string;
      patientName: string;
      doctorName: string;
      rxNumber: string;
      medicineName: string;
      batchNumber: string;
      qtyUnits: number;
    }> = [];

    for (const inv of invoices) {
      if (inv.status === 'returned') continue;
      for (const item of inv.items) {
        if (item.requiresPrescription || inv.doctorName || inv.rxNumber) {
          rows.push({
            invoiceNumber: inv.invoiceNumber,
            date: inv.createdAt,
            patientName: inv.customerName || 'Walk-in Patient',
            doctorName: inv.doctorName || 'Verbal / Counter Rx',
            rxNumber: inv.rxNumber || '—',
            medicineName: item.nameEn,
            batchNumber: item.batchNumber,
            qtyUnits: item.unitsDeducted,
          });
        }
      }
    }
    return rows;
  }, [invoices]);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(expAmount));
    if (!expDesc.trim() || amt <= 0) return;
    onAddExpense({
      category: expCategory,
      description: expDesc.trim(),
      amount: amt,
    });
    setExpDesc('');
    setExpAmount('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            {langMode === 'ur'
              ? 'کیش رجسٹر شفٹ، اخراجات اور نسخہ ریکارڈ'
              : 'Cash Register Shift, Petty Expenses & Rx Log'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track drawer float, counter cash vs. digital payments, petty expenses, Z-Report closing, and DRAP Rx dispensing log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenZReportShare}
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>{langMode === 'ur' ? 'واٹس ایپ / پی ڈی ایف' : 'WhatsApp / PDF Z-Report'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowZReportModal(true)}
            className="h-11 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Preview 80mm Z-Report</span>
          </button>
        </div>
      </div>

      {/* Cash Drawer KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Opening Cash Float</div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {formatPKR(shift.openingFloat)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Cash + Digital Sales</div>
          <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
            {formatPKR(shiftStats.grandTotalSales)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Petty Cash Expenses</div>
          <div className="font-mono-num font-bold text-2xl text-amber-600 dark:text-amber-400 mt-1">
            {formatPKR(shiftStats.totalExpenses)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Expected Cash in Drawer</div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {formatPKR(shiftStats.expectedCashInDrawer)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Shift Close/Open & Petty Expenses */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <h2 className="font-display font-semibold text-base">
                  Shift Status: {shift.status === 'open' ? 'Active Open Shift' : 'Shift Closed'}
                </h2>
              </div>
              <span className="font-mono-num text-xs text-slate-500">
                Opened {new Date(shift.openedAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Cash Sales:</span>
                <span className="font-mono-num font-semibold">{formatPKR(shiftStats.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Card Sales:</span>
                <span className="font-mono-num font-semibold">{formatPKR(shiftStats.cardSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Easypaisa / Jazz:</span>
                <span className="font-mono-num font-semibold">{formatPKR(shiftStats.mobileWalletSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khata Credit:</span>
                <span className="font-mono-num font-semibold">{formatPKR(shiftStats.khataSales)}</span>
              </div>
            </div>

            {shift.status === 'open' ? (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <input
                  type="number"
                  min={0}
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  placeholder={`Counted Cash (Exp: ${shiftStats.expectedCashInDrawer})`}
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val =
                      countedCashInput.trim() === ''
                        ? shiftStats.expectedCashInDrawer
                        : Math.max(0, Number(countedCashInput));
                    onCloseShift(val);
                    setShowZReportModal(true);
                  }}
                  className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Shift & Print Z-Report</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <input
                  type="number"
                  min={0}
                  value={newFloatInput}
                  onChange={(e) => setNewFloatInput(e.target.value)}
                  placeholder="Opening Float (Rs.)"
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-sm"
                />
                <button
                  type="button"
                  onClick={() => onReopenNewShift(Math.max(0, Number(newFloatInput)))}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Start New Shift</span>
                </button>
              </div>
            )}
          </div>

          {/* Petty Cash Expenses */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display font-semibold text-base">
              Petty Cash Expenses (دکان کے اخراجات)
            </h2>
            <form onSubmit={handleAddExpenseSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as PettyExpense['category'])}
                className="sm:col-span-4 h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              >
                <option value="Courier & Delivery">Courier / Rider</option>
                <option value="Utilities">Electricity / Generator</option>
                <option value="Tea & Hospitality">Tea / Staff</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Other">Other</option>
              </select>
              <input
                required
                type="text"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Description..."
                className="sm:col-span-5 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              />
              <div className="sm:col-span-3 flex gap-1.5">
                <input
                  required
                  type="number"
                  min={1}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Rs."
                  className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-xs"
                />
                <button
                  type="submit"
                  className="h-10 w-10 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center"
                  aria-label="Add expense"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {exp.description}
                    </div>
                    <div className="text-slate-500">
                      {exp.category} · {new Date(exp.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="font-mono-num font-bold text-rose-600 dark:text-rose-400">
                    -{formatPKR(exp.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: DRAP Prescription (Rx) & Controlled Drug Dispensing Audit Log */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-display font-semibold text-base">
                DRAP Prescription (Rx) Dispensing Register
              </h2>
              <p className="text-xs text-slate-500">
                Audit trail of prescription & antibiotic medicines dispensed by batch.
              </p>
            </div>
          </div>

          {rxRecords.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No prescription-restricted sales recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rxRecords.map((r, i) => (
                <div key={i} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {r.medicineName}
                    </span>
                    <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                      {r.qtyUnits} units · Batch {r.batchNumber}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono-num">
                    {r.invoiceNumber} · Patient: {r.patientName} · {r.doctorName} (Rx: {r.rxNumber})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 80mm Z-Report Modal */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm">80mm Shift Closing Z-Report</h3>
              <button type="button" onClick={() => setShowZReportModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex justify-center">
              {(() => {
                const zReportNode = (
                  <div
                    style={{ width: printerSettings.paperWidthChars === 32 ? '218px' : '302px' }}
                    className="bg-white text-black p-3.5 text-[11px] space-y-2 h-fit"
                  >
                    <div className="text-center pb-2">
                      <div className="inline-flex items-center justify-center gap-1.5 mb-0.5">
                        <span className="w-5 h-5 rounded bg-black text-white font-extrabold text-sm inline-flex items-center justify-center leading-none">
                          +
                        </span>
                        <span className="font-display font-extrabold text-base uppercase text-black">
                          {profile.nameEn}
                        </span>
                      </div>
                      <div className="font-urdu-nastaliq text-sm font-bold text-black" dir="rtl">
                        {profile.nameUr}
                      </div>
                      <div className="bg-black text-white py-1 px-2 mt-1.5 font-bold text-[10px] tracking-wider uppercase rounded-xs">
                        SHIFT Z-REPORT / کیش سمری
                      </div>
                      <div className="font-mono-num text-[9.5px] text-black mt-1">
                        {new Date().toLocaleString('en-PK')}
                      </div>
                    </div>

                    <div className="space-y-1 border-t border-b border-dashed border-black py-2 text-[10.5px]">
                      <div className="flex justify-between">
                        <span>Pharmacist:</span>
                        <span className="font-semibold">{shift.openedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Opening Float:</span>
                        <span className="font-mono-num">{formatPKR(shift.openingFloat)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cash Sales:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.cashSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Card Sales:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.cardSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Easypaisa/JazzCash:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.mobileWalletSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Khata Credit Sales:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.khataSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Petty Cash Expenses:</span>
                        <span className="font-mono-num">-{formatPKR(shiftStats.totalExpenses)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 font-bold text-xs">
                      <div className="flex justify-between">
                        <span>Total Revenue:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.grandTotalSales)}</span>
                      </div>
                      <div className="p-1.5 border-2 border-black rounded-xs flex justify-between items-center font-extrabold">
                        <span>Expected Cash Drawer:</span>
                        <span className="font-mono-num">{formatPKR(shiftStats.expectedCashInDrawer)}</span>
                      </div>
                      {typeof shift.actualClosingCash === 'number' && (
                        <div className="flex justify-between text-[11px]">
                          <span>Actual Counted Cash:</span>
                          <span className="font-mono-num">{formatPKR(shift.actualClosingCash)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );

                return (
                  <>
                    <div
                      id="printable-thermal-area"
                      className="rounded shadow border border-slate-300 bg-white h-fit"
                    >
                      {zReportNode}
                    </div>
                    {typeof document !== 'undefined' &&
                      createPortal(
                        <div id="thermal-print-portal">{zReportNode}</div>,
                        document.body
                      )}
                  </>
                );
              })()}
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowZReportModal(false);
                  onOpenZReportShare();
                }}
                className="h-10 px-3.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp / PDF</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowZReportModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executePrintJob(printerSettings, (w) =>
                      renderZReportEscPosBlocks(
                        profile,
                        {
                          openedBy: shift.openedBy,
                          openingFloat: shift.openingFloat,
                          cashSales: shiftStats.cashSales,
                          cardSales: shiftStats.cardSales,
                          mobileWalletSales: shiftStats.mobileWalletSales,
                          khataSales: shiftStats.khataSales,
                          totalExpenses: shiftStats.totalExpenses,
                          grandTotalSales: shiftStats.grandTotalSales,
                          expectedCashInDrawer: shiftStats.expectedCashInDrawer,
                          actualClosingCash: shift.actualClosingCash,
                        },
                        w
                      )
                    );
                  }}
                  className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Z-Report ({printerSettings.paperWidthChars === 32 ? '58mm' : '80mm'})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
