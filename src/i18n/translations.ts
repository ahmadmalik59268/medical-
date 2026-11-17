import { AppLanguageMode, MedicineCategory, PaymentMethod, SaleUnitType } from '../types/pharmacy';

export interface BilingualText {
  en: string;
  ur: string;
}

export const CATEGORY_LABELS: Record<MedicineCategory | 'All', BilingualText> = {
  All: { en: 'All Items', ur: 'تمام ادویات' },
  Tablet: { en: 'Tablets', ur: 'گولیاں' },
  Capsule: { en: 'Capsules', ur: 'کیپسول' },
  Syrup: { en: 'Syrups', ur: 'شربت' },
  Injection: { en: 'Injections', ur: 'انجیکشن' },
  Drops: { en: 'Drops', ur: 'قطرے' },
  Ointment: { en: 'Ointments', ur: 'مرہم / کریم' },
  Surgical: { en: 'Surgical & OTC', ur: 'سرجیکل و دیگر' },
};

export const UNIT_LABELS: Record<SaleUnitType, BilingualText> = {
  pack: { en: 'Box', ur: 'ڈبہ' },
  strip: { en: 'Patta', ur: 'پتہ' },
  loose: { en: 'Piece', ur: '1 پیس / گولی' },
};

export const PAYMENT_LABELS: Record<PaymentMethod, BilingualText> = {
  cash: { en: 'Cash (PKR)', ur: 'نقد رقم' },
  card: { en: 'Card / POS', ur: 'کارڈ پیمنٹ' },
  easypaisa_jazzcash: { en: 'Easypaisa / JazzCash', ur: 'ایزی پیسہ / جاز کیش' },
  khata: { en: 'Customer Khata', ur: 'کسٹمر کھاتہ (ادھار)' },
};

export const UI_COPY = {
  nav: {
    pos: { en: 'POS Counter', ur: 'کاؤنٹر بلنگ' },
    inventory: { en: 'Inventory', ur: 'اسٹاک و خریداری' },
    khata: { en: 'Khata', ur: 'کسٹمر کھاتہ' },
    shift: { en: 'Shift & Rx', ur: 'کیش شفٹ' },
    reports: { en: 'Reports', ur: 'رپورٹس و سیٹنگز' },
  },
  header: {
    scanBarcode: { en: 'Scan Barcode', ur: 'بار کوڈ اسکین' },
  },
  pos: {
    searchPlaceholder: {
      en: 'Search by medicine, Urdu name, salt formula, barcode, or rack (F2)...',
      ur: 'دوائی کا نام، اردو نام، سالٹ فارمولا، بار کوڈ یا ریک تلاش کریں...',
    },
    activeBill: { en: 'Active Customer Bill', ur: 'موجودہ کسٹمر بل' },
    clearBill: { en: 'Clear', ur: 'صاف کریں' },
    holdBill: { en: 'Hold Bill', ur: 'بل ہولڈ کریں' },
    heldBills: { en: 'Held Bills', ur: 'روکے گئے بل' },
    emptyCartTitle: { en: 'Bill is empty — scan or tap a medicine', ur: 'بل خالی ہے — بار کوڈ اسکین کریں یا دوائی منتخب کریں' },
    emptyCartHint: {
      en: 'Scan with USB gun, camera scanner, or click Add on any medicine.',
      ur: 'کسی بھی دوائی کے ڈبے کا بار کوڈ اسکین کریں یا کیٹلاگ سے شامل کریں۔',
    },
    customerName: { en: 'Patient / Customer Name', ur: 'مریض / کسٹمر کا نام' },
    customerPhone: { en: 'Mobile Number (Optional)', ur: 'موبائل نمبر (اختیاری)' },
    doctorName: { en: 'Prescribed By (Doctor)', ur: 'ڈاکٹر کا نام' },
    rxNumber: { en: 'Rx # (Optional)', ur: 'نسخہ نمبر' },
    subtotal: { en: 'Subtotal', ur: 'کل رقم' },
    discount: { en: 'Extra Discount (Rs.)', ur: 'اضافی رعایت (روپے)' },
    tax: { en: 'Tax / GST', ur: 'ٹیکس / جی ایس ٹی' },
    netPayable: { en: 'Net Payable', ur: 'واجب الادا رقم' },
    cashTendered: { en: 'Cash Received', ur: 'وصول شدہ نقدی' },
    completeSale: { en: 'Complete Sale & Print Receipt', ur: 'بل مکمل کریں اور رسید پرنٹ کریں' },
    substitutes: { en: 'Substitutes', ur: 'متبادل دوائی' },
    expiredLocked: { en: 'Expired — Locked', ur: 'ایکسپائرڈ — بند' },
    outOfStock: { en: 'Out of Stock', ur: 'اسٹاک ختم' },
  },
  inventory: {
    title: { en: 'Inventory, Expiry Radar & Purchase Orders', ur: 'اسٹاک، ایکسپائری اور سپلائر خریداری' },
    addMedicine: { en: 'Add Medicine', ur: 'نئی دوائی شامل کریں' },
    totalSkus: { en: 'Active Medicines', ur: 'کل ادویات' },
    sellableStockValue: { en: 'Retail Stock Value', ur: 'اسٹاک کی مالیت' },
    lowStockCount: { en: 'Low Stock Alerts', ur: 'کم اسٹاک الرٹس' },
    expiredCount: { en: 'Expired / Locked Batches', ur: 'ایکسپائرڈ بیچز' },
  },
  expiry: {
    title: { en: 'FEFO Batch Expiry & Low-Stock Radar', ur: 'ایکسپائری اور کم اسٹاک الرٹس' },
    expiredTab: { en: 'Expired (Locked)', ur: 'زائد المیعاد (بند)' },
    nearExpiryTab: { en: 'Near Expiry (< 90 Days)', ur: 'قریبِ میعاد (90 دن سے کم)' },
    lowStockTab: { en: 'Low Stock Reorder', ur: 'کم اسٹاک آرڈر' },
    quarantineBtn: { en: 'Quarantine Batch', ur: 'اسٹاک علیحدہ کریں' },
    quarantinedLabel: { en: 'Quarantined', ur: 'علیحدہ شدہ' },
    restockBtn: { en: 'Add New Batch', ur: 'نیا اسٹاک شامل کریں' },
  },
  invoices: {
    title: { en: 'Sales History & Thermal Invoices', ur: 'فروخت کا ریکارڈ اور رسیدیں' },
    todaySales: { en: 'Total Sales Revenue', ur: 'کل فروخت' },
    invoiceCount: { en: 'Completed Bills', ur: 'مکمل بلز' },
    estProfit: { en: 'Gross Margin Est.', ur: 'متوقع منافع' },
    returnsTotal: { en: 'Returned Bills', ur: 'واپس شدہ بلز' },
    reprintReceipt: { en: 'Print Receipt', ur: 'رسید پرنٹ کریں' },
    returnSale: { en: 'Return / Refund', ur: 'واپسی / ریفنڈ' },
    returned: { en: 'Returned', ur: 'واپس شدہ' },
  },
};

export function pickText(text: BilingualText, mode: AppLanguageMode): string {
  if (mode === 'en') return text.en;
  if (mode === 'ur') return text.ur;
  return `${text.en} · ${text.ur}`;
}

export function formatPKR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `Rs. ${rounded.toLocaleString('en-PK', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
