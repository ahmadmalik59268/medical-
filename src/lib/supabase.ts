import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CashShift,
  CustomerProfile,
  HeldBill,
  KhataTransaction,
  Medicine,
  MedicineBatch,
  PettyExpense,
  PharmacyProfile,
  PrinterSettings,
  PurchaseOrder,
  PurchaseOrderItem,
  SaleInvoice,
  Supplier,
  SupplierTransaction,
} from '../types/pharmacy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('http') &&
      !supabaseUrl.includes('YOUR_PROJECT_ID')
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export interface HydratedPharmacyStore {
  profile?: PharmacyProfile;
  printerSettings?: PrinterSettings;
  medicines?: Medicine[];
  batches?: MedicineBatch[];
  customers?: CustomerProfile[];
  khataTransactions?: KhataTransaction[];
  suppliers?: Supplier[];
  supplierTransactions?: SupplierTransaction[];
  purchaseOrders?: PurchaseOrder[];
  heldBills?: HeldBill[];
  expenses?: PettyExpense[];
  shift?: CashShift;
  invoices?: SaleInvoice[];
}

export async function fetchAllFromSupabase(): Promise<HydratedPharmacyStore | null> {
  if (!supabase) return null;

  try {
    const [
      profileRes,
      medsRes,
      batchesRes,
      custRes,
      ktxRes,
      supRes,
      stxRes,
      poRes,
      poItemsRes,
      heldRes,
      expRes,
      shiftRes,
      invRes,
      invItemsRes,
    ] = await Promise.all([
      supabase.from('pharmacy_profiles').select('*').eq('id', 'default').maybeSingle(),
      supabase.from('medicines').select('*').order('name_en'),
      supabase.from('medicine_batches').select('*').order('expiry_date'),
      supabase.from('customers').select('*').order('name'),
      supabase.from('khata_transactions').select('*').order('tx_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_transactions').select('*').order('tx_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('purchase_order_items').select('*'),
      supabase.from('held_bills').select('*').order('held_at', { ascending: false }),
      supabase.from('petty_expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('cash_shifts').select('*').order('opened_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('sale_invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('sale_invoice_items').select('*'),
    ]);

    if (medsRes.error) return null;

    const out: HydratedPharmacyStore = {};

    if (profileRes.data) {
      const p = profileRes.data;
      out.profile = {
        nameEn: p.name_en,
        nameUr: p.name_ur,
        taglineEn: p.tagline_en,
        taglineUr: p.tagline_ur,
        drapLicense: p.drap_license,
        ntnNumber: p.ntn_number,
        addressEn: p.address_en,
        addressUr: p.address_ur,
        phone: p.phone,
        cashierName: p.cashier_name,
        defaultTaxPercent: Number(p.default_tax_percent || 0),
        receiptFooterEn: p.receipt_footer_en,
        receiptFooterUr: p.receipt_footer_ur,
      };
      out.printerSettings = {
        transport: p.printer_transport,
        printerName: p.printer_name,
        paperWidthChars: p.paper_width_chars === 32 ? 32 : 48,
        autoPrint: Boolean(p.auto_print),
        baudRate: p.baud_rate === 115200 ? 115200 : 9600,
        receiptFormat: p.receipt_format === 'escpos_mono' ? 'escpos_mono' : 'bilingual_rich',
      };
    }

    if (medsRes.data?.length) {
      out.medicines = medsRes.data.map((m) => ({
        id: m.id,
        barcode: m.barcode,
        nameEn: m.name_en,
        nameUr: m.name_ur,
        genericSalt: m.generic_salt,
        manufacturer: m.manufacturer,
        category: m.category,
        rackLocation: m.rack_location,
        packSize: m.pack_size,
        stripSize: m.strip_size,
        allowLooseSale: m.allow_loose_sale,
        mrpPerPack: Number(m.mrp_per_pack),
        costPerPack: Number(m.cost_per_pack),
        minStockUnits: m.min_stock_units,
        requiresPrescription: m.requires_prescription,
      }));
    }

    if (batchesRes.data) {
      out.batches = batchesRes.data.map((b) => ({
        id: b.id,
        medicineId: b.medicine_id,
        batchNumber: b.batch_number,
        mfgDate: b.mfg_date,
        expiryDate: b.expiry_date,
        quantityUnits: b.quantity_units,
        quarantined: Boolean(b.quarantined),
      }));
    }

    if (custRes.data) {
      out.customers = custRes.data.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address || '',
        allergies: c.allergies || '',
        chronicNotes: c.chronic_notes || '',
        creditLimit: Number(c.credit_limit),
        khataBalance: Number(c.khata_balance),
        loyaltyPoints: c.loyalty_points,
      }));
    }

    if (ktxRes.data) {
      out.khataTransactions = ktxRes.data.map((k) => ({
        id: k.id,
        customerId: k.customer_id,
        date: k.tx_date,
        type: k.type,
        amount: Number(k.amount),
        reference: k.reference,
        note: k.note,
      }));
    }

    if (supRes.data) {
      out.suppliers = supRes.data.map((s) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person,
        phone: s.phone,
        city: s.city,
        ntnOrLicense: s.ntn_or_license,
        payableBalance: Number(s.payable_balance),
      }));
    }

    if (stxRes.data) {
      out.supplierTransactions = stxRes.data.map((t) => ({
        id: t.id,
        supplierId: t.supplier_id,
        date: t.tx_date,
        type: t.type,
        amount: Number(t.amount),
        paidAmount: t.paid_amount != null ? Number(t.paid_amount) : undefined,
        deliveredBy: t.delivered_by || undefined,
        reference: t.reference,
        note: t.note,
      }));
    }

    if (poRes.data) {
      const itemsByPo = new Map<string, PurchaseOrderItem[]>();
      for (const row of poItemsRes.data || []) {
        const list = itemsByPo.get(row.purchase_order_id) || [];
        list.push({
          medicineId: row.medicine_id,
          medicineNameEn: row.medicine_name_en,
          batchNumber: row.batch_number,
          mfgDate: row.mfg_date,
          expiryDate: row.expiry_date,
          packsOrdered: row.packs_ordered,
          bonusPacks: row.bonus_packs,
          costPerPack: Number(row.cost_per_pack),
        });
        itemsByPo.set(row.purchase_order_id, list);
      }

      out.purchaseOrders = poRes.data.map((p) => ({
        id: p.id,
        poNumber: p.po_number,
        supplierId: p.supplier_id,
        supplierName: p.supplier_name,
        supplierInvoiceNo: p.supplier_invoice_no,
        deliveredBy: p.delivered_by || undefined,
        notes: p.notes || undefined,
        createdAt: p.created_at,
        receivedAt: p.received_at || undefined,
        status: p.status,
        items: itemsByPo.get(p.id) || [],
        totalAmount: Number(p.total_amount),
        paidAmount: Number(p.paid_amount),
      }));
    }

    if (heldRes.data) {
      out.heldBills = heldRes.data.map((h) => ({
        id: h.id,
        label: h.label,
        heldAt: h.held_at,
        customerId: h.customer_id || undefined,
        customerName: h.customer_name,
        customerPhone: h.customer_phone,
        doctorName: h.doctor_name,
        rxNumber: h.rx_number,
        extraDiscountRs: Number(h.extra_discount_rs),
        cart: Array.isArray(h.cart_json) ? h.cart_json : [],
      }));
    }

    if (expRes.data) {
      out.expenses = expRes.data.map((e) => ({
        id: e.id,
        createdAt: e.created_at,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        recordedBy: e.recorded_by,
      }));
    }

    if (shiftRes.data) {
      const sh = shiftRes.data;
      out.shift = {
        id: sh.id,
        openedAt: sh.opened_at,
        closedAt: sh.closed_at || undefined,
        openedBy: sh.opened_by,
        openingFloat: Number(sh.opening_float),
        actualClosingCash:
          sh.actual_closing_cash != null ? Number(sh.actual_closing_cash) : undefined,
        status: sh.status,
      };
    }

    if (invRes.data) {
      const itemsByInv = new Map<string, SaleInvoice['items']>();
      for (const row of invItemsRes.data || []) {
        const list = itemsByInv.get(row.invoice_id) || [];
        list.push({
          medicineId: row.medicine_id,
          batchId: row.batch_id,
          batchNumber: row.batch_number,
          expiryDate: row.expiry_date,
          nameEn: row.name_en,
          nameUr: row.name_ur,
          saleUnitType: row.sale_unit_type,
          quantity: row.quantity,
          unitsDeducted: row.units_deducted,
          unitPrice: Number(row.unit_price),
          discountPercent: Number(row.discount_percent),
          lineTotal: Number(row.line_total),
          costTotal: Number(row.cost_total),
          dosageLabel: row.dosage_label || undefined,
          requiresPrescription: Boolean(row.requires_prescription),
        });
        itemsByInv.set(row.invoice_id, list);
      }

      out.invoices = invRes.data.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        createdAt: inv.created_at,
        cashierName: inv.cashier_name,
        customerId: inv.customer_id || undefined,
        customerName: inv.customer_name,
        customerPhone: inv.customer_phone,
        doctorName: inv.doctor_name,
        rxNumber: inv.rx_number || undefined,
        items: itemsByInv.get(inv.id) || [],
        subtotal: Number(inv.subtotal),
        itemDiscounts: Number(inv.item_discounts),
        extraDiscountRs: Number(inv.extra_discount_rs),
        taxPercent: Number(inv.tax_percent),
        taxAmount: Number(inv.tax_amount),
        netPayable: Number(inv.net_payable),
        paymentMethod: inv.payment_method,
        cashTendered: Number(inv.cash_tendered),
        changeDue: Number(inv.change_due),
        status: inv.status,
        returnedAt: inv.returned_at || undefined,
      }));
    }

    return out;
  } catch {
    return null;
  }
}

export async function syncCompleteSaleToSupabase(inv: SaleInvoice): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('complete_pharmacy_sale', {
    p_payload: {
      id: inv.id,
      invoice_number: inv.invoiceNumber,
      created_at: inv.createdAt,
      cashier_name: inv.cashierName,
      customer_id: inv.customerId || null,
      customer_name: inv.customerName,
      customer_phone: inv.customerPhone,
      doctor_name: inv.doctorName,
      rx_number: inv.rxNumber || '',
      subtotal: inv.subtotal,
      item_discounts: inv.itemDiscounts,
      extra_discount_rs: inv.extraDiscountRs,
      tax_percent: inv.taxPercent,
      tax_amount: inv.taxAmount,
      net_payable: inv.netPayable,
      payment_method: inv.paymentMethod,
      cash_tendered: inv.cashTendered,
      change_due: inv.changeDue,
      items: inv.items.map((i) => ({
        medicine_id: i.medicineId,
        batch_id: i.batchId,
        batch_number: i.batchNumber,
        expiry_date: i.expiryDate,
        name_en: i.nameEn,
        name_ur: i.nameUr,
        sale_unit_type: i.saleUnitType,
        quantity: i.quantity,
        units_deducted: i.unitsDeducted,
        unit_price: i.unitPrice,
        discount_percent: i.discountPercent,
        line_total: i.lineTotal,
        cost_total: i.costTotal,
        dosage_label: i.dosageLabel || '',
        requires_prescription: Boolean(i.requiresPrescription),
      })),
    },
  });
}

export async function syncReturnInvoiceToSupabase(invoiceId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('return_pharmacy_invoice', { p_invoice_id: invoiceId });
}

export async function syncMedicineUpsertToSupabase(med: Medicine): Promise<void> {
  if (!supabase) return;
  await supabase.from('medicines').upsert({
    id: med.id,
    barcode: med.barcode,
    name_en: med.nameEn,
    name_ur: med.nameUr,
    generic_salt: med.genericSalt,
    manufacturer: med.manufacturer,
    category: med.category,
    rack_location: med.rackLocation,
    pack_size: med.packSize,
    strip_size: med.stripSize,
    allow_loose_sale: med.allowLooseSale,
    mrp_per_pack: med.mrpPerPack,
    cost_per_pack: med.costPerPack,
    min_stock_units: med.minStockUnits,
    requires_prescription: med.requiresPrescription,
  });
}

export async function syncBatchInsertToSupabase(batch: MedicineBatch): Promise<void> {
  if (!supabase) return;
  await supabase.from('medicine_batches').upsert({
    id: batch.id,
    medicine_id: batch.medicineId,
    batch_number: batch.batchNumber,
    mfg_date: batch.mfgDate,
    expiry_date: batch.expiryDate,
    quantity_units: batch.quantityUnits,
    quarantined: Boolean(batch.quarantined),
  });
}

export async function syncSupplierDeliveryToSupabase(po: PurchaseOrder): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('record_supplier_delivery', {
    p_payload: {
      id: po.id,
      po_number: po.poNumber,
      supplier_id: po.supplierId,
      supplier_name: po.supplierName,
      supplier_invoice_no: po.supplierInvoiceNo,
      delivered_by: po.deliveredBy || 'Delivery Rider',
      notes: po.notes || '',
      total_amount: po.totalAmount,
      paid_now: po.paidAmount,
      items: po.items.map((i) => ({
        medicine_id: i.medicineId,
        medicine_name_en: i.medicineNameEn,
        batch_number: i.batchNumber,
        mfg_date: i.mfgDate,
        expiry_date: i.expiryDate,
        packs_ordered: i.packsOrdered,
        bonus_packs: i.bonusPacks,
        cost_per_pack: i.costPerPack,
      })),
    },
  });
}

export async function syncSupplierPaymentToSupabase(
  supplierId: string,
  amount: number,
  collectedBy?: string,
  note?: string
): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('record_supplier_payment', {
    p_supplier_id: supplierId,
    p_amount: amount,
    p_collected_by: collectedBy || 'Counter Cash',
    p_note: note || 'Distributor payment',
  });
}

export async function syncKhataPaymentToSupabase(
  customerId: string,
  amount: number,
  note?: string
): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('record_customer_khata_payment', {
    p_customer_id: customerId,
    p_amount: amount,
    p_note: note || 'Counter recovery',
  });
}

export async function syncBatchQuarantineToSupabase(batchId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('medicine_batches').update({ quarantined: true }).eq('id', batchId);
}

export async function syncSupplierInsertToSupabase(sup: Supplier): Promise<void> {
  if (!supabase) return;
  await supabase.from('suppliers').upsert({
    id: sup.id,
    name: sup.name,
    contact_person: sup.contactPerson,
    phone: sup.phone,
    city: sup.city,
    ntn_or_license: sup.ntnOrLicense,
    payable_balance: sup.payableBalance,
  });
}

export async function syncCreatePOToSupabase(po: PurchaseOrder): Promise<void> {
  if (!supabase) return;
  await supabase.from('purchase_orders').upsert({
    id: po.id,
    po_number: po.poNumber,
    supplier_id: po.supplierId,
    supplier_name: po.supplierName,
    supplier_invoice_no: po.supplierInvoiceNo,
    delivered_by: po.deliveredBy || '',
    notes: po.notes || '',
    created_at: po.createdAt,
    status: po.status,
    total_amount: po.totalAmount,
    paid_amount: po.paidAmount,
  });
  if (po.items.length > 0) {
    await supabase.from('purchase_order_items').insert(
      po.items.map((item) => ({
        purchase_order_id: po.id,
        medicine_id: item.medicineId,
        medicine_name_en: item.medicineNameEn,
        batch_number: item.batchNumber,
        mfg_date: item.mfgDate,
        expiry_date: item.expiryDate,
        packs_ordered: item.packsOrdered,
        bonus_packs: item.bonusPacks,
        cost_per_pack: item.costPerPack,
      }))
    );
  }
}

export async function syncReceivePOToSupabase(
  poId: string,
  supplierInvoiceNo: string,
  deliveredBy?: string,
  paidNow = 0
): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('receive_purchase_order', {
    p_po_id: poId,
    p_invoice_no: supplierInvoiceNo,
    p_delivered_by: deliveredBy || 'Supplier Delivery Van',
    p_paid_now: paidNow,
  });
}

export async function syncCustomerInsertToSupabase(cust: CustomerProfile): Promise<void> {
  if (!supabase) return;
  await supabase.from('customers').upsert({
    id: cust.id,
    name: cust.name,
    phone: cust.phone,
    address: cust.address || '',
    allergies: cust.allergies || '',
    chronic_notes: cust.chronicNotes || '',
    credit_limit: cust.creditLimit,
    khata_balance: cust.khataBalance,
    loyalty_points: cust.loyaltyPoints,
  });
}

export async function syncHeldBillUpsertToSupabase(held: HeldBill): Promise<void> {
  if (!supabase) return;
  await supabase.from('held_bills').upsert({
    id: held.id,
    label: held.label,
    held_at: held.heldAt,
    customer_id: held.customerId || null,
    customer_name: held.customerName,
    customer_phone: held.customerPhone,
    doctor_name: held.doctorName,
    rx_number: held.rxNumber,
    extra_discount_rs: held.extraDiscountRs,
    cart_json: held.cart,
  });
}

export async function syncHeldBillDeleteToSupabase(heldId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('held_bills').delete().eq('id', heldId);
}

export async function syncExpenseInsertToSupabase(
  exp: PettyExpense,
  shiftId?: string
): Promise<void> {
  if (!supabase) return;
  await supabase.from('petty_expenses').upsert({
    id: exp.id,
    shift_id: shiftId || null,
    created_at: exp.createdAt,
    category: exp.category,
    description: exp.description,
    amount: exp.amount,
    recorded_by: exp.recordedBy,
  });
}

export async function syncShiftUpsertToSupabase(shift: CashShift): Promise<void> {
  if (!supabase) return;
  await supabase.from('cash_shifts').upsert({
    id: shift.id,
    opened_at: shift.openedAt,
    closed_at: shift.closedAt || null,
    opened_by: shift.openedBy,
    opening_float: shift.openingFloat,
    actual_closing_cash:
      typeof shift.actualClosingCash === 'number' ? shift.actualClosingCash : null,
    status: shift.status,
  });
}

export async function syncProfileAndPrinterToSupabase(
  profile: PharmacyProfile,
  printer: PrinterSettings
): Promise<void> {
  if (!supabase) return;
  await supabase.from('pharmacy_profiles').upsert({
    id: 'default',
    name_en: profile.nameEn,
    name_ur: profile.nameUr,
    tagline_en: profile.taglineEn,
    tagline_ur: profile.taglineUr,
    drap_license: profile.drapLicense,
    ntn_number: profile.ntnNumber,
    address_en: profile.addressEn,
    address_ur: profile.addressUr,
    phone: profile.phone,
    cashier_name: profile.cashierName,
    default_tax_percent: profile.defaultTaxPercent,
    receipt_footer_en: profile.receiptFooterEn,
    receipt_footer_ur: profile.receiptFooterUr,
    printer_transport: printer.transport,
    printer_name: printer.printerName,
    paper_width_chars: printer.paperWidthChars,
    auto_print: printer.autoPrint,
    baud_rate: printer.baudRate,
    receipt_format: printer.receiptFormat,
  });
}

export function subscribeToSupabaseChanges(onRemoteChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('cureplus-pos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_batches' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_invoices' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_shifts' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_expenses' }, onRemoteChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

