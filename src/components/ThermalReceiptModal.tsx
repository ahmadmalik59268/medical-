import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bluetooth,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  TriangleAlert,
  Usb,
  X,
} from 'lucide-react';
import {
  PharmacyProfile,
  PrinterSettings,
  PrintJobStatus,
  SaleInvoice,
} from '../types/pharmacy';
import { formatPKR, PAYMENT_LABELS, UNIT_LABELS } from '../i18n/translations';
import { BarcodeSvg } from './BarcodeSvg';
import { renderInvoiceEscPosBlocks, renderInvoiceMonospace } from '../utils/receiptRenderer';
import {
  applyThermalPageRule,
  executePrintJob,
  getPairedSerialPrinters,
  isWebBluetoothSupported,
  isWebSerialSupported,
  pairSerialPrinter,
  PrintResult,
} from '../utils/printService';

interface ThermalReceiptModalProps {
  invoice: SaleInvoice | null;
  profile: PharmacyProfile;
  printerSettings: PrinterSettings;
  printStatus: PrintJobStatus;
  onUpdatePrinterSettings: (next: PrinterSettings) => void;
  onPrintStatusChange: (status: PrintJobStatus) => void;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  invoice,
  profile,
  printerSettings,
  printStatus,
  onUpdatePrinterSettings,
  onPrintStatusChange,
  onClose,
}) => {
  const [pairedPorts, setPairedPorts] = useState<Array<{ label: string; index: number }>>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastResult, setLastResult] = useState<PrintResult | null>(null);

  // Re-read paired printers every time the Print Sheet opens & configure portal print mode
  useEffect(() => {
    if (!invoice) {
      setLastResult(null);
      if (document.body.dataset.printMode === 'thermal') {
        delete document.body.dataset.printMode;
      }
      return;
    }
    document.body.dataset.printMode = 'thermal';
    applyThermalPageRule(printerSettings.paperWidthChars === 32 ? '58mm' : '80mm');
    getPairedSerialPrinters().then(setPairedPorts).catch(() => setPairedPorts([]));

    return () => {
      if (document.body.dataset.printMode === 'thermal') {
        delete document.body.dataset.printMode;
      }
    };
  }, [invoice, printerSettings.paperWidthChars]);

  const monospacePreview = useMemo(() => {
    if (!invoice) return '';
    return renderInvoiceMonospace(invoice, profile, printerSettings.paperWidthChars);
  }, [invoice, profile, printerSettings.paperWidthChars]);

  if (!invoice) return null;

  const is58mm = printerSettings.paperWidthChars === 32;
  const formattedDate = new Date(invoice.createdAt).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const totalQty = invoice.items.reduce((s, i) => s + i.quantity, 0);
  const totalSavings = invoice.itemDiscounts + invoice.extraDiscountRs;

  const handleRefreshPorts = async () => {
    const ports = await getPairedSerialPrinters();
    setPairedPorts(ports);
  };

  const handlePairSerial = async () => {
    const res = await pairSerialPrinter();
    setLastResult(res);
    if (res.ok && res.printerName) {
      onUpdatePrinterSettings({
        ...printerSettings,
        transport: 'serial',
        printerName: res.printerName,
      });
      await handleRefreshPorts();
    }
  };

  const handlePrintNow = async () => {
    setIsPrinting(true);
    setLastResult(null);
    onPrintStatusChange('printing');

    const res = await executePrintJob(printerSettings, (widthChars) =>
      renderInvoiceEscPosBlocks(invoice, profile, widthChars)
    );

    setIsPrinting(false);
    setLastResult(res);
    onPrintStatusChange(res.ok ? 'done' : 'failed');
    if (res.ok && res.printerName) {
      onUpdatePrinterSettings({
        ...printerSettings,
        printerName: res.printerName,
      });
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([monospacePreview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}_${is58mm ? '58mm' : '80mm'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Thermal Print Sheet"
    >
      <div className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                Print Sheet — {is58mm ? '58 mm (32 cols)' : '80 mm (48 cols)'} Thermal Slip
              </h2>
              <p className="font-urdu text-[11px] text-slate-500 dark:text-slate-400" dir="rtl">
                پرنٹر، پیپر سائز (58mm / 80mm) اور آٹو پرنٹ سیٹنگز محفوظ رہتی ہیں
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close print sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Left Controls / Right Live Paper Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12">
          {/* Left: Printer Picker, Width Chips, Auto-Print */}
          <div className="md:col-span-5 p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 space-y-4">
            {/* Paper Width Chips */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paper Width (Font A Columns)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { width: 32, title: '58 mm', sub: '32 chars/line' },
                    { width: 48, title: '80 mm', sub: '48 chars/line' },
                  ] as const
                ).map((opt) => {
                  const active = printerSettings.paperWidthChars === opt.width;
                  return (
                    <button
                      key={opt.width}
                      type="button"
                      onClick={() =>
                        onUpdatePrinterSettings({ ...printerSettings, paperWidthChars: opt.width })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-colors ${
                        active
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-mono-num font-bold text-xs flex items-center justify-between">
                        <span>{opt.title}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Receipt Style Toggle */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Receipt Layout Format
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePrinterSettings({ ...printerSettings, receiptFormat: 'bilingual_rich' })
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                    printerSettings.receiptFormat === 'bilingual_rich'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Bilingual EN + اردو
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePrinterSettings({ ...printerSettings, receiptFormat: 'escpos_mono' })
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                    printerSettings.receiptFormat === 'escpos_mono'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ESC/POS {printerSettings.paperWidthChars}-Col
                </button>
              </div>
            </div>

            {/* Printer Connection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Thermal Printer
                </span>
                <button
                  type="button"
                  onClick={handleRefreshPorts}
                  className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {/* 1. System / OS Thermal Driver */}
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      transport: 'browser',
                      printerName: 'System / OS Thermal Driver',
                    })
                  }
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs ${
                    printerSettings.transport === 'browser'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Printer className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">System / Thermal Driver</div>
                      <div className="text-[11px] text-slate-500">
                        Prints Urdu + English on any 58/80mm Windows/Android printer
                      </div>
                    </div>
                  </div>
                  {printerSettings.transport === 'browser' && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </button>

                {/* 2. Paired USB / Bluetooth SPP Serial ESC/POS */}
                {pairedPorts.map((p) => {
                  const active =
                    printerSettings.transport === 'serial' &&
                    printerSettings.printerName === p.label;
                  return (
                    <button
                      key={p.index}
                      type="button"
                      onClick={() =>
                        onUpdatePrinterSettings({
                          ...printerSettings,
                          transport: 'serial',
                          printerName: p.label,
                        })
                      }
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs ${
                        active
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Usb className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.label}</div>
                          <div className="text-[11px] text-slate-500">ESC/POS Raw · CP437</div>
                        </div>
                      </div>
                      {active && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}

                {isWebSerialSupported() && (
                  <button
                    type="button"
                    onClick={handlePairSerial}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>Connect USB / Paired Bluetooth COM Printer</span>
                  </button>
                )}

                {/* 3. Direct BLE Thermal Printer */}
                <button
                  type="button"
                  disabled={!isWebBluetoothSupported()}
                  onClick={() =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      transport: 'bluetooth',
                      printerName:
                        printerSettings.transport === 'bluetooth' && printerSettings.printerName
                          ? printerSettings.printerName
                          : 'BLE Thermal Printer',
                    })
                  }
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs disabled:opacity-45 ${
                    printerSettings.transport === 'bluetooth'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bluetooth className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {printerSettings.transport === 'bluetooth'
                          ? printerSettings.printerName
                          : 'Bluetooth BLE Thermal (ESC/POS)'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isWebBluetoothSupported()
                          ? 'Direct BLE GATT · 12s watchdog'
                          : 'Web Bluetooth unavailable in this browser'}
                      </div>
                    </div>
                  </div>
                  {printerSettings.transport === 'bluetooth' && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Auto-print & Baud rate */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Auto-print after saving bill
                </span>
                <input
                  type="checkbox"
                  checked={printerSettings.autoPrint}
                  onChange={(e) =>
                    onUpdatePrinterSettings({ ...printerSettings, autoPrint: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Last Print Status:</span>
                <span className="font-mono-num font-semibold uppercase">{printStatus}</span>
              </div>
            </div>

            {/* Actionable Result Banner */}
            {lastResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  lastResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                {lastResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{lastResult.message}</span>
              </div>
            )}
          </div>

          {/* Right: Live 58mm / 80mm Paper Preview */}
          <div className="md:col-span-7 p-5 bg-slate-100 dark:bg-slate-950 flex justify-center overflow-y-auto">
            {(() => {
              const receiptPaperNode =
                printerSettings.receiptFormat === 'escpos_mono' ? (
                  <div
                    style={{ width: is58mm ? '230px' : '320px' }}
                    className="bg-white text-black p-3.5 h-fit"
                  >
                    <pre
                      className={`font-mono-num whitespace-pre leading-[1.35] text-black ${
                        is58mm ? 'text-[10px]' : 'text-[10.5px]'
                      }`}
                    >
                      {monospacePreview}
                    </pre>
                  </div>
                ) : (
                  <div
                    style={{ width: is58mm ? '218px' : '302px' }}
                    className={`bg-white text-black p-3 leading-snug h-fit ${
                      is58mm ? 'text-[10px]' : 'text-[11px]'
                    }`}
                  >
                    {/* 1. Flagship Pharmacy Brand & Regulatory Header */}
                    <div className="text-center pb-2">
                      <div className="inline-flex items-center justify-center gap-1.5 mb-0.5">
                        <span className="w-5 h-5 rounded bg-black text-white font-extrabold text-sm inline-flex items-center justify-center leading-none">
                          +
                        </span>
                        <span className="font-display font-extrabold text-[15px] tracking-tight uppercase text-black">
                          {profile.nameEn}
                        </span>
                      </div>
                      <div
                        className="font-urdu-nastaliq text-[13px] font-bold text-black leading-relaxed"
                        dir="rtl"
                      >
                        {profile.nameUr}
                      </div>
                      <div className="text-[9.5px] font-medium text-black mt-0.5">
                        {profile.addressEn}
                      </div>
                      <div className="font-urdu text-[9.5px] text-black" dir="rtl">
                        {profile.addressUr}
                      </div>
                      <div className="font-mono-num text-[9px] font-semibold text-black mt-1">
                        Tel: {profile.phone}
                      </div>
                      <div className="font-mono-num text-[8.5px] text-black">
                        {profile.drapLicense}
                        {profile.ntnNumber ? ` · NTN: ${profile.ntnNumber}` : ''}
                      </div>
                    </div>

                    {/* Inverted High-Contrast Invoice Banner */}
                    <div className="bg-black text-white text-center py-1 px-2 font-bold tracking-wider uppercase text-[10px] rounded-xs">
                      {invoice.status === 'returned'
                        ? 'SALES RETURN / واپسی رسید'
                        : 'SALES INVOICE / سیلز انوائس'}
                    </div>

                    {/* 2. Metadata Grid */}
                    <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[9.5px]">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">Inv #:</span>
                        <span className="font-mono-num font-bold">{invoice.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Date:</span>
                        <span className="font-mono-num">{formattedDate}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Patient:</span>
                        <span className="font-semibold truncate max-w-[155px] text-right">
                          {invoice.customerName || 'Walk-in Patient'}
                        </span>
                      </div>
                      {invoice.customerPhone && (
                        <div className="flex justify-between gap-2">
                          <span>Phone:</span>
                          <span className="font-mono-num">{invoice.customerPhone}</span>
                        </div>
                      )}
                      {invoice.doctorName && (
                        <div className="flex justify-between gap-2">
                          <span>Doctor:</span>
                          <span className="truncate max-w-[155px] text-right">
                            {invoice.doctorName}
                            {invoice.rxNumber ? ` (${invoice.rxNumber})` : ''}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <span>Cashier:</span>
                        <span className="truncate max-w-[155px] text-right">
                          {invoice.cashierName.split('(')[0].trim()}
                        </span>
                      </div>
                    </div>

                    {/* 3. Itemized Pharmacy Table */}
                    <div className="flex justify-between items-center py-1 border-b border-black font-bold text-[9px] uppercase tracking-wide">
                      <span>Medicine / Qty × Rate</span>
                      <span>Amount</span>
                    </div>

                    <div className="divide-y divide-dotted divide-black border-b border-dashed border-black">
                      {invoice.items.map((item, idx) => (
                        <div key={idx} className="py-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-[10.5px] text-black leading-tight">
                              {idx + 1}. {item.nameEn}
                              {item.requiresPrescription ? ' [Rx]' : ''}
                            </span>
                          </div>
                          <div className="font-urdu text-[9.5px] text-black leading-snug" dir="rtl">
                            {item.nameUr}
                          </div>
                          <div className="flex justify-between items-baseline text-[10px] font-mono-num mt-0.5">
                            <span>
                              {item.quantity} {UNIT_LABELS[item.saleUnitType].en} × Rs.{item.unitPrice}
                              {item.discountPercent > 0 ? ` (-${item.discountPercent}%)` : ''}
                            </span>
                            <span className="font-bold text-[10.5px]">
                              {formatPKR(item.lineTotal)}
                            </span>
                          </div>
                          <div className="text-[8.5px] font-mono-num text-black">
                            Batch: {item.batchNumber} · Exp: {item.expiryDate}
                          </div>
                          {item.dosageLabel && (
                            <div
                              className="mt-1 px-1.5 py-0.5 border border-black rounded-xs text-[9px] font-medium text-black font-urdu"
                              dir="rtl"
                            >
                              خوراک: {item.dosageLabel}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 4. Totals & Net Payable Box */}
                    <div className="py-2 space-y-1 text-[10px]">
                      <div className="flex justify-between text-[9.5px]">
                        <span>Items / Units:</span>
                        <span className="font-mono-num font-semibold">
                          {invoice.items.length} ({totalQty} qty)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gross Subtotal:</span>
                        <span className="font-mono-num">{formatPKR(invoice.subtotal)}</span>
                      </div>
                      {totalSavings > 0 && (
                        <div className="flex justify-between font-semibold">
                          <span>Discount / بچت:</span>
                          <span className="font-mono-num">-{formatPKR(totalSavings)}</span>
                        </div>
                      )}
                      {invoice.taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span>GST ({invoice.taxPercent}%):</span>
                          <span className="font-mono-num">{formatPKR(invoice.taxAmount)}</span>
                        </div>
                      )}

                      <div className="my-1.5 p-1.5 border-2 border-black rounded-xs flex justify-between items-center font-extrabold text-[12px]">
                        <span>NET PAYABLE / کل رقم</span>
                        <span className="font-mono-num text-[13px]">
                          {formatPKR(invoice.netPayable)}
                        </span>
                      </div>

                      <div className="flex justify-between font-semibold">
                        <span>Payment Mode:</span>
                        <span>{PAYMENT_LABELS[invoice.paymentMethod].en}</span>
                      </div>
                      {invoice.paymentMethod === 'cash' && (
                        <>
                          <div className="flex justify-between">
                            <span>Cash Tendered:</span>
                            <span className="font-mono-num">{formatPKR(invoice.cashTendered)}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Change Returned / بقایا:</span>
                            <span className="font-mono-num">{formatPKR(invoice.changeDue)}</span>
                          </div>
                        </>
                      )}
                      {invoice.paymentMethod === 'khata' && (
                        <div className="text-center font-bold border border-black py-0.5 text-[9.5px]">
                          CHARGED TO PATIENT KHATA
                        </div>
                      )}
                    </div>

                    {/* 5. Scannable Return Barcode & Bilingual Return Policy */}
                    <div className="pt-2 border-t border-dashed border-black flex flex-col items-center text-center">
                      <BarcodeSvg value={invoice.invoiceNumber} height={28} />
                      <div className="mt-1.5 p-1.5 border border-black rounded-xs w-full text-center space-y-0.5">
                        <div className="font-bold text-[8.5px] uppercase tracking-wider">
                          Return & Exchange Policy · واپسی کی شرائط
                        </div>
                        <p className="text-[8px] leading-tight">
                          Exchange within 7 days with original bill & intact seal. Fridge/cold-chain & single-piece medicines non-returnable.
                        </p>
                        <p className="font-urdu text-[8.5px] leading-snug" dir="rtl">
                          اصل بل اور صحیح پیکنگ کے ساتھ 7 دن میں تبدیلی ممکن ہے۔ فریج والی اور سنگل پیس دوائیاں واپس نہیں ہوں گی۔
                        </p>
                      </div>
                      <p className="text-[9px] font-bold mt-2">{profile.receiptFooterEn}</p>
                      <p className="font-urdu text-[9.5px] font-semibold mt-0.5" dir="rtl">
                        {profile.receiptFooterUr}
                      </p>
                      <div className="w-full border-t border-dotted border-black mt-2 pt-1 text-[8px] font-mono-num">
                        --- Thank You · Get Well Soon ---
                      </div>
                    </div>
                  </div>
                );

              return (
                <>
                  <div
                    id="printable-thermal-area"
                    className="rounded shadow-md border border-slate-300 bg-white h-fit"
                  >
                    {receiptPaperNode}
                  </div>
                  {typeof document !== 'undefined' &&
                    createPortal(
                      <div id="thermal-print-portal">{receiptPaperNode}</div>,
                      document.body
                    )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {is58mm ? '58mm' : '80mm'} .TXT</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrintNow}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-2"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? 'Printing...' : `Print (${is58mm ? '58mm' : '80mm'})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
