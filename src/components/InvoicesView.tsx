import React, { useMemo, useState } from 'react';
import { Printer, RotateCcw, Search } from 'lucide-react';
import { AppLanguageMode, SaleInvoice } from '../types/pharmacy';
import { formatPKR, PAYMENT_LABELS, pickText, UI_COPY, UNIT_LABELS } from '../i18n/translations';

interface InvoicesViewProps {
  langMode: AppLanguageMode;
  invoices: SaleInvoice[];
  onReprintInvoice: (invoice: SaleInvoice) => void;
  onReturnInvoice: (invoiceId: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  langMode,
  invoices,
  onReprintInvoice,
  onReturnInvoice,
}) => {
  const [search, setSearch] = useState('');

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let completedCount = 0;
    let returnedCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'completed') {
        completedCount++;
        totalRevenue += inv.netPayable;
        totalCost += inv.items.reduce((s, i) => s + i.costTotal, 0);
      } else {
        returnedCount++;
      }
    }

    return {
      totalRevenue,
      estProfit: Math.max(0, totalRevenue - totalCost),
      completedCount,
      returnedCount,
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
          {pickText(UI_COPY.invoices.title, langMode)}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Reprint 80mm bilingual receipts or process customer returns with automatic batch stock restoration.
        </p>
      </div>

      {/* Shift KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.invoices.todaySales, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
            {formatPKR(summary.totalRevenue)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.invoices.estProfit, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {formatPKR(summary.estProfit)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.invoices.invoiceCount, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
            {summary.completedCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {pickText(UI_COPY.invoices.returnsTotal, langMode)}
          </div>
          <div className="font-mono-num font-bold text-2xl text-rose-600 dark:text-rose-400 mt-1">
            {summary.returnedCount}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice # (CP-2026-...), patient name, or phone..."
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
        />
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
            No invoices found.
          </div>
        ) : (
          filtered.map((inv) => {
            const dt = new Date(inv.createdAt).toLocaleString('en-PK', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={inv.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 space-y-3 ${
                  inv.status === 'returned'
                    ? 'border-rose-200 dark:border-rose-900/60 opacity-80'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                        {dt}
                      </span>
                      {inv.status === 'returned' && (
                        <>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                            {pickText(UI_COPY.invoices.returned, langMode)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {inv.customerName || 'Walk-in Customer'}
                      {inv.customerPhone ? ` · ${inv.customerPhone}` : ''}
                      {' · '}
                      {PAYMENT_LABELS[inv.paymentMethod].en}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <div className="font-mono-num font-bold text-base text-emerald-700 dark:text-emerald-400">
                        {formatPKR(inv.netPayable)}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-500">
                        {inv.items.length} items
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onReprintInvoice(inv)}
                      className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{langMode === 'ur' ? UI_COPY.invoices.reprintReceipt.ur : 'Receipt'}</span>
                    </button>
                    {inv.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => onReturnInvoice(inv.id)}
                        className="h-9 px-3 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{langMode === 'ur' ? UI_COPY.invoices.returnSale.ur : 'Return'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Itemized Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {inv.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {item.nameEn}
                        </span>
                        <span className="text-slate-500 ml-1.5 font-mono-num">
                          ({item.quantity} {UNIT_LABELS[item.saleUnitType].en})
                        </span>
                      </div>
                      <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                        {formatPKR(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
