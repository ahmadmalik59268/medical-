import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CashShift,
  CustomerProfile,
  Medicine,
  MedicineBatch,
  PettyExpense,
  PharmacyProfile,
  PurchaseOrder,
  SaleInvoice,
  Supplier,
  SupplierTransaction,
} from '../types/pharmacy';
import { formatPKR } from '../i18n/translations';
import { daysUntilDate, formatStockReadable, getTotalSellableUnits } from './fefo';

export type PharmacyReportType =
  | 'sales_profit'
  | 'shift_zreport'
  | 'inventory_expiry'
  | 'suppliers_khata'
  | 'customer_khata';

export interface StructuredReportData {
  type: PharmacyReportType;
  title: string;
  subtitle: string;
  filenameBase: string;
  generatedAt: string;
  kpis: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
  whatsappText: string;
  emailSubject: string;
}

export interface ReportSourcePayload {
  profile: PharmacyProfile;
  medicines: Medicine[];
  batches: MedicineBatch[];
  invoices: SaleInvoice[];
  expenses: PettyExpense[];
  shift: CashShift;
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  purchaseOrders: PurchaseOrder[];
  customers: CustomerProfile[];
}

export function normalizePakistanPhoneForWa(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `92${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(text: string, rawPhone?: string): string {
  const cleanPhone = normalizePakistanPhoneForWa(rawPhone);
  const encoded = encodeURIComponent(text);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildMailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildStructuredReport(
  type: PharmacyReportType,
  src: ReportSourcePayload
): StructuredReportData {
  const nowStr = new Date().toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateTag = new Date().toISOString().slice(0, 10);

  if (type === 'sales_profit') {
    const completed = src.invoices.filter((i) => i.status !== 'returned');
    const returned = src.invoices.filter((i) => i.status === 'returned');
    let revenue = 0;
    let cost = 0;
    let tax = 0;
    let discountTotal = 0;

    for (const inv of completed) {
      revenue += inv.netPayable;
      tax += inv.taxAmount || 0;
      discountTotal += (inv.itemDiscounts || 0) + (inv.extraDiscountRs || 0);
      for (const item of inv.items) {
        cost += item.costTotal;
      }
    }
    const expensesTotal = src.expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = Math.max(0, revenue - cost - tax);
    const netProfit = grossProfit - expensesTotal;

    const kpis = [
      { label: 'Completed Bills', value: String(completed.length) },
      { label: 'Gross Revenue', value: formatPKR(revenue) },
      { label: 'Gross Profit', value: formatPKR(grossProfit) },
      { label: 'Net Profit (After Expenses)', value: formatPKR(netProfit) },
    ];

    const columns = ['Invoice #', 'Customer', 'Payment', 'Discount', 'Net Bill', 'Status'];
    const rows = src.invoices.map((inv) => [
      inv.invoiceNumber,
      inv.customerName || 'Walk-in',
      inv.paymentMethod.replace('_', '/').toUpperCase(),
      formatPKR((inv.itemDiscounts || 0) + (inv.extraDiscountRs || 0)),
      formatPKR(inv.netPayable),
      inv.status.toUpperCase(),
    ]);

    const whatsappLines = [
      `*${src.profile.nameEn}*`,
      `*Daily Sales & Profit Report*`,
      `Date: ${nowStr}`,
      `DRAP: ${src.profile.drapLicense}`,
      `----------------------------`,
      `Completed Bills: ${completed.length} (Returned: ${returned.length})`,
      `Total Revenue: ${formatPKR(revenue)}`,
      `Discounts Given: ${formatPKR(discountTotal)}`,
      `Cost of Goods (COGS): ${formatPKR(cost)}`,
      `Gross Profit: ${formatPKR(grossProfit)}`,
      `Petty Expenses: ${formatPKR(expensesTotal)}`,
      `*Net Profit: ${formatPKR(netProfit)}*`,
      `----------------------------`,
      `Recent Bills:`,
      ...completed.slice(0, 6).map(
        (i) => `- ${i.invoiceNumber}: ${i.customerName || 'Walk-in'} | ${formatPKR(i.netPayable)} (${i.paymentMethod.toUpperCase()})`
      ),
    ];

    return {
      type,
      title: 'Sales & Profit Summary Report',
      subtitle: `${src.profile.nameEn} · Bills, Revenue, COGS & Net Profit`,
      filenameBase: `CurePlus_Sales_Profit_${dateTag}`,
      generatedAt: nowStr,
      kpis,
      columns,
      rows,
      whatsappText: whatsappLines.join('\n'),
      emailSubject: `${src.profile.nameEn} - Sales & Profit Report (${dateTag})`,
    };
  }

  if (type === 'shift_zreport') {
    let cashSales = 0;
    let cardSales = 0;
    let walletSales = 0;
    let khataSales = 0;
    for (const inv of src.invoices) {
      if (inv.status === 'returned') continue;
      if (inv.paymentMethod === 'cash') cashSales += inv.netPayable;
      else if (inv.paymentMethod === 'card') cardSales += inv.netPayable;
      else if (inv.paymentMethod === 'easypaisa_jazzcash') walletSales += inv.netPayable;
      else if (inv.paymentMethod === 'khata') khataSales += inv.netPayable;
    }
    const totalExpenses = src.expenses.reduce((s, e) => s + e.amount, 0);
    const expectedDrawer = Math.max(0, src.shift.openingFloat + cashSales - totalExpenses);
    const totalRev = cashSales + cardSales + walletSales + khataSales;

    const kpis = [
      { label: 'Opening Float', value: formatPKR(src.shift.openingFloat) },
      { label: 'Total Shift Sales', value: formatPKR(totalRev) },
      { label: 'Petty Expenses', value: formatPKR(totalExpenses) },
      { label: 'Expected Drawer Cash', value: formatPKR(expectedDrawer) },
    ];

    const columns = ['Particulars', 'Category / Method', 'Amount (PKR)'];
    const rows: string[][] = [
      ['Opening Cash Float', 'Shift Start', formatPKR(src.shift.openingFloat)],
      ['Cash Sales', 'Drawer In', formatPKR(cashSales)],
      ['Card / POS Sales', 'Bank', formatPKR(cardSales)],
      ['Easypaisa / JazzCash', 'Mobile Wallet', formatPKR(walletSales)],
      ['Khata Credit Sales', 'Credit Receivable', formatPKR(khataSales)],
      ...src.expenses.map((e) => [`Expense: ${e.description}`, e.category, `-${formatPKR(e.amount)}`]),
      ['Expected Cash in Drawer', 'Closing Summary', formatPKR(expectedDrawer)],
    ];
    if (typeof src.shift.actualClosingCash === 'number') {
      rows.push(['Actual Counted Cash', 'Physical Count', formatPKR(src.shift.actualClosingCash)]);
    }

    const whatsappText = [
      `*${src.profile.nameEn}*`,
      `*Shift Cash & Z-Report*`,
      `Cashier: ${src.shift.openedBy}`,
      `Date: ${nowStr}`,
      `----------------------------`,
      `Opening Float: ${formatPKR(src.shift.openingFloat)}`,
      `Cash Sales: ${formatPKR(cashSales)}`,
      `Card Sales: ${formatPKR(cardSales)}`,
      `Easypaisa / JazzCash: ${formatPKR(walletSales)}`,
      `Khata Credit: ${formatPKR(khataSales)}`,
      `Total Sales: ${formatPKR(totalRev)}`,
      `Petty Expenses: -${formatPKR(totalExpenses)}`,
      `*Expected Drawer Cash: ${formatPKR(expectedDrawer)}*`,
      ...(typeof src.shift.actualClosingCash === 'number'
        ? [`Counted Cash: ${formatPKR(src.shift.actualClosingCash)}`]
        : []),
    ].join('\n');

    return {
      type,
      title: 'Cash Shift & Z-Report Summary',
      subtitle: `Cashier: ${src.shift.openedBy} · Status: ${src.shift.status.toUpperCase()}`,
      filenameBase: `CurePlus_Shift_ZReport_${dateTag}`,
      generatedAt: nowStr,
      kpis,
      columns,
      rows,
      whatsappText,
      emailSubject: `${src.profile.nameEn} - Shift Z-Report (${dateTag})`,
    };
  }

  if (type === 'inventory_expiry') {
    let totalRetailValue = 0;
    let lowStockCount = 0;
    const rows: string[][] = [];

    for (const med of src.medicines) {
      const units = getTotalSellableUnits(med.id, src.batches);
      const val = (units / Math.max(1, med.packSize)) * med.mrpPerPack;
      totalRetailValue += val;
      const isLow = units <= med.minStockUnits;
      if (isLow) lowStockCount++;

      const medBatches = src.batches
        .filter((b) => b.medicineId === med.id && b.quantityUnits > 0 && !b.quarantined)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const nearestExp = medBatches[0]?.expiryDate || 'None';
      const expDays = medBatches[0] ? daysUntilDate(medBatches[0].expiryDate) : 999;

      rows.push([
        med.nameEn,
        med.rackLocation || '-',
        formatStockReadable(units, med),
        formatPKR(med.mrpPerPack),
        nearestExp === 'None' ? 'Out of Stock' : `${nearestExp} (${expDays}d)`,
        isLow ? 'LOW STOCK' : 'OK',
      ]);
    }

    const expiredOrNear = src.batches.filter(
      (b) => b.quantityUnits > 0 && (b.quarantined || daysUntilDate(b.expiryDate) <= 90)
    ).length;

    const lowList = src.medicines
      .filter((m) => getTotalSellableUnits(m.id, src.batches) <= m.minStockUnits)
      .slice(0, 8);

    const whatsappText = [
      `*${src.profile.nameEn}*`,
      `*Inventory & Low-Stock Report*`,
      `Date: ${nowStr}`,
      `----------------------------`,
      `Total Medicines: ${src.medicines.length}`,
      `Sellable Stock Value: ${formatPKR(totalRetailValue)}`,
      `Low Stock Alerts: ${lowStockCount}`,
      `Expired / Near-Expiry Batches: ${expiredOrNear}`,
      ...(lowList.length > 0
        ? [
            `----------------------------`,
            `*Medicines to Reorder:*`,
            ...lowList.map(
              (m) => `- ${m.nameEn}: ${formatStockReadable(getTotalSellableUnits(m.id, src.batches), m)}`
            ),
          ]
        : []),
    ].join('\n');

    return {
      type,
      title: 'Inventory, Stock Valuation & Expiry Report',
      subtitle: `${src.profile.nameEn} · All SKUs, Rack Locations & FEFO Nearest Expiry`,
      filenameBase: `CurePlus_Inventory_${dateTag}`,
      generatedAt: nowStr,
      kpis: [
        { label: 'Total SKUs', value: String(src.medicines.length) },
        { label: 'Retail Stock Value', value: formatPKR(totalRetailValue) },
        { label: 'Low Stock SKUs', value: String(lowStockCount) },
        { label: 'Expiry Alerts (<=90d)', value: String(expiredOrNear) },
      ],
      columns: ['Medicine', 'Rack', 'Available Stock', 'Box MRP', 'Nearest Expiry', 'Status'],
      rows,
      whatsappText,
      emailSubject: `${src.profile.nameEn} - Inventory & Expiry Report (${dateTag})`,
    };
  }

  if (type === 'suppliers_khata') {
    const deliveries = src.supplierTransactions.filter((t) => t.type === 'delivery');
    const totalSupplied = deliveries.reduce((s, d) => s + d.amount, 0);
    const totalPaid =
      deliveries.reduce((s, d) => s + (d.paidAmount || 0), 0) +
      src.supplierTransactions
        .filter((t) => t.type === 'payment')
        .reduce((s, p) => s + p.amount, 0);
    const totalPayable = src.suppliers.reduce((s, sup) => s + sup.payableBalance, 0);

    const rows = src.supplierTransactions.map((tx) => {
      const sup = src.suppliers.find((s) => s.id === tx.supplierId);
      const isDel = tx.type === 'delivery';
      const bal = isDel ? Math.max(0, tx.amount - (tx.paidAmount || 0)) : 0;
      return [
        new Date(tx.date).toLocaleDateString('en-PK'),
        sup?.name || 'Supplier',
        tx.deliveredBy || '-',
        tx.reference,
        isDel ? formatPKR(tx.amount) : '-',
        formatPKR(isDel ? tx.paidAmount || 0 : tx.amount),
        isDel ? formatPKR(bal) : 'Payment',
      ];
    });

    const whatsappText = [
      `*${src.profile.nameEn}*`,
      `*Suppliers & Stock Delivery Report*`,
      `Date: ${nowStr}`,
      `----------------------------`,
      `Total Goods Supplied: ${formatPKR(totalSupplied)}`,
      `Total Paid: ${formatPKR(totalPaid)}`,
      `*Total Remaining Payable: ${formatPKR(totalPayable)}*`,
      `----------------------------`,
      `*Payable by Distributor:*`,
      ...src.suppliers.map((s) => `- ${s.name}: ${formatPKR(s.payableBalance)}`),
      `----------------------------`,
      `*Recent Deliveries:*`,
      ...deliveries.slice(0, 5).map((d) => {
        const sup = src.suppliers.find((s) => s.id === d.supplierId);
        return `- ${sup?.name || 'Supplier'} (${d.deliveredBy || 'Rider'}): Goods ${formatPKR(d.amount)}, Paid ${formatPKR(d.paidAmount || 0)}`;
      }),
    ].join('\n');

    return {
      type,
      title: 'Suppliers, Deliveries & Payable Ledger Report',
      subtitle: `${src.profile.nameEn} · Goods Delivered, Salesmen & Remaining Balances`,
      filenameBase: `CurePlus_Suppliers_Report_${dateTag}`,
      generatedAt: nowStr,
      kpis: [
        { label: 'Total Goods Supplied', value: formatPKR(totalSupplied) },
        { label: 'Total Paid', value: formatPKR(totalPaid) },
        { label: 'Remaining Payable', value: formatPKR(totalPayable) },
        { label: 'Total Deliveries', value: String(deliveries.length) },
      ],
      columns: ['Date', 'Supplier', 'Delivered By', 'Bill #', 'Goods Amt', 'Paid', 'Balance'],
      rows,
      whatsappText,
      emailSubject: `${src.profile.nameEn} - Suppliers & Deliveries Report (${dateTag})`,
    };
  }

  // customer_khata
  const totalReceivable = src.customers.reduce((s, c) => s + c.khataBalance, 0);
  const activeDebtors = src.customers.filter((c) => c.khataBalance > 0);
  const rows = src.customers.map((c) => [
    c.name,
    c.phone,
    formatPKR(c.creditLimit),
    formatPKR(c.khataBalance),
    String(c.loyaltyPoints),
    c.khataBalance > 0 ? 'DUE' : 'CLEAR',
  ]);

  const whatsappText = [
    `*${src.profile.nameEn}*`,
    `*Customer Khata (Receivables) Report*`,
    `Date: ${nowStr}`,
    `----------------------------`,
    `Total Customers: ${src.customers.length}`,
    `Accounts with Balance: ${activeDebtors.length}`,
    `*Total Receivable (Udhaar): ${formatPKR(totalReceivable)}*`,
    ...(activeDebtors.length > 0
      ? [
          `----------------------------`,
          ...activeDebtors.map((c) => `- ${c.name} (${c.phone}): ${formatPKR(c.khataBalance)}`),
        ]
      : []),
  ].join('\n');

  return {
    type,
    title: 'Customer Khata & Credit Receivables Report',
    subtitle: `${src.profile.nameEn} · Patient Accounts, Credit Limits & Due Balances`,
    filenameBase: `CurePlus_Customer_Khata_${dateTag}`,
    generatedAt: nowStr,
    kpis: [
      { label: 'Registered Patients', value: String(src.customers.length) },
      { label: 'Due Accounts', value: String(activeDebtors.length) },
      { label: 'Total Khata Receivable', value: formatPKR(totalReceivable) },
      {
        label: 'Total Loyalty Points',
        value: String(src.customers.reduce((s, c) => s + c.loyaltyPoints, 0)),
      },
    ],
    columns: ['Customer / Clinic', 'Phone', 'Credit Limit', 'Due Balance', 'Points', 'Status'],
    rows,
    whatsappText,
    emailSubject: `${src.profile.nameEn} - Customer Khata Report (${dateTag})`,
  };
}

export function generateReportPdf(
  report: StructuredReportData,
  profile: PharmacyProfile
): { blob: Blob; file: File; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(profile.nameEn, 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${profile.addressEn}  |  Tel: ${profile.phone}`, 14, 19);
  doc.text(`DRAP License: ${profile.drapLicense}  |  NTN: ${profile.ntnNumber}`, 14, 24.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153);
  doc.text('PHARMACY REPORT', pageWidth - 14, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${report.generatedAt}`, pageWidth - 14, 19, { align: 'right' });

  // Report Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.title, 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(report.subtitle, 14, 47.5);

  // KPI Boxes (up to 4)
  const kpiCount = Math.min(4, report.kpis.length);
  const gap = 3;
  const boxWidth = (pageWidth - 28 - gap * (kpiCount - 1)) / kpiCount;
  let yStart = 53;

  report.kpis.slice(0, 4).forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, yStart, boxWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, yStart + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3, yStart + 12.5);
  });

  // Table
  autoTable(doc, {
    startY: yStart + 22,
    head: [report.columns],
    body: report.rows.length > 0 ? report.rows : [['No records available']],
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105], // Emerald-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${profile.nameEn} · Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'center' }
      );
    },
  });

  const filename = `${report.filenameBase}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { blob, file, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
