import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  FileDown,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import {
  buildMailtoUrl,
  buildStructuredReport,
  buildWhatsAppUrl,
  generateReportPdf,
  PharmacyReportType,
  ReportSourcePayload,
  triggerBlobDownload,
} from '../utils/reportGenerator';

interface ReportShareModalProps {
  isOpen: boolean;
  initialReportType?: PharmacyReportType;
  sourceData: ReportSourcePayload;
  onClose: () => void;
}

const REPORT_TABS: Array<{ id: PharmacyReportType; labelEn: string; labelUr: string }> = [
  { id: 'sales_profit', labelEn: 'Sales & Profit', labelUr: 'سیلز اور منافع' },
  { id: 'shift_zreport', labelEn: 'Shift Z-Report', labelUr: 'کیش شفٹ رپورٹ' },
  { id: 'inventory_expiry', labelEn: 'Stock & Expiry', labelUr: 'اسٹاک اور ایکسپائری' },
  { id: 'suppliers_khata', labelEn: 'Suppliers & Goods', labelUr: 'سپلائر اور مال' },
  { id: 'customer_khata', labelEn: 'Customer Khata', labelUr: 'کسٹمر کھاتہ' },
];

export const ReportShareModal: React.FC<ReportShareModalProps> = ({
  isOpen,
  initialReportType = 'sales_profit',
  sourceData,
  onClose,
}) => {
  const [reportType, setReportType] = useState<PharmacyReportType>(initialReportType);
  const [waPhone, setWaPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReportType(initialReportType);
      setStatusNotice(null);
      setCopied(false);
    }
  }, [isOpen, initialReportType]);

  // Manage A4 report print portal mode cleanly
  useEffect(() => {
    if (!isOpen) {
      if (document.body.dataset.printMode === 'report') {
        delete document.body.dataset.printMode;
      }
      return;
    }
    document.body.dataset.printMode = 'report';
    return () => {
      if (document.body.dataset.printMode === 'report') {
        delete document.body.dataset.printMode;
      }
    };
  }, [isOpen]);

  const report = useMemo(
    () => buildStructuredReport(reportType, sourceData),
    [reportType, sourceData]
  );

  if (!isOpen) return null;

  const waUrl = buildWhatsAppUrl(report.whatsappText, waPhone);
  const mailUrl = buildMailtoUrl(report.emailSubject, report.whatsappText);

  const handleDownloadPdf = () => {
    const { blob, filename } = generateReportPdf(report, sourceData.profile);
    triggerBlobDownload(blob, filename);
    setStatusNotice(`PDF downloaded: ${filename}`);
  };

  const handleSharePdf = async () => {
    const { blob, file, filename } = generateReportPdf(report, sourceData.profile);
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };

    if (typeof nav.share === 'function') {
      try {
        if (!nav.canShare || nav.canShare({ files: [file] })) {
          await nav.share({
            title: report.title,
            text: `${sourceData.profile.nameEn} — ${report.title}`,
            files: [file],
          });
          setStatusNotice(`Shared PDF (${filename}) via device share sheet!`);
          return;
        }
      } catch (err) {
        // If user cancelled native share, don't force download
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback when desktop browser does not support File Web Share: download PDF directly
    triggerBlobDownload(blob, filename);
    setStatusNotice(
      `PDF (${filename}) downloaded! Attach this file directly in WhatsApp or Email.`
    );
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(report.whatsappText);
      setCopied(true);
      setStatusNotice('Formatted report summary copied to clipboard!');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setStatusNotice('Copy permission unavailable in this browser.');
    }
  };

  const handleDownloadCsv = () => {
    const csvRows = [report.columns, ...report.rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, `${report.filenameBase}.csv`);
    setStatusNotice(`CSV downloaded: ${report.filenameBase}.csv`);
  };

  const handlePrintA4 = () => {
    // Ensure @page is standard A4 without thermal 80mm override
    const existingThermalStyle = document.getElementById('cureplus-dynamic-page-rule');
    if (existingThermalStyle) existingThermalStyle.textContent = '@page { size: A4; margin: 10mm; }';
    document.body.dataset.printMode = 'report';
    window.print();
  };

  const printableReportNode = (
    <div className="bg-white text-black space-y-4 font-sans text-xs">
      <div className="border-b-2 border-black pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-bold text-lg">{sourceData.profile.nameEn}</h1>
          <p className="text-xs">{sourceData.profile.addressEn} · {sourceData.profile.phone}</p>
          <p className="text-[11px] font-mono-num">
            DRAP: {sourceData.profile.drapLicense} · NTN: {sourceData.profile.ntnNumber}
          </p>
        </div>
        <div className="text-right">
          <div className="font-bold text-sm uppercase">{report.title}</div>
          <div className="text-[11px] font-mono-num">Generated: {report.generatedAt}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {report.kpis.map((k, i) => (
          <div key={i} className="border border-black p-2 rounded-xs">
            <div className="text-[10px] uppercase">{k.label}</div>
            <div className="font-mono-num font-bold text-sm mt-0.5">{k.value}</div>
          </div>
        ))}
      </div>

      <table className="w-full border-collapse border border-black text-[11px]">
        <thead>
          <tr className="bg-slate-200">
            {report.columns.map((col, idx) => (
              <th key={idx} className="border border-black px-2 py-1.5 text-left font-bold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="border border-black px-2 py-1 font-mono-num">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Reports Export & Sharing Center · رپورٹس پی ڈی ایف اور واٹس ایپ شیئرنگ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send any pharmacy report directly on WhatsApp, download/share as PDF, Email, CSV, or Print A4.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Report Type Selector */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              {REPORT_TABS.map((tab) => {
                const active = reportType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setReportType(tab.id);
                      setStatusNotice(null);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.labelEn}</span>
                    <span className="font-urdu text-[11px] ml-1.5 opacity-80">({tab.labelUr})</span>
                  </button>
                );
              })}
            </div>

            {/* KPI Summary Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {report.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-[11px] text-slate-500">{kpi.label}</div>
                  <div className="font-mono-num font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* WhatsApp Target Number + Primary Share Buttons */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    WhatsApp Number (Optional) · واٹس ایپ نمبر (اختیاری)
                  </label>
                  <input
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="0300-1234567 (leave blank to pick contact inside WhatsApp)"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-num text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send on WhatsApp · واٹس ایپ</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleSharePdf}
                    className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share PDF File · پی ڈی ایف شیئر</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Tip: On mobile/Android, <strong>Share PDF File</strong> attaches the actual <code>.pdf</code> directly into WhatsApp, Gmail, or Drive. On desktop, <strong>Send on WhatsApp</strong> sends the full report summary text, or click <strong>Download PDF</strong> and attach the PDF file.
              </div>
            </div>

            {/* Other Ways (PDF Download, Copy, Email, CSV, Print A4) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5"
              >
                <FileDown className="w-4 h-4 text-rose-600" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <a
                href={mailUrl}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                <Mail className="w-4 h-4 text-sky-600" />
                <span>Email Report</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel / CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrintA4}
                className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4</span>
              </button>
            </div>

            {statusNotice && (
              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Download className="w-4 h-4 shrink-0" />
                <span>{statusNotice}</span>
              </div>
            )}

            {/* Live Preview of Report Text & Rows */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5 space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  WhatsApp / Message Preview
                </div>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono-num whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-56 overflow-y-auto">
                  {report.whatsappText}
                </pre>
              </div>

              <div className="lg:col-span-7 space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  PDF Table Preview ({report.rows.length} rows)
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        {report.columns.map((col, idx) => (
                          <th key={idx} className="px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-400">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.rows.slice(0, 12).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1.5 font-mono-num text-slate-800 dark:text-slate-200">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(<div id="report-print-portal">{printableReportNode}</div>, document.body)}
    </>
  );
};
