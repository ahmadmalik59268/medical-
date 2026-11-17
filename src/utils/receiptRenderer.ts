import { PaperWidthChars, PharmacyProfile, SaleInvoice } from '../types/pharmacy';
import { PAYMENT_LABELS, UNIT_LABELS } from '../i18n/translations';
import { EscPosBlock, sanitizeForCp437 } from './escPos';

export function rule(width: number, char = '-'): string {
  return char.repeat(Math.max(1, width));
}

export function center(text: string, width: number): string {
  const clean = sanitizeForCp437(text).trim();
  if (clean.length >= width) return clean.slice(0, width);
  const leftPad = Math.floor((width - clean.length) / 2);
  return ' '.repeat(leftPad) + clean;
}

export function wrap(text: string, width: number): string[] {
  const clean = sanitizeForCp437(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function pair(left: string, right: string, width: number): string {
  const l = sanitizeForCp437(left).trim();
  const r = sanitizeForCp437(right).trim();
  const minGap = 1;
  const maxLeft = Math.max(1, width - r.length - minGap);
  const clippedLeft = l.length > maxLeft ? l.slice(0, maxLeft) : l;
  const spaces = Math.max(minGap, width - clippedLeft.length - r.length);
  return clippedLeft + ' '.repeat(spaces) + r;
}

function fmtAmt(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return `Rs.${rounded.toLocaleString('en-PK', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Single-source monospaced receipt renderer for 58mm (32 chars) and 80mm (48 chars).
 * Item name sits on its own line(s), then qty x rate + total right-aligned beneath so
 * narrow 32-char rolls never clip medicine names or misalign prices.
 */
export function renderInvoiceMonospace(
  invoice: SaleInvoice,
  profile: PharmacyProfile,
  width: PaperWidthChars
): string {
  return renderInvoiceEscPosBlocks(invoice, profile, width)
    .map((b) => {
      if (b.align === 'center') return center(b.text, width);
      return b.text;
    })
    .join('\n');
}

export function renderInvoiceEscPosBlocks(
  invoice: SaleInvoice,
  profile: PharmacyProfile,
  width: PaperWidthChars
): EscPosBlock[] {
  const blocks: EscPosBlock[] = [];
  const dt = new Date(invoice.createdAt).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const storeUpper = sanitizeForCp437(profile.nameEn).toUpperCase();
  const canDoubleWidth = storeUpper.length <= Math.floor(width / 2);

  blocks.push({
    text: storeUpper,
    align: 'center',
    bold: true,
    doubleHeight: true,
    doubleWidth: canDoubleWidth,
  });

  for (const l of wrap(profile.addressEn, width)) {
    blocks.push({ text: l, align: 'center' });
  }
  blocks.push({ text: `Tel: ${profile.phone}`, align: 'center', bold: true });
  blocks.push({
    text: `${profile.drapLicense}${profile.ntnNumber ? ` | NTN: ${profile.ntnNumber}` : ''}`,
    align: 'center',
  });
  blocks.push({ text: rule(width, '=') });
  blocks.push({
    text: invoice.status === 'returned' ? '*** SALES RETURN RECEIPT ***' : '*** SALES INVOICE ***',
    align: 'center',
    bold: true,
  });
  blocks.push({ text: rule(width, '=') });

  blocks.push({ text: pair('Invoice #:', invoice.invoiceNumber, width), bold: true });
  blocks.push({ text: pair('Date/Time:', dt, width) });
  blocks.push({ text: pair('Patient:', invoice.customerName || 'Walk-in Patient', width) });
  if (invoice.customerPhone) {
    blocks.push({ text: pair('Phone:', invoice.customerPhone, width) });
  }
  if (invoice.doctorName) {
    blocks.push({
      text: pair(
        'Doctor:',
        `${invoice.doctorName}${invoice.rxNumber ? ` (${invoice.rxNumber})` : ''}`,
        width
      ),
    });
  }
  blocks.push({ text: pair('Cashier:', invoice.cashierName.split('(')[0].trim(), width) });
  blocks.push({ text: rule(width, '-') });
  blocks.push({ text: pair('ITEM / QTY x RATE', 'AMOUNT', width), bold: true });
  blocks.push({ text: rule(width, '-') });

  invoice.items.forEach((item, idx) => {
    const rxTag = item.requiresPrescription ? ' [Rx]' : '';
    const titleLines = wrap(`${idx + 1}. ${item.nameEn}${rxTag}`, width);
    titleLines.forEach((line) => blocks.push({ text: line, bold: true }));

    const unitTag = UNIT_LABELS[item.saleUnitType].en;
    const leftMath = `   ${item.quantity} ${unitTag} x ${item.unitPrice}${
      item.discountPercent > 0 ? ` (-${item.discountPercent}%)` : ''
    }`;
    blocks.push({ text: pair(leftMath, fmtAmt(item.lineTotal), width) });
    blocks.push({ text: `   Batch: ${item.batchNumber}  Exp: ${item.expiryDate}` });
  });

  blocks.push({ text: rule(width, '-') });
  const totalQty = invoice.items.reduce((s, i) => s + i.quantity, 0);
  blocks.push({
    text: pair(`Items: ${invoice.items.length} (Qty: ${totalQty})`, '', width),
  });
  blocks.push({ text: pair('Gross Subtotal', fmtAmt(invoice.subtotal), width) });

  const totalDisc = invoice.itemDiscounts + invoice.extraDiscountRs;
  if (totalDisc > 0) {
    blocks.push({ text: pair('Discount / Saved', `-${fmtAmt(totalDisc)}`, width) });
  }
  if (invoice.taxAmount > 0) {
    blocks.push({ text: pair(`GST (${invoice.taxPercent}%)`, fmtAmt(invoice.taxAmount), width) });
  }

  blocks.push({ text: rule(width, '=') });
  blocks.push({
    text: pair('NET PAYABLE', fmtAmt(invoice.netPayable), width),
    bold: true,
    doubleHeight: true,
  });
  blocks.push({ text: rule(width, '=') });

  blocks.push({ text: pair('Payment Mode:', PAYMENT_LABELS[invoice.paymentMethod].en, width), bold: true });
  if (invoice.paymentMethod === 'cash') {
    blocks.push({ text: pair('Cash Tendered:', fmtAmt(invoice.cashTendered), width) });
    blocks.push({ text: pair('Change Returned:', fmtAmt(invoice.changeDue), width), bold: true });
  } else if (invoice.paymentMethod === 'khata') {
    blocks.push({ text: '* CHARGED TO PATIENT KHATA *', align: 'center', bold: true });
  }

  blocks.push({ text: rule(width, '-') });
  blocks.push({ text: `* ${invoice.invoiceNumber} *`, align: 'center', bold: true });
  for (const policyLine of wrap(
    'Exchange within 7 days with original bill & intact packing. Fridge/single-piece items non-returnable.',
    width
  )) {
    blocks.push({ text: policyLine, align: 'center' });
  }
  blocks.push({ text: rule(width, '-') });
  for (const footerLine of wrap(profile.receiptFooterEn, width)) {
    blocks.push({ text: footerLine, align: 'center', bold: true });
  }
  blocks.push({ text: 'Thank You - Get Well Soon!', align: 'center' });

  return blocks;
}

export function renderZReportMonospace(
  profile: PharmacyProfile,
  stats: {
    openedBy: string;
    openingFloat: number;
    cashSales: number;
    cardSales: number;
    mobileWalletSales: number;
    khataSales: number;
    totalExpenses: number;
    grandTotalSales: number;
    expectedCashInDrawer: number;
    actualClosingCash?: number;
  },
  width: PaperWidthChars
): string {
  return renderZReportEscPosBlocks(profile, stats, width)
    .map((b) => (b.align === 'center' ? center(b.text, width) : b.text))
    .join('\n');
}

export function renderZReportEscPosBlocks(
  profile: PharmacyProfile,
  stats: {
    openedBy: string;
    openingFloat: number;
    cashSales: number;
    cardSales: number;
    mobileWalletSales: number;
    khataSales: number;
    totalExpenses: number;
    grandTotalSales: number;
    expectedCashInDrawer: number;
    actualClosingCash?: number;
  },
  width: PaperWidthChars
): EscPosBlock[] {
  const blocks: EscPosBlock[] = [];
  blocks.push({
    text: sanitizeForCp437(profile.nameEn).toUpperCase(),
    align: 'center',
    bold: true,
    doubleHeight: true,
  });
  blocks.push({ text: 'SHIFT Z-REPORT / DRAWER AUDIT', align: 'center', bold: true });
  blocks.push({ text: new Date().toLocaleString('en-PK'), align: 'center' });
  blocks.push({ text: rule(width, '=') });
  blocks.push({ text: pair('Pharmacist:', stats.openedBy.split('(')[0].trim(), width) });
  blocks.push({ text: pair('Opening Float:', fmtAmt(stats.openingFloat), width) });
  blocks.push({ text: rule(width, '-') });
  blocks.push({ text: pair('Cash Sales:', fmtAmt(stats.cashSales), width) });
  blocks.push({ text: pair('Card Sales:', fmtAmt(stats.cardSales), width) });
  blocks.push({ text: pair('Easypaisa/Jazz:', fmtAmt(stats.mobileWalletSales), width) });
  blocks.push({ text: pair('Khata Credit:', fmtAmt(stats.khataSales), width) });
  blocks.push({ text: pair('Petty Expenses:', `-${fmtAmt(stats.totalExpenses)}`, width) });
  blocks.push({ text: rule(width, '=') });
  blocks.push({ text: pair('TOTAL REVENUE:', fmtAmt(stats.grandTotalSales), width), bold: true });
  blocks.push({
    text: pair('EXPECTED CASH:', fmtAmt(stats.expectedCashInDrawer), width),
    bold: true,
    doubleHeight: true,
  });
  if (typeof stats.actualClosingCash === 'number') {
    blocks.push({ text: pair('COUNTED CASH:', fmtAmt(stats.actualClosingCash), width), bold: true });
  }
  blocks.push({ text: rule(width, '=') });
  return blocks;
}
