import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Languages,
  Moon,
  Printer,
  RotateCcw,
  ScanBarcode,
  ShoppingCart,
  Sun,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppLanguageMode,
  CartItem,
  CashShift,
  CustomerProfile,
  HeldBill,
  KhataTransaction,
  Medicine,
  MedicineBatch,
  PaymentMethod,
  PettyExpense,
  PharmacyProfile,
  PrinterSettings,
  PrintJobStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  SaleInvoice,
  SaleUnitType,
  Supplier,
  SupplierTransaction,
  ViewTab,
} from './types/pharmacy';
import {
  DEFAULT_PHARMACY_PROFILE,
  SEED_BATCHES,
  SEED_CUSTOMERS,
  SEED_EXPENSES,
  SEED_INVOICES,
  SEED_KHATA_TX,
  SEED_MEDICINES,
  SEED_PURCHASE_ORDERS,
  SEED_SHIFT,
  SEED_SUPPLIERS,
  SEED_SUPPLIER_TX,
} from './data/seedCatalog';
import { formatPKR, UI_COPY } from './i18n/translations';
import { playErrorBeep, playScanBeep } from './utils/barcode';
import {
  calculateUnitPricing,
  daysUntilDate,
  getBestFefoBatch,
  getExpiredOrQuarantinedBatches,
  getTotalSellableUnits,
} from './utils/fefo';
import { PosCounterView } from './components/PosCounterView';
import { InventoryView } from './components/InventoryView';
import { CustomersKhataView } from './components/CustomersKhataView';
import { ShiftRegisterView } from './components/ShiftRegisterView';
import { ReportsSettingsView } from './components/ReportsSettingsView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';
import { BarcodeLabelModal } from './components/BarcodeLabelModal';
import { MedicineFormModal } from './components/MedicineFormModal';
import { SubstitutesModal } from './components/SubstitutesModal';
import { QuickGuideModal } from './components/QuickGuideModal';
import { ReportShareModal } from './components/ReportShareModal';
import { executePrintJob } from './utils/printService';
import { renderInvoiceEscPosBlocks } from './utils/receiptRenderer';
import { PharmacyReportType } from './utils/reportGenerator';
import {
  fetchAllFromSupabase,
  isSupabaseConfigured,
  subscribeToSupabaseChanges,
  syncBatchInsertToSupabase,
  syncBatchQuarantineToSupabase,
  syncCompleteSaleToSupabase,
  syncCreatePOToSupabase,
  syncCustomerInsertToSupabase,
  syncExpenseInsertToSupabase,
  syncHeldBillDeleteToSupabase,
  syncHeldBillUpsertToSupabase,
  syncKhataPaymentToSupabase,
  syncMedicineUpsertToSupabase,
  syncProfileAndPrinterToSupabase,
  syncReceivePOToSupabase,
  syncReturnInvoiceToSupabase,
  syncShiftUpsertToSupabase,
  syncSupplierDeliveryToSupabase,
  syncSupplierInsertToSupabase,
  syncSupplierPaymentToSupabase,
} from './lib/supabase';

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  transport: 'browser',
  printerName: 'System / OS Thermal Driver',
  paperWidthChars: 48, // 80mm default; user can switch to 58mm (32 chars)
  autoPrint: true,
  baudRate: 9600,
  receiptFormat: 'bilingual_rich',
};

const STORAGE_KEYS = {
  profile: 'cureplus_pos_profile_v2',
  medicines: 'cureplus_pos_medicines_v2',
  batches: 'cureplus_pos_batches_v2',
  invoices: 'cureplus_pos_invoices_v2',
  customers: 'cureplus_pos_customers_v2',
  khataTx: 'cureplus_pos_khatatx_v2',
  suppliers: 'cureplus_pos_suppliers_v2',
  supplierTx: 'cureplus_pos_suptx_v2',
  purchaseOrders: 'cureplus_pos_pos_v2',
  heldBills: 'cureplus_pos_held_v2',
  expenses: 'cureplus_pos_expenses_v2',
  shift: 'cureplus_pos_shift_v2',
  langMode: 'cureplus_pos_lang_v2',
  darkMode: 'cureplus_pos_dark_v2',
  soundEnabled: 'cureplus_pos_sound_v2',
  printerSettings: 'cureplus_pos_printer_v1',
};

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [profile, setProfile] = useState<PharmacyProfile>(() =>
    loadStoredJson(STORAGE_KEYS.profile, DEFAULT_PHARMACY_PROFILE)
  );
  const [medicines, setMedicines] = useState<Medicine[]>(() =>
    loadStoredJson(STORAGE_KEYS.medicines, SEED_MEDICINES)
  );
  const [batches, setBatches] = useState<MedicineBatch[]>(() =>
    loadStoredJson(STORAGE_KEYS.batches, SEED_BATCHES)
  );
  const [invoices, setInvoices] = useState<SaleInvoice[]>(() =>
    loadStoredJson(STORAGE_KEYS.invoices, SEED_INVOICES)
  );
  const [customers, setCustomers] = useState<CustomerProfile[]>(() =>
    loadStoredJson(STORAGE_KEYS.customers, SEED_CUSTOMERS)
  );
  const [khataTransactions, setKhataTransactions] = useState<KhataTransaction[]>(() =>
    loadStoredJson(STORAGE_KEYS.khataTx, SEED_KHATA_TX)
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(() =>
    loadStoredJson(STORAGE_KEYS.suppliers, SEED_SUPPLIERS)
  );
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>(() =>
    loadStoredJson(STORAGE_KEYS.supplierTx, SEED_SUPPLIER_TX)
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    loadStoredJson(STORAGE_KEYS.purchaseOrders, SEED_PURCHASE_ORDERS)
  );
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() =>
    loadStoredJson(STORAGE_KEYS.heldBills, [])
  );
  const [expenses, setExpenses] = useState<PettyExpense[]>(() =>
    loadStoredJson(STORAGE_KEYS.expenses, SEED_EXPENSES)
  );
  const [shift, setShift] = useState<CashShift>(() =>
    loadStoredJson(STORAGE_KEYS.shift, SEED_SHIFT)
  );
  const [langMode, setLangMode] = useState<AppLanguageMode>(() =>
    loadStoredJson(STORAGE_KEYS.langMode, 'bilingual')
  );
  const [darkMode, setDarkMode] = useState<boolean>(() =>
    loadStoredJson(STORAGE_KEYS.darkMode, false)
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    loadStoredJson(STORAGE_KEYS.soundEnabled, true)
  );
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() =>
    loadStoredJson(STORAGE_KEYS.printerSettings, DEFAULT_PRINTER_SETTINGS)
  );
  const [printStatus, setPrintStatus] = useState<PrintJobStatus>('off');
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<SaleInvoice | null>(null);

  const [activeTab, setActiveTab] = useState<ViewTab>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string; showReprint?: boolean } | null>(null);

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<SaleInvoice | null>(null);
  const [labelModalTarget, setLabelModalTarget] = useState<{
    medicine: Medicine;
    batch: MedicineBatch | null;
  } | null>(null);
  const [formModalState, setFormModalState] = useState<{
    open: boolean;
    mode: 'add_medicine' | 'edit_medicine' | 'add_batch';
    medicine: Medicine | null;
  }>({ open: false, mode: 'add_medicine', medicine: null });
  const [substitutesSource, setSubstitutesSource] = useState<Medicine | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [reportShareModal, setReportShareModal] = useState<{
    open: boolean;
    type: PharmacyReportType;
  }>({ open: false, type: 'sales_profit' });

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((ok: boolean, text: string, showReprint = false) => {
    setToast({ ok, text, showReprint });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4800);
  }, []);

  // Persist all stores
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.medicines, JSON.stringify(medicines));
  }, [medicines]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.batches, JSON.stringify(batches));
  }, [batches]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
  }, [invoices]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
  }, [customers]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.khataTx, JSON.stringify(khataTransactions));
  }, [khataTransactions]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.suppliers, JSON.stringify(suppliers));
  }, [suppliers]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.supplierTx, JSON.stringify(supplierTransactions));
  }, [supplierTransactions]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.heldBills, JSON.stringify(heldBills));
  }, [heldBills]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.shift, JSON.stringify(shift));
  }, [shift]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.langMode, JSON.stringify(langMode));
  }, [langMode]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.darkMode, JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.soundEnabled, JSON.stringify(soundEnabled));
  }, [soundEnabled]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.printerSettings, JSON.stringify(printerSettings));
  }, [printerSettings]);

  // Hydrate from Supabase & listen for Realtime multi-counter updates when configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    let syncTimer: number | null = null;

    const syncFromRemote = () => {
      fetchAllFromSupabase().then((remote) => {
        if (!active || !remote) return;
        if (remote.profile) setProfile(remote.profile);
        if (remote.printerSettings) setPrinterSettings(remote.printerSettings);
        if (remote.medicines?.length) setMedicines(remote.medicines);
        if (remote.batches?.length) setBatches(remote.batches);
        if (remote.customers?.length) setCustomers(remote.customers);
        if (remote.khataTransactions) setKhataTransactions(remote.khataTransactions);
        if (remote.suppliers?.length) setSuppliers(remote.suppliers);
        if (remote.supplierTransactions) setSupplierTransactions(remote.supplierTransactions);
        if (remote.purchaseOrders) setPurchaseOrders(remote.purchaseOrders);
        if (remote.heldBills) setHeldBills(remote.heldBills);
        if (remote.expenses) setExpenses(remote.expenses);
        if (remote.shift) setShift(remote.shift);
        if (remote.invoices) setInvoices(remote.invoices);
      });
    };

    syncFromRemote();
    const unsubscribe = subscribeToSupabaseChanges(() => {
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(syncFromRemote, 350);
    });

    return () => {
      active = false;
      if (syncTimer) window.clearTimeout(syncTimer);
      unsubscribe();
    };
  }, []);

  const inventoryAlertCount = useMemo(() => {
    const expiredOrNear = batches.filter(
      (b) => b.quantityUnits > 0 && !b.quarantined && daysUntilDate(b.expiryDate) <= 90
    ).length;
    const lowStock = medicines.filter(
      (m) => getTotalSellableUnits(m.id, batches) <= m.minStockUnits
    ).length;
    return expiredOrNear + lowStock;
  }, [medicines, batches]);

  const { todaySales, todayBillsCount } = useMemo(() => {
    let sales = 0;
    let count = 0;
    for (const inv of invoices) {
      if (inv.status === 'returned') continue;
      sales += inv.netPayable;
      count += 1;
    }
    return { todaySales: sales, todayBillsCount: count };
  }, [invoices]);

  // Add Medicine to POS Cart with FEFO Batch Validation
  const handleAddToCart = useCallback(
    (medicine: Medicine, requestedUnit?: SaleUnitType): { ok: boolean; message: string } => {
      const bestBatch = getBestFefoBatch(medicine.id, batches);
      if (!bestBatch) {
        const expired = getExpiredOrQuarantinedBatches(medicine.id, batches);
        playErrorBeep(soundEnabled);
        if (expired.length > 0) {
          const msg = `${medicine.nameEn}: Expired batch locked! Check substitutes or restock.`;
          showToast(false, msg);
          return { ok: false, message: msg };
        }
        const msg = `${medicine.nameEn}: Out of stock!`;
        showToast(false, msg);
        return { ok: false, message: msg };
      }

      const defaultUnit: SaleUnitType =
        requestedUnit ||
        (medicine.stripSize > 1 && medicine.stripSize < medicine.packSize ? 'strip' : 'pack');

      const pricing = calculateUnitPricing(medicine, defaultUnit);
      const maxUnitsForThisUnitType = Math.floor(
        bestBatch.quantityUnits / pricing.unitsPerSelectedUnit
      );

      const effectiveUnitType: SaleUnitType =
        maxUnitsForThisUnitType >= 1
          ? defaultUnit
          : medicine.allowLooseSale
          ? 'loose'
          : defaultUnit;
      const effectivePricing = calculateUnitPricing(medicine, effectiveUnitType);
      const maxAvailable = Math.floor(
        bestBatch.quantityUnits / effectivePricing.unitsPerSelectedUnit
      );

      if (maxAvailable < 1) {
        playErrorBeep(soundEnabled);
        const msg = `Insufficient units in batch ${bestBatch.batchNumber} for ${medicine.nameEn}`;
        showToast(false, msg);
        return { ok: false, message: msg };
      }

      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) =>
            item.medicineId === medicine.id &&
            item.batchId === bestBatch.id &&
            item.saleUnitType === effectiveUnitType
        );

        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          if (existing.quantity >= existing.maxAvailableSelectedUnits) return prev;
          const copy = [...prev];
          copy[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return copy;
        }

        const newItem: CartItem = {
          cartItemId: `${medicine.id}-${bestBatch.id}-${effectiveUnitType}-${Date.now()}`,
          medicineId: medicine.id,
          batchId: bestBatch.id,
          batchNumber: bestBatch.batchNumber,
          expiryDate: bestBatch.expiryDate,
          nameEn: medicine.nameEn,
          nameUr: medicine.nameUr,
          genericSalt: medicine.genericSalt,
          barcode: medicine.barcode,
          saleUnitType: effectiveUnitType,
          quantity: 1,
          unitsPerSelectedUnit: effectivePricing.unitsPerSelectedUnit,
          unitPrice: effectivePricing.unitPrice,
          costPerBaseUnit: effectivePricing.costPerBaseUnit,
          discountPercent: 0,
          maxAvailableSelectedUnits: maxAvailable,
          requiresPrescription: medicine.requiresPrescription,
        };
        return [newItem, ...prev];
      });

      playScanBeep(soundEnabled);
      const msg = `Added ${medicine.nameEn} (Batch ${bestBatch.batchNumber})`;
      showToast(true, msg);
      return { ok: true, message: msg };
    },
    [batches, soundEnabled, showToast]
  );

  const handleBarcodeScanned = useCallback(
    (rawCode: string): { ok: boolean; message: string } => {
      const code = rawCode.trim();
      const matched = medicines.find(
        (m) => m.barcode.toLowerCase() === code.toLowerCase()
      );
      if (!matched) {
        playErrorBeep(soundEnabled);
        const msg = `Barcode "${code}" not found in CurePlus catalog.`;
        showToast(false, msg);
        return { ok: false, message: msg };
      }
      setActiveTab('pos');
      return handleAddToCart(matched);
    },
    [medicines, handleAddToCart, soundEnabled, showToast]
  );

  // Global USB Keyboard-Wedge Barcode Listener & Shortcuts (F2 Search, F8 Scan)
  useEffect(() => {
    let buffer = '';
    let lastKeyTs = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
        setTimeout(() => searchInputRef.current?.focus(), 40);
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setScannerOpen(true);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isInputFocused) return;

      const now = Date.now();
      if (now - lastKeyTs > 80) buffer = '';
      lastKeyTs = now;

      if (e.key === 'Enter' && buffer.length >= 6) {
        e.preventDefault();
        const code = buffer;
        buffer = '';
        handleBarcodeScanned(code);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeScanned]);

  const handleUpdateCartItemQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: Math.min(item.maxAvailableSelectedUnits, nextQty) };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleChangeCartItemUnit = (cartItemId: string, newUnitType: SaleUnitType) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartItemId !== cartItemId) return item;
        const med = medicines.find((m) => m.id === item.medicineId);
        const batch = batches.find((b) => b.id === item.batchId);
        if (!med || !batch) return item;

        const pricing = calculateUnitPricing(med, newUnitType);
        const maxAvailable = Math.max(
          1,
          Math.floor(batch.quantityUnits / pricing.unitsPerSelectedUnit)
        );
        return {
          ...item,
          saleUnitType: newUnitType,
          unitsPerSelectedUnit: pricing.unitsPerSelectedUnit,
          unitPrice: pricing.unitPrice,
          maxAvailableSelectedUnits: maxAvailable,
          quantity: Math.min(item.quantity, maxAvailable),
        };
      })
    );
  };

  const handleUpdateCartItemDiscount = (cartItemId: string, discountPercent: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, discountPercent } : item
      )
    );
  };

  const handleUpdateCartItemDosage = (cartItemId: string, dosageLabel: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, dosageLabel } : item
      )
    );
  };

  const handleHoldCurrentBill = (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    doctorName: string;
    rxNumber: string;
    extraDiscountRs: number;
  }) => {
    if (cart.length === 0) return;
    const held: HeldBill = {
      id: `held-${Date.now()}`,
      label: payload.customerName || `Counter Hold #${heldBills.length + 1}`,
      heldAt: new Date().toISOString(),
      ...payload,
      cart,
    };
    setHeldBills((prev) => [held, ...prev]);
    setCart([]);
    void syncHeldBillUpsertToSupabase(held);
    showToast(true, `Bill parked as "${held.label}"`);
  };

  const handleResumeHeldBill = (heldBillId: string): HeldBill | null => {
    const target = heldBills.find((h) => h.id === heldBillId);
    if (!target) return null;
    setCart(target.cart);
    setHeldBills((prev) => prev.filter((h) => h.id !== heldBillId));
    void syncHeldBillDeleteToSupabase(heldBillId);
    showToast(true, `Resumed bill "${target.label}"`);
    return target;
  };

  const handleCompleteSale = (payload: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    doctorName: string;
    rxNumber: string;
    extraDiscountRs: number;
    taxPercent: number;
    paymentMethod: PaymentMethod;
    cashTendered: number;
  }) => {
    if (cart.length === 0) return;

    let rawSubtotal = 0;
    let totalItemDiscounts = 0;

    const invoiceItems = cart.map((item) => {
      const gross = item.unitPrice * item.quantity;
      const disc = (gross * item.discountPercent) / 100;
      const lineTotal = Math.round((gross - disc) * 100) / 100;
      const unitsDeducted = item.quantity * item.unitsPerSelectedUnit;
      const costTotal = Math.round(unitsDeducted * item.costPerBaseUnit * 100) / 100;

      rawSubtotal += gross;
      totalItemDiscounts += disc;

      return {
        medicineId: item.medicineId,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        nameEn: item.nameEn,
        nameUr: item.nameUr,
        saleUnitType: item.saleUnitType,
        quantity: item.quantity,
        unitsDeducted,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        lineTotal,
        costTotal,
        dosageLabel: item.dosageLabel,
        requiresPrescription: item.requiresPrescription,
      };
    });

    const afterItemDisc = Math.max(0, rawSubtotal - totalItemDiscounts);
    const safeExtraDisc = Math.min(afterItemDisc, payload.extraDiscountRs);
    const taxableBase = Math.max(0, afterItemDisc - safeExtraDisc);
    const taxAmount = Math.round(((taxableBase * payload.taxPercent) / 100) * 100) / 100;
    const netPayable = Math.max(0, Math.round((taxableBase + taxAmount) * 100) / 100);
    const changeDue =
      payload.paymentMethod === 'cash'
        ? Math.max(0, Math.round((payload.cashTendered - netPayable) * 100) / 100)
        : 0;

    // Deduct stock from batches
    setBatches((prev) =>
      prev.map((batch) => {
        const deducted = invoiceItems
          .filter((i) => i.batchId === batch.id)
          .reduce((sum, i) => sum + i.unitsDeducted, 0);
        if (deducted === 0) return batch;
        return { ...batch, quantityUnits: Math.max(0, batch.quantityUnits - deducted) };
      })
    );

    const nextSeq = 1001 + invoices.length;
    const newInvoice: SaleInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `CP-2026-${nextSeq}`,
      createdAt: new Date().toISOString(),
      cashierName: profile.cashierName,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      doctorName: payload.doctorName,
      rxNumber: payload.rxNumber,
      items: invoiceItems,
      subtotal: Math.round(rawSubtotal * 100) / 100,
      itemDiscounts: Math.round(totalItemDiscounts * 100) / 100,
      extraDiscountRs: safeExtraDisc,
      taxPercent: payload.taxPercent,
      taxAmount,
      netPayable,
      paymentMethod: payload.paymentMethod,
      cashTendered: payload.cashTendered,
      changeDue,
      status: 'completed',
    };

    // Update Customer Loyalty Points & Credit Khata if paid via Khata
    if (payload.customerId) {
      const earnedPoints = Math.floor(netPayable / 100);
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== payload.customerId) return c;
          return {
            ...c,
            loyaltyPoints: c.loyaltyPoints + earnedPoints,
            khataBalance:
              payload.paymentMethod === 'khata'
                ? Math.round((c.khataBalance + netPayable) * 100) / 100
                : c.khataBalance,
          };
        })
      );

      if (payload.paymentMethod === 'khata') {
        setKhataTransactions((prev) => [
          {
            id: `ktx-${Date.now()}`,
            customerId: payload.customerId!,
            date: newInvoice.createdAt,
            type: 'debit_sale',
            amount: netPayable,
            reference: newInvoice.invoiceNumber,
            note: `POS Credit Sale (${invoiceItems.length} items)`,
          },
          ...prev,
        ]);
      }
    }

    setInvoices((prev) => [newInvoice, ...prev]);
    setLastCompletedInvoice(newInvoice);
    setCart([]);
    setActiveReceipt(newInvoice);
    playScanBeep(soundEnabled);
    void syncCompleteSaleToSupabase(newInvoice);

    // Non-blocking Auto-Print trigger for paired hardware printer (Serial/BLE)
    if (!printerSettings.autoPrint) {
      setPrintStatus('off');
      showToast(true, `Invoice ${newInvoice.invoiceNumber} saved!`, true);
    } else if (printerSettings.transport === 'serial') {
      setPrintStatus('printing');
      showToast(true, `Invoice ${newInvoice.invoiceNumber} saved — Printing...`, true);
      executePrintJob(printerSettings, (w) =>
        renderInvoiceEscPosBlocks(newInvoice, profile, w)
      ).then((res) => {
        setPrintStatus(res.ok ? 'done' : 'failed');
        if (!res.ok) {
          showToast(false, `Saved! Print failed: ${res.message}`, true);
        }
      });
    } else {
      setPrintStatus(printerSettings.printerName ? 'done' : 'no_printer');
      showToast(true, `Invoice ${newInvoice.invoiceNumber} saved — Print Sheet ready!`, true);
    }
  };

  const handleReturnInvoice = (invoiceId: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target || target.status === 'returned') return;

    setBatches((prev) =>
      prev.map((batch) => {
        const restored = target.items
          .filter((i) => i.batchId === batch.id)
          .reduce((s, i) => s + i.unitsDeducted, 0);
        if (restored === 0) return batch;
        return { ...batch, quantityUnits: batch.quantityUnits + restored };
      })
    );

    if (target.customerId && target.paymentMethod === 'khata') {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === target.customerId
            ? { ...c, khataBalance: Math.max(0, c.khataBalance - target.netPayable) }
            : c
        )
      );
      setKhataTransactions((prev) => [
        {
          id: `ktx-${Date.now()}`,
          customerId: target.customerId!,
          date: new Date().toISOString(),
          type: 'return_adjustment',
          amount: target.netPayable,
          reference: target.invoiceNumber,
          note: 'Returned bill credit adjustment',
        },
        ...prev,
      ]);
    }

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: 'returned', returnedAt: new Date().toISOString() }
          : inv
      )
    );
    void syncReturnInvoiceToSupabase(invoiceId);

    showToast(true, `Invoice ${target.invoiceNumber} returned & batch stock restored.`);
  };

  // Inventory & Batch Handlers
  const handleSaveMedicine = (
    med: Medicine,
    initialBatch?: Omit<MedicineBatch, 'id' | 'medicineId'>
  ) => {
    setMedicines((prev) => {
      const exists = prev.some((m) => m.id === med.id);
      return exists ? prev.map((m) => (m.id === med.id ? med : m)) : [med, ...prev];
    });
    void syncMedicineUpsertToSupabase(med);
    if (initialBatch) {
      const createdBatch: MedicineBatch = { id: `bat-${Date.now()}`, medicineId: med.id, ...initialBatch };
      setBatches((prev) => [createdBatch, ...prev]);
      void syncBatchInsertToSupabase(createdBatch);
    }
    showToast(true, `Saved ${med.nameEn}`);
  };

  const handleSaveBatch = (
    medicineId: string,
    batch: Omit<MedicineBatch, 'id' | 'medicineId'>
  ) => {
    const createdBatch: MedicineBatch = { id: `bat-${Date.now()}`, medicineId, ...batch };
    setBatches((prev) => [createdBatch, ...prev]);
    void syncBatchInsertToSupabase(createdBatch);
    showToast(true, `Received batch ${batch.batchNumber} (${batch.quantityUnits} units)`);
  };

  const handleQuarantineBatch = (batchId: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, quarantined: true } : b))
    );
    void syncBatchQuarantineToSupabase(batchId);
    showToast(true, 'Batch quarantined and locked from counter dispensing.');
  };

  // Supplier & Purchase Order (GRN) Handlers
  const handleAddSupplier = (sup: Omit<Supplier, 'id'>) => {
    const created: Supplier = { id: `sup-${Date.now()}`, ...sup };
    setSuppliers((prev) => [created, ...prev]);
    void syncSupplierInsertToSupabase(created);
    showToast(true, `Added distributor ${sup.name}`);
  };

  const handlePaySupplier = (
    supplierId: string,
    amount: number,
    collectedBy?: string,
    note?: string
  ) => {
    const cleanAmt = Math.max(0, Math.round(amount * 100) / 100);
    if (cleanAmt <= 0) return;

    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? { ...s, payableBalance: Math.max(0, Math.round((s.payableBalance - cleanAmt) * 100) / 100) }
          : s
      )
    );
    setSupplierTransactions((prev) => [
      {
        id: `stx-${Date.now()}`,
        supplierId,
        date: new Date().toISOString(),
        type: 'payment',
        amount: cleanAmt,
        paidAmount: cleanAmt,
        deliveredBy: collectedBy?.trim() || 'Counter Cash / Bank Transfer',
        reference: `PAY-${String(Date.now()).slice(-5)}`,
        note: note?.trim() || 'Distributor balance payment',
      },
      ...prev,
    ]);
    void syncSupplierPaymentToSupabase(supplierId, cleanAmt, collectedBy, note);
    showToast(true, `Recorded supplier payment of ${formatPKR(cleanAmt)}`);
  };

  const handleCreatePO = (po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'status'>) => {
    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-2026-${401 + purchaseOrders.length}`,
      createdAt: new Date().toISOString(),
      status: 'ordered',
      ...po,
    };
    setPurchaseOrders((prev) => [newPo, ...prev]);
    void syncCreatePOToSupabase(newPo);
    showToast(true, `Created Purchase Order ${newPo.poNumber}`);
  };

  const handleReceivePO = (
    poId: string,
    supplierInvoiceNo: string,
    deliveredBy?: string,
    paidNow = 0
  ) => {
    const targetPo = purchaseOrders.find((p) => p.id === poId);
    if (!targetPo || targetPo.status === 'received') return;

    const now = new Date().toISOString();
    const safePaid = Math.min(targetPo.totalAmount, Math.max(0, paidNow));
    const creditAdded = Math.max(0, targetPo.totalAmount - safePaid);
    const riderName = deliveredBy?.trim() || 'Supplier Delivery Van';

    const newBatches: MedicineBatch[] = targetPo.items.map((item, idx) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      const packSize = med?.packSize || 1;
      const totalUnits = (item.packsOrdered + item.bonusPacks) * packSize;
      return {
        id: `bat-grn-${Date.now()}-${idx}`,
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        mfgDate: item.mfgDate,
        expiryDate: item.expiryDate,
        quantityUnits: totalUnits,
      };
    });

    setBatches((prev) => [...newBatches, ...prev]);
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'received',
              supplierInvoiceNo,
              deliveredBy: riderName,
              paidAmount: safePaid,
              receivedAt: now,
            }
          : p
      )
    );
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === targetPo.supplierId
          ? { ...s, payableBalance: Math.round((s.payableBalance + creditAdded) * 100) / 100 }
          : s
      )
    );
    setSupplierTransactions((prev) => [
      {
        id: `stx-${Date.now()}`,
        supplierId: targetPo.supplierId,
        date: now,
        type: 'delivery',
        amount: targetPo.totalAmount,
        paidAmount: safePaid,
        deliveredBy: riderName,
        reference: supplierInvoiceNo,
        note: `${targetPo.poNumber} (${targetPo.items.length} items) received into stock`,
      },
      ...prev,
    ]);
    void syncReceivePOToSupabase(poId, supplierInvoiceNo, riderName, safePaid);
    showToast(true, `GRN Completed: ${targetPo.poNumber} added to FEFO stock!`);
  };

  const handleRecordDirectSupply = (payload: {
    supplierId: string;
    deliveredBy: string;
    supplierInvoiceNo: string;
    items: PurchaseOrderItem[];
    paidNow: number;
    notes?: string;
  }) => {
    const supplier = suppliers.find((s) => s.id === payload.supplierId);
    if (!supplier || payload.items.length === 0) return;

    const now = new Date().toISOString();
    const totalAmount = payload.items.reduce(
      (sum, item) => sum + item.packsOrdered * item.costPerPack,
      0
    );
    const safePaid = Math.min(totalAmount, Math.max(0, payload.paidNow));
    const unpaidBalance = Math.max(0, Math.round((totalAmount - safePaid) * 100) / 100);
    const deliveryNo = `DEL-2026-${401 + purchaseOrders.length}`;
    const invoiceRef = payload.supplierInvoiceNo.trim() || `CH-${String(Date.now()).slice(-5)}`;
    const riderName = payload.deliveredBy.trim() || supplier.contactPerson || 'Delivery Rider';

    const newBatches: MedicineBatch[] = payload.items.map((item, idx) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      const packSize = med?.packSize || 1;
      const totalUnits = (item.packsOrdered + item.bonusPacks) * packSize;
      return {
        id: `bat-sup-${Date.now()}-${idx}`,
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        mfgDate: item.mfgDate,
        expiryDate: item.expiryDate,
        quantityUnits: totalUnits,
      };
    });

    const newDeliveryPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: deliveryNo,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierInvoiceNo: invoiceRef,
      deliveredBy: riderName,
      notes: payload.notes?.trim() || undefined,
      createdAt: now,
      receivedAt: now,
      status: 'received',
      items: payload.items,
      totalAmount,
      paidAmount: safePaid,
    };

    const itemsSummary = payload.items
      .slice(0, 2)
      .map((i) => `${i.medicineNameEn} (${i.packsOrdered}${i.bonusPacks > 0 ? `+${i.bonusPacks}` : ''} Box)`)
      .join(', ');
    const moreSuffix = payload.items.length > 2 ? ` +${payload.items.length - 2} more` : '';

    setBatches((prev) => [...newBatches, ...prev]);
    setPurchaseOrders((prev) => [newDeliveryPo, ...prev]);
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplier.id
          ? { ...s, payableBalance: Math.round((s.payableBalance + unpaidBalance) * 100) / 100 }
          : s
      )
    );
    setSupplierTransactions((prev) => [
      {
        id: `stx-${Date.now()}`,
        supplierId: supplier.id,
        date: now,
        type: 'delivery',
        amount: totalAmount,
        paidAmount: safePaid,
        deliveredBy: riderName,
        reference: invoiceRef,
        note: `${itemsSummary}${moreSuffix}${payload.notes ? ` · ${payload.notes}` : ''}`,
      },
      ...prev,
    ]);
    void syncSupplierDeliveryToSupabase(newDeliveryPo);

    showToast(
      true,
      `Stock Received from ${supplier.name} (${formatPKR(totalAmount)}) — Added to inventory!`
    );
  };

  // Customer & Khata Handlers
  const handleAddCustomer = (cust: Omit<CustomerProfile, 'id'>) => {
    const created: CustomerProfile = { id: `cust-${Date.now()}`, ...cust };
    setCustomers((prev) => [created, ...prev]);
    void syncCustomerInsertToSupabase(created);
    showToast(true, `Added patient profile for ${cust.name}`);
  };

  const handleRecordKhataPayment = (customerId: string, amount: number, note: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, khataBalance: Math.max(0, Math.round((c.khataBalance - amount) * 100) / 100) }
          : c
      )
    );
    setKhataTransactions((prev) => [
      {
        id: `ktx-${Date.now()}`,
        customerId,
        date: new Date().toISOString(),
        type: 'credit_payment',
        amount,
        reference: 'CASH-RCV',
        note: note || 'Counter recovery',
      },
      ...prev,
    ]);
    void syncKhataPaymentToSupabase(customerId, amount, note);
    showToast(true, `Received ${formatPKR(amount)} towards Khata balance`);
  };

  // Shift & Expense Handlers
  const handleAddExpense = (exp: Omit<PettyExpense, 'id' | 'createdAt' | 'recordedBy'>) => {
    const created: PettyExpense = {
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      recordedBy: profile.cashierName,
      ...exp,
    };
    setExpenses((prev) => [created, ...prev]);
    void syncExpenseInsertToSupabase(created, shift.id);
    showToast(true, `Expense recorded: ${formatPKR(exp.amount)}`);
  };

  const handleCloseShift = (actualCashCounted: number) => {
    const closedShift: CashShift = {
      ...shift,
      status: 'closed',
      closedAt: new Date().toISOString(),
      actualClosingCash: actualCashCounted,
    };
    setShift(closedShift);
    void syncShiftUpsertToSupabase(closedShift);
    showToast(true, 'Shift closed and Z-Report ready.');
  };

  const handleReopenNewShift = (openingFloat: number) => {
    const nextShift: CashShift = {
      id: `shift-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openedBy: profile.cashierName,
      openingFloat,
      status: 'open',
    };
    setShift(nextShift);
    void syncShiftUpsertToSupabase(nextShift);
    showToast(true, `New shift opened with ${formatPKR(openingFloat)} float.`);
  };

  const handleResetDemo = () => {
    setProfile(DEFAULT_PHARMACY_PROFILE);
    setMedicines(SEED_MEDICINES);
    setBatches(SEED_BATCHES);
    setInvoices(SEED_INVOICES);
    setCustomers(SEED_CUSTOMERS);
    setKhataTransactions(SEED_KHATA_TX);
    setSuppliers(SEED_SUPPLIERS);
    setSupplierTransactions(SEED_SUPPLIER_TX);
    setPurchaseOrders(SEED_PURCHASE_ORDERS);
    setHeldBills([]);
    setExpenses(SEED_EXPENSES);
    setShift(SEED_SHIFT);
    setCart([]);
    showToast(true, 'CurePlus Pharmacy demo data restored.');
  };

  const handleOpenPrinterSetup = () => {
    if (invoices.length > 0) {
      setActiveReceipt(invoices[0]);
      return;
    }
    const sampleTestReceipt: SaleInvoice = {
      id: 'inv-test-printer',
      invoiceNumber: 'CP-TEST-0001',
      createdAt: new Date().toISOString(),
      cashierName: profile.cashierName,
      customerName: 'Printer Test Customer',
      customerPhone: '0300-0000000',
      doctorName: '',
      items: [
        {
          medicineId: 'med-panadol-500',
          batchId: 'bat-test',
          batchNumber: 'TEST-01',
          expiryDate: '2027-12-31',
          nameEn: 'Panadol 500mg Tablet',
          nameUr: 'پیناڈول 500 ملی گرام گولی',
          saleUnitType: 'strip',
          quantity: 2,
          unitsDeducted: 20,
          unitPrice: 34,
          discountPercent: 0,
          lineTotal: 68,
          costTotal: 56,
        },
      ],
      subtotal: 68,
      itemDiscounts: 0,
      extraDiscountRs: 0,
      taxPercent: 0,
      taxAmount: 0,
      netPayable: 68,
      paymentMethod: 'cash',
      cashTendered: 100,
      changeDue: 32,
      status: 'completed',
    };
    setActiveReceipt(sampleTestReceipt);
  };

  const navItems: Array<{
    key: ViewTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      key: 'pos',
      label: langMode === 'ur' ? UI_COPY.nav.pos.ur : UI_COPY.nav.pos.en,
      icon: ShoppingCart,
    },
    {
      key: 'inventory',
      label: langMode === 'ur' ? UI_COPY.nav.inventory.ur : UI_COPY.nav.inventory.en,
      icon: Boxes,
      badge: inventoryAlertCount,
    },
    {
      key: 'khata',
      label: langMode === 'ur' ? UI_COPY.nav.khata.ur : UI_COPY.nav.khata.en,
      icon: BookOpenCheck,
    },
    {
      key: 'shift',
      label: langMode === 'ur' ? UI_COPY.nav.shift.ur : UI_COPY.nav.shift.en,
      icon: ClipboardCheck,
    },
    {
      key: 'reports',
      label: langMode === 'ur' ? UI_COPY.nav.reports.ur : UI_COPY.nav.reports.en,
      icon: BarChart3,
    },
  ];

  return (
    <div
      dir={langMode === 'ur' ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-[#F5F7F6] dark:bg-[#090D12] text-slate-900 dark:text-slate-100 pb-20 md:pb-8"
    >
      {/* Top Bar Contract: 3-Zone Header (Brand Wordmark | 5 Single-Line Links | 1 Primary Scan Action) */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="font-display font-bold text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              +
            </span>
            <span>{profile.nameEn}</span>
          </button>

          <nav className="hidden md:flex items-center gap-6" aria-label="Primary Navigation">
            {navItems.map(({ key, label, badge }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{label}</span>
                  {typeof badge === 'number' && badge > 0 && (
                    <span className="ml-1.5 font-mono-num text-xs text-amber-600 dark:text-amber-400 font-semibold">
                      ({badge})
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-[17px] h-0.5 bg-emerald-600 dark:bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <ScanBarcode className="w-4 h-4 shrink-0" />
              <span>
                {langMode === 'ur' ? UI_COPY.header.scanBarcode.ur : UI_COPY.header.scanBarcode.en}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Bilingual Store Sub-bar & Workspace Utility Controls */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-urdu-nastaliq text-sm font-bold text-emerald-700 dark:text-emerald-400" dir="rtl">
              {profile.nameUr}
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
            <span className="text-slate-600 dark:text-slate-400">{profile.addressEn}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="hidden sm:inline font-mono-num text-slate-500 dark:text-slate-400">
              {profile.drapLicense}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Languages className="w-3.5 h-3.5 text-slate-500 mx-1.5 shrink-0" />
              {(
                [
                  { mode: 'bilingual', label: 'EN + اردو' },
                  { mode: 'en', label: 'English' },
                  { mode: 'ur', label: 'اردو' },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLangMode(mode)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
                    langMode === mode
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Mute scanner beep' : 'Enable scanner beep'}
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              aria-label="Toggle scanner sound"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title="Toggle light/dark shift theme"
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleOpenPrinterSetup}
              title="Connect & configure 58mm / 80mm thermal printer"
              className="h-8 px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {langMode === 'ur'
                  ? `پرنٹر (${printerSettings.paperWidthChars === 32 ? '58mm' : '80mm'})`
                  : `Printer (${printerSettings.paperWidthChars === 32 ? '58mm' : '80mm'})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              title="Easy bilingual user guide"
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{langMode === 'ur' ? 'رہنمائی' : 'Guide'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset catalog & stock"
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'pos' && (
          <PosCounterView
            langMode={langMode}
            medicines={medicines}
            batches={batches}
            customers={customers}
            cart={cart}
            heldBills={heldBills}
            defaultTaxPercent={profile.defaultTaxPercent}
            todaySales={todaySales}
            todayBillsCount={todayBillsCount}
            searchInputRef={searchInputRef}
            onOpenScanner={() => setScannerOpen(true)}
            onAddToCart={(med, unit) => handleAddToCart(med, unit)}
            onUpdateCartItemQty={handleUpdateCartItemQty}
            onChangeCartItemUnit={handleChangeCartItemUnit}
            onUpdateCartItemDiscount={handleUpdateCartItemDiscount}
            onUpdateCartItemDosage={handleUpdateCartItemDosage}
            onRemoveCartItem={(id) => setCart((prev) => prev.filter((i) => i.cartItemId !== id))}
            onClearCart={() => setCart([])}
            onHoldCurrentBill={handleHoldCurrentBill}
            onResumeHeldBill={handleResumeHeldBill}
            onDeleteHeldBill={(id) => {
              setHeldBills((prev) => prev.filter((h) => h.id !== id));
              void syncHeldBillDeleteToSupabase(id);
            }}
            onOpenSubstitutes={(med) => setSubstitutesSource(med)}
            onQuickAddMedicine={() =>
              setFormModalState({ open: true, mode: 'add_medicine', medicine: null })
            }
            onJumpToInventory={() => setActiveTab('inventory')}
            onJumpToReports={() => setActiveTab('reports')}
            onCompleteSale={handleCompleteSale}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            langMode={langMode}
            medicines={medicines}
            batches={batches}
            suppliers={suppliers}
            supplierTransactions={supplierTransactions}
            purchaseOrders={purchaseOrders}
            onAddMedicine={() =>
              setFormModalState({ open: true, mode: 'add_medicine', medicine: null })
            }
            onEditMedicine={(med) =>
              setFormModalState({ open: true, mode: 'edit_medicine', medicine: med })
            }
            onAddBatch={(med) =>
              setFormModalState({ open: true, mode: 'add_batch', medicine: med })
            }
            onPrintBarcode={(med, batch) => setLabelModalTarget({ medicine: med, batch })}
            onQuarantineBatch={handleQuarantineBatch}
            onAddSupplier={handleAddSupplier}
            onPaySupplier={handlePaySupplier}
            onCreatePO={handleCreatePO}
            onReceivePO={handleReceivePO}
            onRecordDirectSupply={handleRecordDirectSupply}
          />
        )}

        {activeTab === 'khata' && (
          <CustomersKhataView
            langMode={langMode}
            customers={customers}
            khataTransactions={khataTransactions}
            onAddCustomer={handleAddCustomer}
            onRecordKhataPayment={handleRecordKhataPayment}
          />
        )}

        {activeTab === 'shift' && (
          <ShiftRegisterView
            langMode={langMode}
            profile={profile}
            printerSettings={printerSettings}
            shift={shift}
            invoices={invoices}
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onCloseShift={handleCloseShift}
            onReopenNewShift={handleReopenNewShift}
            onOpenZReportShare={() =>
              setReportShareModal({ open: true, type: 'shift_zreport' })
            }
          />
        )}

        {activeTab === 'reports' && (
          <ReportsSettingsView
            langMode={langMode}
            profile={profile}
            printerSettings={printerSettings}
            medicines={medicines}
            batches={batches}
            invoices={invoices}
            expenses={expenses}
            onReprintInvoice={(inv) => setActiveReceipt(inv)}
            onReturnInvoice={handleReturnInvoice}
            onSaveProfile={(next) => {
              setProfile(next);
              void syncProfileAndPrinterToSupabase(next, printerSettings);
              showToast(true, 'Store settings updated.');
            }}
            onOpenPrinterSetup={handleOpenPrinterSetup}
            onOpenReportShare={(type) => setReportShareModal({ open: true, type })}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
        aria-label="Mobile Navigation"
      >
        {navItems.map(({ key, label, icon: Icon, badge }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`h-full flex flex-col items-center justify-center relative transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {typeof badge === 'number' && badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 font-mono-num text-[9px] font-bold text-amber-600 dark:text-amber-400">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[66px]">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification with Print Status & 1-Tap Reprint */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border flex items-center justify-between gap-3 text-xs font-medium ${
            toast.ok
              ? 'bg-slate-900 dark:bg-emerald-950 text-white border-slate-800 dark:border-emerald-800'
              : 'bg-rose-700 text-white border-rose-600'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <TriangleAlert className="w-4 h-4 text-white shrink-0" />
            )}
            <span className="truncate">{toast.text}</span>
          </div>
          {toast.showReprint && lastCompletedInvoice && (
            <button
              type="button"
              onClick={() => setActiveReceipt(lastCompletedInvoice)}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold shrink-0"
            >
              Reprint ({printStatus})
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanCode={handleBarcodeScanned}
        medicines={medicines}
        langMode={langMode}
      />

      <ThermalReceiptModal
        invoice={activeReceipt}
        profile={profile}
        printerSettings={printerSettings}
        printStatus={printStatus}
        onUpdatePrinterSettings={(next) => {
          setPrinterSettings(next);
          void syncProfileAndPrinterToSupabase(profile, next);
        }}
        onPrintStatusChange={setPrintStatus}
        onClose={() => setActiveReceipt(null)}
      />

      <BarcodeLabelModal
        medicine={labelModalTarget?.medicine || null}
        batch={labelModalTarget?.batch || null}
        onClose={() => setLabelModalTarget(null)}
      />

      <MedicineFormModal
        isOpen={formModalState.open}
        mode={formModalState.mode}
        initialMedicine={formModalState.medicine}
        onClose={() => setFormModalState({ open: false, mode: 'add_medicine', medicine: null })}
        onSaveMedicine={handleSaveMedicine}
        onSaveBatch={handleSaveBatch}
      />

      <SubstitutesModal
        sourceMedicine={substitutesSource}
        allMedicines={medicines}
        batches={batches}
        onClose={() => setSubstitutesSource(null)}
        onAddSubstitute={(med) => handleAddToCart(med)}
      />

      <QuickGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        onOpenAddMedicine={() =>
          setFormModalState({ open: true, mode: 'add_medicine', medicine: null })
        }
        onOpenPrinterSetup={handleOpenPrinterSetup}
      />

      <ReportShareModal
        isOpen={reportShareModal.open}
        initialReportType={reportShareModal.type}
        sourceData={{
          profile,
          medicines,
          batches,
          invoices,
          expenses,
          shift,
          suppliers,
          supplierTransactions,
          purchaseOrders,
          customers,
        }}
        onClose={() => setReportShareModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
