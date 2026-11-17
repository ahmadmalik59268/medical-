import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileDown,
  FileSpreadsheet,
  MessageCircle,
  Printer,
  Save,
  Settings,
  Share2,
} from 'lucide-react';
import {
  AppLanguageMode,
  Medicine,
  MedicineBatch,
  PettyExpense,
  PharmacyProfile,
  PrinterSettings,
  SaleInvoice,
} from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';
import { InvoicesView } from './InvoicesView';
import { getTotalSellableUnits } from '../utils/fefo';
import { PharmacyReportType } from '../utils/reportGenerator';

interface ReportsSettingsViewProps {
  langMode: AppLanguageMode;
  profile: PharmacyProfile;
  printerSettings: PrinterSettings;
  medicines: Medicine[];
  batches: MedicineBatch[];
  invoices: SaleInvoice[];
  expenses: PettyExpense[];
  onReprintInvoice: (invoice: SaleInvoice) => void;
  onReturnInvoice: (invoiceId: string) => void;
  onSaveProfile: (profile: PharmacyProfile) => void;
  onOpenPrinterSetup: () => void;
  onOpenReportShare: (reportType: PharmacyReportType) => void;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csvContent = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ReportsSettingsView: React.FC<ReportsSettingsViewProps> = ({
  langMode,
  profile,
  printerSettings,
  medicines,
  batches,
  invoices,
  expenses,
  onReprintInvoice,
  onReturnInvoice,
  onSaveProfile,
  onOpenPrinterSetup,
  onOpenReportShare,
}) => {
  const [subTab, setSubTab] = useState<'invoices' | 'analytics' | 'settings'>('invoices');
  const [draftProfile, setDraftProfile] = useState<PharmacyProfile>(profile);
  const [savedNotice, setSavedNotice] = useState(false);

  const analytics = useMemo(() => {
    let grossRevenue = 0;
    let totalCost = 0;
    let totalTax = 0;
    const medRankMap = new Map<string, { nameEn: string; qty: number; revenue: number }>();

    for (const inv of invoices) {
      if (inv.status === 'returned') continue;
      grossRevenue += inv.netPayable;
      totalTax += inv.taxAmount || 0;
      for (const item of inv.items) {
        totalCost += item.costTotal;
        const curr = medRankMap.get(item.medicineId) || {
          nameEn: item.nameEn,
          qty: 0,
          revenue: 0,
        };
        curr.qty += item.quantity;
        curr.revenue += item.lineTotal;
        medRankMap.set(item.medicineId, curr);
      }
    }

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = Math.max(0, grossRevenue - totalCost - totalTax);
    const netProfit = grossProfit - totalExpenses;
    const topMedicines = Array.from(medRankMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      grossRevenue,
      totalCost,
      totalTax,
      totalExpenses,
      grossProfit,
      netProfit,
      topMedicines,
    };
  }, [invoices, expenses]);

  const handleExportInvoicesCsv = () => {
    const header = ['Invoice #', 'Date', 'Customer', 'Payment Method', 'Subtotal', 'Discount', 'Tax', 'Net Payable', 'Status'];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.createdAt,
      inv.customerName || 'Walk-in',
      inv.paymentMethod,
      String(inv.subtotal),
      String(inv.itemDiscounts + inv.extraDiscountRs),
      String(inv.taxAmount || 0),
      String(inv.netPayable),
      inv.status,
    ]);
    downloadCsv('cureplus_invoices_export.csv', [header, ...rows]);
  };

  const handleExportInventoryCsv = () => {
    const header = ['Barcode', 'Medicine EN', 'Medicine UR', 'Salt', 'Rack', 'MRP (PKR)', 'Cost (PKR)', 'Sellable Base Units'];
    const rows = medicines.map((m) => [
      m.barcode,
      m.nameEn,
      m.nameUr,
      m.genericSalt,
      m.rackLocation,
      String(m.mrpPerPack),
      String(m.costPerPack),
      String(getTotalSellableUnits(m.id, batches)),
    ]);
    downloadCsv('cureplus_inventory_export.csv', [header, ...rows]);
  };

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(draftProfile);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab('invoices')}
            className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'invoices'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {langMode === 'ur' ? 'سیلز اور رسیدیں' : 'Invoices & Returns'}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'analytics'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {langMode === 'ur' ? 'منافع اور تجزیہ' : 'Profit & Analytics'}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'settings'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {langMode === 'ur' ? 'فارمیسی سیٹنگز' : 'Store Settings'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenReportShare(subTab === 'analytics' ? 'sales_profit' : 'sales_profit')
            }
            className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>
              {langMode === 'ur'
                ? 'واٹس ایپ / پی ڈی ایف رپورٹ'
                : 'WhatsApp / PDF Reports'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleExportInvoicesCsv}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Invoices CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportInventoryCsv}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Stock CSV</span>
          </button>
        </div>
      </div>

      {subTab === 'invoices' && (
        <InvoicesView
          langMode={langMode}
          invoices={invoices}
          onReprintInvoice={onReprintInvoice}
          onReturnInvoice={onReturnInvoice}
        />
      )}

      {subTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Gross Revenue</div>
              <div className="font-mono-num font-bold text-2xl text-slate-900 dark:text-slate-100 mt-1">
                {formatPKR(analytics.grossRevenue)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">COGS (Cost of Goods)</div>
              <div className="font-mono-num font-bold text-2xl text-slate-700 dark:text-slate-300 mt-1">
                {formatPKR(analytics.totalCost)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Gross Profit</div>
              <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
                {formatPKR(analytics.grossProfit)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Net Profit (After Expenses)</div>
              <div className="font-mono-num font-bold text-2xl text-emerald-700 dark:text-emerald-400 mt-1">
                {formatPKR(analytics.netProfit)}
              </div>
            </div>
          </div>

          {/* Quick 1-Click Report Export Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                Export & Share Pharmacy Reports · رپورٹس پی ڈی ایف اور واٹس ایپ پر بھیجیں
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate Sales & Profit, Stock & Expiry, Supplier Deliveries, or Customer Khata reports in PDF or WhatsApp.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenReportShare('sales_profit')}
                className="h-9 px-3.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Send on WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenReportShare('sales_profit')}
                className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF / Email / Print</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h2 className="font-display font-semibold text-base">Top Selling Medicines by Revenue</h2>
            </div>
            {analytics.topMedicines.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No completed sales data yet.</div>
            ) : (
              <div className="space-y-3">
                {analytics.topMedicines.map((item, idx) => {
                  const maxRev = analytics.topMedicines[0]?.revenue || 1;
                  const pct = Math.max(8, Math.round((item.revenue / maxRev) * 100));
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {idx + 1}. {item.nameEn}
                        </span>
                        <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                          {item.qty} sold · {formatPKR(item.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'settings' && (
        <form
          onSubmit={handleSaveSettingsSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 max-w-3xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              <h2 className="font-display font-semibold text-base">
                Pharmacy Store Identity, DRAP License & Tax Settings
              </h2>
            </div>
            {savedNotice && (
              <span className="text-xs font-semibold text-emerald-600">Settings Saved!</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Brand Name (English)</label>
              <input
                type="text"
                value={draftProfile.nameEn}
                onChange={(e) => setDraftProfile({ ...draftProfile, nameEn: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Urdu Name (اردو نام)</label>
              <input
                type="text"
                dir="rtl"
                value={draftProfile.nameUr}
                onChange={(e) => setDraftProfile({ ...draftProfile, nameUr: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-urdu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">DRAP License #</label>
              <input
                type="text"
                value={draftProfile.drapLicense}
                onChange={(e) => setDraftProfile({ ...draftProfile, drapLicense: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">NTN / Tax #</label>
              <input
                type="text"
                value={draftProfile.ntnNumber}
                onChange={(e) => setDraftProfile({ ...draftProfile, ntnNumber: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Address (English)</label>
              <input
                type="text"
                value={draftProfile.addressEn}
                onChange={(e) => setDraftProfile({ ...draftProfile, addressEn: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Address (Urdu)</label>
              <input
                type="text"
                dir="rtl"
                value={draftProfile.addressUr}
                onChange={(e) => setDraftProfile({ ...draftProfile, addressUr: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-urdu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pharmacist / Cashier Name</label>
              <input
                type="text"
                value={draftProfile.cashierName}
                onChange={(e) => setDraftProfile({ ...draftProfile, cashierName: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Default GST / Tax % (0 for Exempt)</label>
              <input
                type="number"
                min={0}
                max={25}
                step="0.5"
                value={draftProfile.defaultTaxPercent}
                onChange={(e) =>
                  setDraftProfile({ ...draftProfile, defaultTaxPercent: Number(e.target.value) })
                }
                className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Store Settings</span>
            </button>
          </div>
        </form>
      )}

      {subTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Thermal Printer Setup (58mm / 80mm · Bluetooth / USB)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active Printer: <strong className="text-slate-800 dark:text-slate-200">{printerSettings.printerName}</strong> · Paper:{' '}
              <strong className="font-mono-num">
                {printerSettings.paperWidthChars === 32 ? '58 mm (32 cols)' : '80 mm (48 cols)'}
              </strong>{' '}
              · Auto-Print: <strong>{printerSettings.autoPrint ? 'ON' : 'OFF'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPrinterSetup}
            className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Connect / Configure Printer</span>
          </button>
        </div>
      )}
    </div>
  );
};
