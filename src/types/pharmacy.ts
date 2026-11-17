export type AppLanguageMode = 'bilingual' | 'en' | 'ur';

export type ViewTab = 'pos' | 'inventory' | 'khata' | 'shift' | 'reports';

export type MedicineCategory =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Injection'
  | 'Drops'
  | 'Ointment'
  | 'Surgical';

export type SaleUnitType = 'pack' | 'strip' | 'loose';

export type PaymentMethod = 'cash' | 'card' | 'easypaisa_jazzcash' | 'khata';

export type BatchHealthStatus = 'healthy' | 'warning' | 'critical' | 'expired' | 'quarantined';

export interface Medicine {
  id: string;
  barcode: string;
  nameEn: string;
  nameUr: string;
  genericSalt: string;
  manufacturer: string;
  category: MedicineCategory;
  rackLocation: string;
  packSize: number;
  stripSize: number;
  allowLooseSale: boolean;
  mrpPerPack: number;
  costPerPack: number;
  minStockUnits: number;
  requiresPrescription: boolean;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantityUnits: number;
  quarantined?: boolean;
}

export interface CartItem {
  cartItemId: string;
  medicineId: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  nameEn: string;
  nameUr: string;
  genericSalt: string;
  barcode: string;
  saleUnitType: SaleUnitType;
  quantity: number;
  unitsPerSelectedUnit: number;
  unitPrice: number;
  costPerBaseUnit: number;
  discountPercent: number;
  maxAvailableSelectedUnits: number;
  dosageLabel?: string;
  requiresPrescription?: boolean;
}

export interface InvoiceLineItem {
  medicineId: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  nameEn: string;
  nameUr: string;
  saleUnitType: SaleUnitType;
  quantity: number;
  unitsDeducted: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  costTotal: number;
  dosageLabel?: string;
  requiresPrescription?: boolean;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  doctorName: string;
  rxNumber?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  itemDiscounts: number;
  extraDiscountRs: number;
  taxPercent: number;
  taxAmount: number;
  netPayable: number;
  paymentMethod: PaymentMethod;
  cashTendered: number;
  changeDue: number;
  status: 'completed' | 'returned';
  returnedAt?: string;
}

export interface HeldBill {
  id: string;
  label: string;
  heldAt: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  doctorName: string;
  rxNumber: string;
  extraDiscountRs: number;
  cart: CartItem[];
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  address?: string;
  allergies?: string;
  chronicNotes?: string;
  creditLimit: number;
  khataBalance: number;
  loyaltyPoints: number;
}

export interface KhataTransaction {
  id: string;
  customerId: string;
  date: string;
  type: 'debit_sale' | 'credit_payment' | 'return_adjustment';
  amount: number;
  reference: string;
  note: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  city: string;
  ntnOrLicense: string;
  payableBalance: number;
}

export interface PurchaseOrderItem {
  medicineId: string;
  medicineNameEn: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  packsOrdered: number;
  bonusPacks: number;
  costPerPack: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNo: string;
  deliveredBy?: string;
  notes?: string;
  createdAt: string;
  receivedAt?: string;
  status: 'ordered' | 'received';
  items: PurchaseOrderItem[];
  totalAmount: number;
  paidAmount: number;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  type: 'delivery' | 'payment';
  amount: number;
  paidAmount?: number;
  deliveredBy?: string;
  reference: string;
  note: string;
}

export interface PettyExpense {
  id: string;
  createdAt: string;
  category: 'Utilities' | 'Tea & Hospitality' | 'Courier & Delivery' | 'Maintenance' | 'Other';
  description: string;
  amount: number;
  recordedBy: string;
}

export interface CashShift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  openingFloat: number;
  actualClosingCash?: number;
  status: 'open' | 'closed';
}

export interface PharmacyProfile {
  nameEn: string;
  nameUr: string;
  taglineEn: string;
  taglineUr: string;
  drapLicense: string;
  ntnNumber: string;
  addressEn: string;
  addressUr: string;
  phone: string;
  cashierName: string;
  defaultTaxPercent: number;
  receiptFooterEn: string;
  receiptFooterUr: string;
}

export interface DrugInteractionRule {
  id: string;
  saltKeywordA: string;
  saltKeywordB: string;
  severity: 'High' | 'Moderate';
  messageEn: string;
  messageUr: string;
}

export type PaperWidthChars = 32 | 48; // 58mm = 32 chars, 80mm = 48 chars (Font A)

export type PrinterTransport = 'browser' | 'serial' | 'bluetooth';

export type PrintJobStatus = 'off' | 'no_printer' | 'printing' | 'done' | 'failed';

export interface PrinterSettings {
  transport: PrinterTransport;
  printerName: string;
  paperWidthChars: PaperWidthChars;
  autoPrint: boolean;
  baudRate: 9600 | 115200;
  receiptFormat: 'bilingual_rich' | 'escpos_mono';
}

