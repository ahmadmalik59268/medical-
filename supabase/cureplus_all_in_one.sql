-- ============================================================================
-- CurePlus Pharmacy (کیور پلس فارمیسی) — Complete Supabase PostgreSQL Schema
-- All-in-One Script: Tables, Indexes, Views, Atomic RPCs, RLS Policies & Seed
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> Run once.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. CORE TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pharmacy_profiles (
  id text PRIMARY KEY DEFAULT 'default',
  name_en text NOT NULL DEFAULT 'CurePlus Pharmacy',
  name_ur text NOT NULL DEFAULT 'کیور پلس فارمیسی',
  tagline_en text NOT NULL DEFAULT 'Clinical Care & Certified Dispensing',
  tagline_ur text NOT NULL DEFAULT 'مستند ادویات اور معیاری فارمیسی سروس',
  drap_license text NOT NULL DEFAULT 'DRAP-LHR-04982',
  ntn_number text NOT NULL DEFAULT 'NTN-4189203-7',
  address_en text NOT NULL DEFAULT '42-B Main Boulevard, Gulberg III, Lahore',
  address_ur text NOT NULL DEFAULT '42-بی مین بلیوارڈ، گلبرگ 3، لاہور',
  phone text NOT NULL DEFAULT '+92 42 3578 4410',
  cashier_name text NOT NULL DEFAULT 'Usman Tariq (Pharmacist)',
  default_tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  receipt_footer_en text NOT NULL DEFAULT '',
  receipt_footer_ur text NOT NULL DEFAULT '',
  printer_transport text NOT NULL DEFAULT 'browser' CHECK (printer_transport IN ('browser', 'serial', 'bluetooth')),
  printer_name text NOT NULL DEFAULT 'System / OS Thermal Driver',
  paper_width_chars integer NOT NULL DEFAULT 48 CHECK (paper_width_chars IN (32, 48)),
  auto_print boolean NOT NULL DEFAULT true,
  baud_rate integer NOT NULL DEFAULT 9600 CHECK (baud_rate IN (9600, 115200)),
  receipt_format text NOT NULL DEFAULT 'bilingual_rich' CHECK (receipt_format IN ('bilingual_rich', 'escpos_mono')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicines (
  id text PRIMARY KEY,
  barcode text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ur text NOT NULL DEFAULT '',
  generic_salt text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Ointment', 'Surgical')),
  rack_location text NOT NULL DEFAULT 'A-01',
  pack_size integer NOT NULL CHECK (pack_size >= 1),
  strip_size integer NOT NULL CHECK (strip_size >= 1),
  allow_loose_sale boolean NOT NULL DEFAULT true,
  mrp_per_pack numeric(12,2) NOT NULL CHECK (mrp_per_pack >= 0),
  cost_per_pack numeric(12,2) NOT NULL CHECK (cost_per_pack >= 0),
  min_stock_units integer NOT NULL DEFAULT 10,
  requires_prescription boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id text PRIMARY KEY,
  medicine_id text NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  mfg_date date NOT NULL,
  expiry_date date NOT NULL,
  quantity_units integer NOT NULL DEFAULT 0 CHECK (quantity_units >= 0),
  quarantined boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text DEFAULT '',
  allergies text DEFAULT '',
  chronic_notes text DEFAULT '',
  credit_limit numeric(12,2) NOT NULL DEFAULT 10000,
  khata_balance numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.khata_transactions (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tx_date timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('debit_sale', 'credit_payment', 'return_adjustment')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.sale_invoices (
  id text PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  cashier_name text NOT NULL DEFAULT '',
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Patient',
  customer_phone text NOT NULL DEFAULT '',
  doctor_name text NOT NULL DEFAULT '',
  rx_number text DEFAULT '',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  item_discounts numeric(12,2) NOT NULL DEFAULT 0,
  extra_discount_rs numeric(12,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_payable numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'easypaisa_jazzcash', 'khata')),
  cash_tendered numeric(12,2) NOT NULL DEFAULT 0,
  change_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'returned')),
  returned_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sale_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text NOT NULL REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
  medicine_id text NOT NULL REFERENCES public.medicines(id),
  batch_id text REFERENCES public.medicine_batches(id),
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  name_en text NOT NULL,
  name_ur text NOT NULL DEFAULT '',
  sale_unit_type text NOT NULL CHECK (sale_unit_type IN ('pack', 'strip', 'loose')),
  quantity integer NOT NULL CHECK (quantity >= 1),
  units_deducted integer NOT NULL CHECK (units_deducted >= 1),
  unit_price numeric(12,2) NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL,
  cost_total numeric(12,2) NOT NULL DEFAULT 0,
  dosage_label text DEFAULT '',
  requires_prescription boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.held_bills (
  id text PRIMARY KEY,
  label text NOT NULL,
  held_at timestamptz NOT NULL DEFAULT now(),
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  doctor_name text NOT NULL DEFAULT '',
  rx_number text NOT NULL DEFAULT '',
  extra_discount_rs numeric(12,2) NOT NULL DEFAULT 0,
  cart_json jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id text PRIMARY KEY,
  name text NOT NULL,
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Lahore',
  ntn_or_license text NOT NULL DEFAULT '',
  payable_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id text PRIMARY KEY,
  po_number text NOT NULL UNIQUE,
  supplier_id text NOT NULL REFERENCES public.suppliers(id),
  supplier_name text NOT NULL,
  supplier_invoice_no text NOT NULL DEFAULT '',
  delivered_by text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'received')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id text NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  medicine_id text NOT NULL REFERENCES public.medicines(id),
  medicine_name_en text NOT NULL,
  batch_number text NOT NULL,
  mfg_date date NOT NULL,
  expiry_date date NOT NULL,
  packs_ordered integer NOT NULL CHECK (packs_ordered >= 1),
  bonus_packs integer NOT NULL DEFAULT 0 CHECK (bonus_packs >= 0),
  cost_per_pack numeric(12,2) NOT NULL CHECK (cost_per_pack >= 0)
);

CREATE TABLE IF NOT EXISTS public.supplier_transactions (
  id text PRIMARY KEY,
  supplier_id text NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  tx_date timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('delivery', 'payment')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount numeric(12,2) DEFAULT 0,
  delivered_by text DEFAULT '',
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id text PRIMARY KEY,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by text NOT NULL,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  actual_closing_cash numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.petty_expenses (
  id text PRIMARY KEY,
  shift_id text REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('Utilities', 'Tea & Hospitality', 'Courier & Delivery', 'Maintenance', 'Other')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  recorded_by text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.drug_interaction_rules (
  id text PRIMARY KEY,
  salt_keyword_a text NOT NULL,
  salt_keyword_b text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('High', 'Moderate')),
  message_en text NOT NULL,
  message_ur text NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES FOR FAST POS SEARCH & FEFO LOOKUPS
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON public.medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON public.medicines(name_en);
CREATE INDEX IF NOT EXISTS idx_batches_med_fefo ON public.medicine_batches(medicine_id, quarantined, expiry_date) WHERE quantity_units > 0;
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.sale_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON public.sale_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_khata_tx_cust ON public.khata_transactions(customer_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sup_tx_supplier ON public.supplier_transactions(supplier_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON public.petty_expenses(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. UPDATED_AT TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicines_updated_at ON public.medicines;
CREATE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profile_updated_at ON public.pharmacy_profiles;
CREATE TRIGGER trg_profile_updated_at
  BEFORE UPDATE ON public.pharmacy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. REPORTING VIEWS (Sales/Profit, Inventory FEFO, Supplier Ledger)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_inventory_fefo_summary AS
SELECT
  m.id,
  m.barcode,
  m.name_en,
  m.name_ur,
  m.generic_salt,
  m.category,
  m.rack_location,
  m.pack_size,
  m.strip_size,
  m.mrp_per_pack,
  m.cost_per_pack,
  m.min_stock_units,
  COALESCE(SUM(CASE WHEN b.quarantined = false AND b.expiry_date > CURRENT_DATE THEN b.quantity_units ELSE 0 END), 0)::integer AS sellable_units,
  MIN(CASE WHEN b.quarantined = false AND b.expiry_date > CURRENT_DATE AND b.quantity_units > 0 THEN b.expiry_date ELSE NULL END) AS nearest_expiry,
  ROUND((COALESCE(SUM(CASE WHEN b.quarantined = false AND b.expiry_date > CURRENT_DATE THEN b.quantity_units ELSE 0 END), 0)::numeric / GREATEST(m.pack_size, 1)) * m.mrp_per_pack, 2) AS sellable_retail_value
FROM public.medicines m
LEFT JOIN public.medicine_batches b ON b.medicine_id = m.id
GROUP BY m.id;

CREATE OR REPLACE VIEW public.v_daily_sales_profit AS
SELECT
  DATE(i.created_at) AS sale_date,
  COUNT(*) FILTER (WHERE i.status = 'completed') AS completed_bills,
  COUNT(*) FILTER (WHERE i.status = 'returned') AS returned_bills,
  COALESCE(SUM(i.net_payable) FILTER (WHERE i.status = 'completed'), 0) AS gross_revenue,
  COALESCE(SUM(it.cost_total) FILTER (WHERE i.status = 'completed'), 0) AS total_cogs,
  COALESCE(SUM(i.net_payable) FILTER (WHERE i.status = 'completed'), 0)
    - COALESCE(SUM(it.cost_total) FILTER (WHERE i.status = 'completed'), 0)
    - COALESCE(SUM(i.tax_amount) FILTER (WHERE i.status = 'completed'), 0) AS gross_profit
FROM public.sale_invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(cost_total) AS cost_total
  FROM public.sale_invoice_items
  GROUP BY invoice_id
) it ON it.invoice_id = i.id
GROUP BY DATE(i.created_at)
ORDER BY sale_date DESC;

CREATE OR REPLACE VIEW public.v_supplier_ledger_summary AS
SELECT
  s.id,
  s.name,
  s.contact_person,
  s.phone,
  s.city,
  s.payable_balance,
  COALESCE(SUM(CASE WHEN st.type = 'delivery' THEN st.amount ELSE 0 END), 0) AS total_goods_supplied,
  COALESCE(SUM(CASE WHEN st.type = 'delivery' THEN COALESCE(st.paid_amount, 0) WHEN st.type = 'payment' THEN st.amount ELSE 0 END), 0) AS total_paid,
  COUNT(*) FILTER (WHERE st.type = 'delivery') AS deliveries_count,
  MAX(st.tx_date) FILTER (WHERE st.type = 'delivery') AS last_delivery_at
FROM public.suppliers s
LEFT JOIN public.supplier_transactions st ON st.supplier_id = s.id
GROUP BY s.id;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTIONS FOR POS, RETURNS, SUPPLIERS & KHATA
-- ----------------------------------------------------------------------------

-- 5A. Atomic POS Checkout (Creates invoice, line items, deducts FEFO batches, updates Khata & loyalty)
CREATE OR REPLACE FUNCTION public.complete_pharmacy_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id text := COALESCE(p_payload->>'id', 'inv-' || extract(epoch from now())::bigint::text);
  v_invoice_no text := p_payload->>'invoice_number';
  v_customer_id text := NULLIF(p_payload->>'customer_id', '');
  v_payment_method text := p_payload->>'payment_method';
  v_net_payable numeric(12,2) := COALESCE((p_payload->>'net_payable')::numeric, 0);
  v_item jsonb;
  v_points integer;
BEGIN
  INSERT INTO public.sale_invoices (
    id, invoice_number, created_at, cashier_name, customer_id,
    customer_name, customer_phone, doctor_name, rx_number,
    subtotal, item_discounts, extra_discount_rs, tax_percent, tax_amount,
    net_payable, payment_method, cash_tendered, change_due, status
  ) VALUES (
    v_invoice_id,
    v_invoice_no,
    COALESCE((p_payload->>'created_at')::timestamptz, now()),
    COALESCE(p_payload->>'cashier_name', ''),
    v_customer_id,
    COALESCE(p_payload->>'customer_name', 'Walk-in Patient'),
    COALESCE(p_payload->>'customer_phone', ''),
    COALESCE(p_payload->>'doctor_name', ''),
    COALESCE(p_payload->>'rx_number', ''),
    COALESCE((p_payload->>'subtotal')::numeric, 0),
    COALESCE((p_payload->>'item_discounts')::numeric, 0),
    COALESCE((p_payload->>'extra_discount_rs')::numeric, 0),
    COALESCE((p_payload->>'tax_percent')::numeric, 0),
    COALESCE((p_payload->>'tax_amount')::numeric, 0),
    v_net_payable,
    v_payment_method,
    COALESCE((p_payload->>'cash_tendered')::numeric, 0),
    COALESCE((p_payload->>'change_due')::numeric, 0),
    'completed'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    INSERT INTO public.sale_invoice_items (
      invoice_id, medicine_id, batch_id, batch_number, expiry_date,
      name_en, name_ur, sale_unit_type, quantity, units_deducted,
      unit_price, discount_percent, line_total, cost_total,
      dosage_label, requires_prescription
    ) VALUES (
      v_invoice_id,
      v_item->>'medicine_id',
      NULLIF(v_item->>'batch_id', ''),
      v_item->>'batch_number',
      (v_item->>'expiry_date')::date,
      v_item->>'name_en',
      COALESCE(v_item->>'name_ur', ''),
      v_item->>'sale_unit_type',
      (v_item->>'quantity')::integer,
      (v_item->>'units_deducted')::integer,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_percent')::numeric, 0),
      (v_item->>'line_total')::numeric,
      COALESCE((v_item->>'cost_total')::numeric, 0),
      COALESCE(v_item->>'dosage_label', ''),
      COALESCE((v_item->>'requires_prescription')::boolean, false)
    );

    UPDATE public.medicine_batches
    SET quantity_units = GREATEST(0, quantity_units - (v_item->>'units_deducted')::integer)
    WHERE id = v_item->>'batch_id';
  END LOOP;

  IF v_customer_id IS NOT NULL THEN
    v_points := FLOOR(v_net_payable / 100)::integer;
    UPDATE public.customers
    SET
      loyalty_points = loyalty_points + v_points,
      khata_balance = CASE
        WHEN v_payment_method = 'khata' THEN khata_balance + v_net_payable
        ELSE khata_balance
      END
    WHERE id = v_customer_id;

    IF v_payment_method = 'khata' THEN
      INSERT INTO public.khata_transactions (id, customer_id, tx_date, type, amount, reference, note)
      VALUES (
        'ktx-' || extract(epoch from now())::bigint::text,
        v_customer_id,
        now(),
        'debit_sale',
        v_net_payable,
        v_invoice_no,
        'POS Credit Sale'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_no);
END;
$$;

-- 5B. Atomic Return / Refund Invoice
CREATE OR REPLACE FUNCTION public.return_pharmacy_invoice(p_invoice_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_item record;
BEGIN
  SELECT * INTO v_inv FROM public.sale_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status = 'returned' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Invoice not found or already returned');
  END IF;

  FOR v_item IN SELECT * FROM public.sale_invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    UPDATE public.medicine_batches
    SET quantity_units = quantity_units + v_item.units_deducted
    WHERE id = v_item.batch_id;
  END LOOP;

  IF v_inv.customer_id IS NOT NULL AND v_inv.payment_method = 'khata' THEN
    UPDATE public.customers
    SET khata_balance = GREATEST(0, khata_balance - v_inv.net_payable)
    WHERE id = v_inv.customer_id;

    INSERT INTO public.khata_transactions (id, customer_id, tx_date, type, amount, reference, note)
    VALUES (
      'ktx-ret-' || extract(epoch from now())::bigint::text,
      v_inv.customer_id,
      now(),
      'return_adjustment',
      v_inv.net_payable,
      v_inv.invoice_number,
      'Returned bill credit adjustment'
    );
  END IF;

  UPDATE public.sale_invoices
  SET status = 'returned', returned_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true, 'invoice_id', p_invoice_id);
END;
$$;

-- 5C. Atomic 1-Step Stock Delivery from Supplier (Adds batches, PO delivery record, supplier payable & ledger)
CREATE OR REPLACE FUNCTION public.record_supplier_delivery(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id text := COALESCE(p_payload->>'id', 'po-' || extract(epoch from now())::bigint::text);
  v_po_number text := p_payload->>'po_number';
  v_supplier_id text := p_payload->>'supplier_id';
  v_supplier_name text := p_payload->>'supplier_name';
  v_invoice_no text := COALESCE(p_payload->>'supplier_invoice_no', '');
  v_delivered_by text := COALESCE(p_payload->>'delivered_by', 'Delivery Rider');
  v_notes text := COALESCE(p_payload->>'notes', '');
  v_total_amount numeric(12,2) := COALESCE((p_payload->>'total_amount')::numeric, 0);
  v_paid_now numeric(12,2) := LEAST(v_total_amount, GREATEST(0, COALESCE((p_payload->>'paid_now')::numeric, 0)));
  v_credit_delta numeric(12,2) := GREATEST(0, v_total_amount - v_paid_now);
  v_item jsonb;
  v_pack_size integer;
  v_total_units integer;
  v_idx integer := 0;
BEGIN
  INSERT INTO public.purchase_orders (
    id, po_number, supplier_id, supplier_name, supplier_invoice_no,
    delivered_by, notes, created_at, received_at, status, total_amount, paid_amount
  ) VALUES (
    v_po_id, v_po_number, v_supplier_id, v_supplier_name, v_invoice_no,
    v_delivered_by, v_notes, now(), now(), 'received', v_total_amount, v_paid_now
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    SELECT COALESCE(pack_size, 1) INTO v_pack_size FROM public.medicines WHERE id = v_item->>'medicine_id';
    v_total_units := ((v_item->>'packs_ordered')::integer + COALESCE((v_item->>'bonus_packs')::integer, 0)) * COALESCE(v_pack_size, 1);

    INSERT INTO public.purchase_order_items (
      purchase_order_id, medicine_id, medicine_name_en, batch_number,
      mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
    ) VALUES (
      v_po_id,
      v_item->>'medicine_id',
      v_item->>'medicine_name_en',
      v_item->>'batch_number',
      COALESCE((v_item->>'mfg_date')::date, CURRENT_DATE),
      (v_item->>'expiry_date')::date,
      (v_item->>'packs_ordered')::integer,
      COALESCE((v_item->>'bonus_packs')::integer, 0),
      (v_item->>'cost_per_pack')::numeric
    );

    INSERT INTO public.medicine_batches (
      id, medicine_id, batch_number, mfg_date, expiry_date, quantity_units, quarantined
    ) VALUES (
      'bat-sup-' || extract(epoch from now())::bigint::text || '-' || v_idx::text,
      v_item->>'medicine_id',
      v_item->>'batch_number',
      COALESCE((v_item->>'mfg_date')::date, CURRENT_DATE),
      (v_item->>'expiry_date')::date,
      v_total_units,
      false
    );
  END LOOP;

  UPDATE public.suppliers
  SET payable_balance = payable_balance + v_credit_delta
  WHERE id = v_supplier_id;

  INSERT INTO public.supplier_transactions (
    id, supplier_id, tx_date, type, amount, paid_amount, delivered_by, reference, note
  ) VALUES (
    'stx-' || extract(epoch from now())::bigint::text,
    v_supplier_id,
    now(),
    'delivery',
    v_total_amount,
    v_paid_now,
    v_delivered_by,
    v_invoice_no,
    COALESCE(NULLIF(v_notes, ''), v_po_number || ' received into FEFO stock')
  );

  RETURN jsonb_build_object('ok', true, 'po_id', v_po_id, 'credit_added', v_credit_delta);
END;
$$;

-- 5C-2. Atomic Receive Existing Purchase Order (GRN)
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id text,
  p_invoice_no text,
  p_delivered_by text DEFAULT 'Supplier Delivery Van',
  p_paid_now numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po record;
  v_item record;
  v_pack_size integer;
  v_safe_paid numeric(12,2);
  v_credit_delta numeric(12,2);
  v_idx integer := 0;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND OR v_po.status = 'received' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'PO not found or already received');
  END IF;

  v_safe_paid := LEAST(v_po.total_amount, GREATEST(0, COALESCE(p_paid_now, 0)));
  v_credit_delta := GREATEST(0, v_po.total_amount - v_safe_paid);

  FOR v_item IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_po_id
  LOOP
    v_idx := v_idx + 1;
    SELECT COALESCE(pack_size, 1) INTO v_pack_size FROM public.medicines WHERE id = v_item.medicine_id;
    INSERT INTO public.medicine_batches (
      id, medicine_id, batch_number, mfg_date, expiry_date, quantity_units, quarantined
    ) VALUES (
      'bat-grn-' || extract(epoch from now())::bigint::text || '-' || v_idx::text,
      v_item.medicine_id,
      v_item.batch_number,
      v_item.mfg_date,
      v_item.expiry_date,
      (v_item.packs_ordered + v_item.bonus_packs) * COALESCE(v_pack_size, 1),
      false
    );
  END LOOP;

  UPDATE public.purchase_orders
  SET status = 'received',
      supplier_invoice_no = COALESCE(NULLIF(p_invoice_no, ''), 'GRN-CONFIRMED'),
      delivered_by = COALESCE(NULLIF(p_delivered_by, ''), 'Supplier Delivery Van'),
      paid_amount = v_safe_paid,
      received_at = now()
  WHERE id = p_po_id;

  UPDATE public.suppliers
  SET payable_balance = payable_balance + v_credit_delta
  WHERE id = v_po.supplier_id;

  INSERT INTO public.supplier_transactions (
    id, supplier_id, tx_date, type, amount, paid_amount, delivered_by, reference, note
  ) VALUES (
    'stx-grn-' || extract(epoch from now())::bigint::text,
    v_po.supplier_id,
    now(),
    'delivery',
    v_po.total_amount,
    v_safe_paid,
    COALESCE(NULLIF(p_delivered_by, ''), 'Supplier Delivery Van'),
    COALESCE(NULLIF(p_invoice_no, ''), 'GRN-CONFIRMED'),
    v_po.po_number || ' received into FEFO stock'
  );

  RETURN jsonb_build_object('ok', true, 'po_id', p_po_id, 'credit_added', v_credit_delta);
END;
$$;

-- 5D. Atomic Supplier Payment
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id text,
  p_amount numeric,
  p_collected_by text DEFAULT 'Counter Cash / Bank Transfer',
  p_note text DEFAULT 'Distributor balance payment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric(12,2) := GREATEST(0, ROUND(p_amount, 2));
BEGIN
  UPDATE public.suppliers
  SET payable_balance = GREATEST(0, payable_balance - v_amt)
  WHERE id = p_supplier_id;

  INSERT INTO public.supplier_transactions (
    id, supplier_id, tx_date, type, amount, paid_amount, delivered_by, reference, note
  ) VALUES (
    'stx-pay-' || extract(epoch from now())::bigint::text,
    p_supplier_id,
    now(),
    'payment',
    v_amt,
    v_amt,
    COALESCE(NULLIF(p_collected_by, ''), 'Counter Cash'),
    'PAY-' || right(extract(epoch from now())::bigint::text, 5),
    COALESCE(NULLIF(p_note, ''), 'Distributor payment')
  );

  RETURN jsonb_build_object('ok', true, 'paid', v_amt);
END;
$$;

-- 5E. Atomic Customer Khata Recovery Payment
CREATE OR REPLACE FUNCTION public.record_customer_khata_payment(
  p_customer_id text,
  p_amount numeric,
  p_note text DEFAULT 'Counter recovery'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric(12,2) := GREATEST(0, ROUND(p_amount, 2));
BEGIN
  UPDATE public.customers
  SET khata_balance = GREATEST(0, khata_balance - v_amt)
  WHERE id = p_customer_id;

  INSERT INTO public.khata_transactions (id, customer_id, tx_date, type, amount, reference, note)
  VALUES (
    'ktx-pay-' || extract(epoch from now())::bigint::text,
    p_customer_id,
    now(),
    'credit_payment',
    v_amt,
    'CASH-RCV',
    COALESCE(NULLIF(p_note, ''), 'Counter recovery')
  );

  RETURN jsonb_build_object('ok', true, 'received', v_amt);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Configured for immediate plug-and-play with Supabase Anon + Authenticated keys.
-- For multi-user Supabase Auth lockdown later, switch TO authenticated only.
-- ----------------------------------------------------------------------------

ALTER TABLE public.pharmacy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khata_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interaction_rules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'pharmacy_profiles', 'medicines', 'medicine_batches', 'customers',
    'khata_transactions', 'sale_invoices', 'sale_invoice_items', 'held_bills',
    'suppliers', 'purchase_orders', 'purchase_order_items', 'supplier_transactions',
    'cash_shifts', 'petty_expenses', 'drug_interaction_rules'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "staff_all_%s" ON public.%I FOR ALL TO authenticated, anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. INITIAL SEED DATA (Safe to re-run: ON CONFLICT DO NOTHING)
-- ----------------------------------------------------------------------------

INSERT INTO public.pharmacy_profiles (
  id, name_en, name_ur, tagline_en, tagline_ur, drap_license, ntn_number,
  address_en, address_ur, phone, cashier_name, default_tax_percent,
  receipt_footer_en, receipt_footer_ur
) VALUES (
  'default',
  'CurePlus Pharmacy',
  'کیور پلس فارمیسی',
  'Clinical Care & Certified Dispensing',
  'مستند ادویات اور معیاری فارمیسی سروس',
  'DRAP-LHR-04982',
  'NTN-4189203-7',
  '42-B Main Boulevard, Gulberg III, Lahore',
  '42-بی مین بلیوارڈ، گلبرگ 3، لاہور',
  '+92 42 3578 4410',
  'Usman Tariq (Pharmacist)',
  0,
  'Thank you for choosing CurePlus Pharmacy. Unopened packs exchangeable within 7 days with original receipt; refrigerated/cold-chain items non-returnable.',
  'کیور پلس فارمیسی پر تشریف آوری کا شکریہ۔ اصل رسید کے ساتھ 7 دن میں بغیر کھلی دوائی تبدیل ہو سکتی ہے (فریج آئٹمز واپس نہیں ہوں گے)۔'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.drug_interaction_rules (id, salt_keyword_a, salt_keyword_b, severity, message_en, message_ur) VALUES
('int-nsaid-aspirin', 'aspirin', 'ibuprofen', 'High', 'NSAID Overlap: Combining Aspirin + Ibuprofen increases GI bleeding risk and reduces cardioprotective effect.', 'طبی انتباہ: ڈسپرین (Aspirin) اور بروفن/ایرینک (Ibuprofen) کو ایک ساتھ لینے سے معدے پر اثر پڑ سکتا ہے۔'),
('int-multi-paracetamol', 'paracetamol', 'paracetamol', 'Moderate', 'Duplicate Therapy Check: Multiple Paracetamol-containing brands in the same bill. Verify total daily dose (max 4g/day).', 'احتیاط: بل میں پیراسیٹامول فارمولے کی دو دوائیاں شامل ہیں۔ روزانہ کی خوراک چیک کریں۔'),
('int-zinc-antibiotic', 'zinc', 'ceftriaxone', 'Moderate', 'Advise patient to space Zinc/Multivitamin supplements 2 hours apart from antibiotic therapy.', 'ہدایت: ملٹی وٹامن/زنک اور اینٹی بائیوٹک کے درمیان کم از کم 2 گھنٹے کا وقفہ رکھیں۔')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medicines (
  id, barcode, name_en, name_ur, generic_salt, manufacturer, category,
  rack_location, pack_size, strip_size, allow_loose_sale, mrp_per_pack,
  cost_per_pack, min_stock_units, requires_prescription
) VALUES
('med-panadol-500', '8964001200015', 'Panadol 500mg Tablet', 'پیناڈول 500 ملی گرام گولی', 'Paracetamol 500mg', 'GSK Pakistan', 'Tablet', 'A-01', 200, 10, true, 680, 560, 120, false),
('med-calpol-6plus', '8964001200022', 'Calpol 500mg Tablet (GSK)', 'کیلپول 500 ملی گرام گولی', 'Paracetamol 500mg', 'GSK Pakistan', 'Tablet', 'A-02', 100, 10, true, 320, 265, 60, false),
('med-augmentin-625', '8964001200039', 'Augmentin 625mg Tablet', 'آگمینٹن 625 ملی گرام گولی', 'Amoxicillin + Clavulanic Acid 625mg', 'GSK Pakistan', 'Tablet', 'B-04', 6, 6, true, 415, 348, 24, true),
('med-amoxil-clav-625', '8964001200046', 'Calamox 625mg Tablet', 'کیلاموکس 625 ملی گرام گولی', 'Amoxicillin + Clavulanic Acid 625mg', 'Bosch Pharma', 'Tablet', 'B-05', 6, 6, true, 330, 270, 18, true),
('med-risek-40', '8964001200053', 'Risek 40mg Capsule', 'رائزیک 40 ملی گرام کیپسول', 'Omeprazole 40mg', 'Getz Pharma', 'Capsule', 'C-01', 14, 7, true, 490, 405, 28, false),
('med-omega-40', '8964001200060', 'Omega 40mg Capsule', 'اومیگا 40 ملی گرام کیپسول', 'Omeprazole 40mg', 'Ferozsons Labs', 'Capsule', 'C-02', 14, 7, true, 360, 295, 20, false),
('med-brufen-syrup', '8964001200077', 'Brufen Syrup 120ml', 'بروفن شربت 120 ملی لیٹر', 'Ibuprofen 100mg/5ml', 'Abbott Laboratories', 'Syrup', 'S-01', 1, 1, false, 145, 118, 10, false),
('med-flagyl-400', '8964001200084', 'Flagyl 400mg Tablet', 'فلیجل 400 ملی گرام گولی', 'Metronidazole 400mg', 'Sanofi Aventis', 'Tablet', 'B-08', 200, 10, true, 920, 775, 80, true),
('med-rigix-10', '8964001200091', 'Rigix 10mg Tablet', 'ریجکس 10 ملی گرام گولی', 'Cetirizine Dihydrochloride 10mg', 'AGP Pharma', 'Tablet', 'D-03', 30, 10, true, 240, 192, 30, false),
('med-arinac-tab', '8964001200107', 'Arinac Tablet', 'ایرینک گولی', 'Ibuprofen + Pseudoephedrine', 'Abbott Laboratories', 'Tablet', 'D-05', 20, 10, true, 280, 230, 20, false),
('med-glucophage-500', '8964001200114', 'Glucophage 500mg Tablet', 'گلوکوفیج 500 ملی گرام گولی', 'Metformin HCl 500mg', 'Martin Dow', 'Tablet', 'E-01', 50, 10, true, 265, 218, 40, true),
('med-concor-5', '8964001200121', 'Concor 5mg Tablet', 'کونکور 5 ملی گرام گولی', 'Bisoprolol Fumarate 5mg', 'Merck Pharma', 'Tablet', 'E-04', 14, 14, true, 392, 328, 28, true),
('med-surbex-z', '8964001200138', 'Surbex-Z Tablet', 'سربیکس زیڈ وٹامن گولی', 'Multivitamin + Zinc + B-Complex', 'Abbott Laboratories', 'Tablet', 'V-02', 30, 10, true, 450, 375, 20, false),
('med-rocephin-1g', '8964001200145', 'Rocephin 1g IV Injection', 'روسیفن 1 گرام انجیکشن', 'Ceftriaxone Sodium 1g', 'Roche Pakistan', 'Injection', 'I-01', 1, 1, false, 980, 825, 8, true),
('med-polyfax-eye', '8964001200152', 'Polyfax Skin Ointment 20g', 'پولی فیکس مرہم 20 گرام', 'Polymyxin B + Bacitracin Zinc', 'GSK Pakistan', 'Ointment', 'O-02', 1, 1, false, 135, 110, 12, false),
('med-tobradex-drops', '8964001200169', 'Tobradex Eye Drops 5ml', 'ٹوبراڈیکس آنکھوں کے قطرے', 'Tobramycin + Dexamethasone', 'Novartis Alcon', 'Drops', 'O-05', 1, 1, false, 610, 505, 6, true),
('med-disprin-300', '8964001200176', 'Disprin 300mg Dispersible', 'ڈسپرین 300 ملی گرام گولی', 'Aspirin 300mg', 'Reckitt Benckiser', 'Tablet', 'A-04', 100, 10, true, 300, 245, 60, false),
('med-ors-nimkol', '8964001200183', 'Nimkol ORS Sachet (Box of 20)', 'نمکول او آر ایس ساشے', 'Oral Rehydration Salts (WHO)', 'Searle Pakistan', 'Surgical', 'G-01', 20, 1, true, 500, 410, 20, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medicine_batches (id, medicine_id, batch_number, mfg_date, expiry_date, quantity_units, quarantined) VALUES
('bat-pan-01', 'med-panadol-500', 'PK-GSK-882A', CURRENT_DATE - 260, CURRENT_DATE + 75, 140, false),
('bat-pan-02', 'med-panadol-500', 'PK-GSK-941B', CURRENT_DATE - 40, CURRENT_DATE + 480, 600, false),
('bat-cal-01', 'med-calpol-6plus', 'CAL-402X', CURRENT_DATE - 90, CURRENT_DATE + 420, 200, false),
('bat-aug-01', 'med-augmentin-625', 'AUG-219M', CURRENT_DATE - 340, CURRENT_DATE + 22, 18, false),
('bat-aug-02', 'med-augmentin-625', 'AUG-550P', CURRENT_DATE - 30, CURRENT_DATE + 365, 60, false),
('bat-calamox-01', 'med-amoxil-clav-625', 'BSH-119K', CURRENT_DATE - 60, CURRENT_DATE + 410, 48, false),
('bat-ris-01', 'med-risek-40', 'GTZ-771C', CURRENT_DATE - 120, CURRENT_DATE + 290, 98, false),
('bat-omg-01', 'med-omega-40', 'FRZ-302N', CURRENT_DATE - 80, CURRENT_DATE + 340, 56, false),
('bat-bru-01', 'med-brufen-syrup', 'ABT-608R', CURRENT_DATE - 150, CURRENT_DATE + 240, 24, false),
('bat-flg-01', 'med-flagyl-400', 'SNF-492D', CURRENT_DATE - 100, CURRENT_DATE + 390, 320, false),
('bat-rig-01', 'med-rigix-10', 'AGP-912T', CURRENT_DATE - 140, CURRENT_DATE + 280, 14, false),
('bat-ari-01', 'med-arinac-tab', 'ABT-811V', CURRENT_DATE - 95, CURRENT_DATE + 310, 80, false),
('bat-glu-01', 'med-glucophage-500', 'MDW-104S', CURRENT_DATE - 110, CURRENT_DATE + 440, 150, false),
('bat-con-01', 'med-concor-5', 'MRK-320L', CURRENT_DATE - 310, CURRENT_DATE + 55, 42, false),
('bat-sur-01', 'med-surbex-z', 'ABT-504Z', CURRENT_DATE - 70, CURRENT_DATE + 510, 90, false),
('bat-roc-01', 'med-rocephin-1g', 'RCH-112I', CURRENT_DATE - 180, CURRENT_DATE + 210, 5, false),
('bat-pol-01', 'med-polyfax-eye', 'GSK-731P', CURRENT_DATE - 65, CURRENT_DATE + 495, 28, false),
('bat-tob-01', 'med-tobradex-drops', 'ALC-094E', CURRENT_DATE - 520, CURRENT_DATE - 18, 7, false),
('bat-dis-01', 'med-disprin-300', 'RBK-640D', CURRENT_DATE - 45, CURRENT_DATE + 540, 220, false),
('bat-ors-01', 'med-ors-nimkol', 'SRL-207N', CURRENT_DATE - 115, CURRENT_DATE + 335, 64, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, name, phone, address, allergies, chronic_notes, credit_limit, khata_balance, loyalty_points) VALUES
('cust-01', 'Haji Muhammad Sadiq', '0300-4419820', 'House 14, Block K, Gulberg III, Lahore', 'Penicillin Sensitivity', 'Type-2 Diabetes & Hypertension (Regular Glucophage + Concor)', 15000, 2450, 185),
('cust-02', 'Mrs. Shumaila Khan', '0321-8891204', 'Apartment 5B, Cavalry Ground, Lahore', 'None reported', 'Gastric reflux maintenance', 10000, 0, 120),
('cust-03', 'Al-Noor Clinic (Dr. Salman)', '0333-4120987', 'Main Market, Model Town, Lahore', 'N/A (Clinic Account)', 'Monthly surgical & injectable clinic supply', 50000, 6800, 490)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.khata_transactions (id, customer_id, tx_date, type, amount, reference, note) VALUES
('ktx-01', 'cust-01', now() - interval '48 hours', 'debit_sale', 2450, 'CP-2026-0994', 'Monthly Diabetes & BP refill on Khata'),
('ktx-02', 'cust-03', now() - interval '72 hours', 'debit_sale', 6800, 'CP-2026-0988', 'Clinic Rocephin & ORS supply invoice')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, name, contact_person, phone, city, ntn_or_license, payable_balance) VALUES
('sup-mp', 'Muller & Phipps Pakistan (M&P)', 'Kamran Akmal', '042-35812901', 'Lahore', 'DIST-LHR-8821', 18400),
('sup-udl', 'United Distributors (UDL)', 'Farhan Qureshi', '042-35740092', 'Lahore', 'DIST-LHR-4410', 0),
('sup-premier', 'Premier Sales (Getz / Abbott Dist.)', 'Zainab Raza', '042-36652218', 'Lahore', 'DIST-LHR-3195', 9600)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.purchase_orders (
  id, po_number, supplier_id, supplier_name, supplier_invoice_no, delivered_by,
  notes, created_at, received_at, status, total_amount, paid_amount
) VALUES
('po-103', 'DEL-2026-403', 'sup-mp', 'Muller & Phipps Pakistan (M&P)', 'MP-CH-90218', 'Kamran Akmal (M&P Rider)', 'Monthly antibiotic & gastric restock — partial cash paid on delivery', now() - interval '36 hours', now() - interval '36 hours', 'received', 22020, 3620),
('po-101', 'PO-2026-401', 'sup-mp', 'Muller & Phipps Pakistan (M&P)', 'MP-INV-88342', 'Kamran Akmal (M&P Rider)', '', now() - interval '96 hours', now() - interval '72 hours', 'received', 1680, 1680),
('po-102', 'PO-2026-402', 'sup-premier', 'Premier Sales (Getz / Abbott Dist.)', 'Pending Delivery', '', '', now() - interval '12 hours', NULL, 'ordered', 9210, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.purchase_order_items (
  purchase_order_id, medicine_id, medicine_name_en, batch_number, mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
)
SELECT 'po-103', 'med-augmentin-625', 'Augmentin 625mg Tablet', 'AUG-884K', CURRENT_DATE - 25, CURRENT_DATE + 490, 40, 2, 348
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = 'po-103' AND medicine_id = 'med-augmentin-625');

INSERT INTO public.purchase_order_items (
  purchase_order_id, medicine_id, medicine_name_en, batch_number, mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
)
SELECT 'po-103', 'med-risek-40', 'Risek 40mg Capsule', 'GTZ-910C', CURRENT_DATE - 30, CURRENT_DATE + 460, 20, 0, 405
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = 'po-103' AND medicine_id = 'med-risek-40');

INSERT INTO public.purchase_order_items (
  purchase_order_id, medicine_id, medicine_name_en, batch_number, mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
)
SELECT 'po-101', 'med-panadol-500', 'Panadol 500mg Tablet', 'PK-GSK-941B', CURRENT_DATE - 40, CURRENT_DATE + 480, 3, 0, 560
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = 'po-101');

INSERT INTO public.purchase_order_items (
  purchase_order_id, medicine_id, medicine_name_en, batch_number, mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
)
SELECT 'po-102', 'med-rigix-10', 'Rigix 10mg Tablet', 'AGP-990X', CURRENT_DATE - 15, CURRENT_DATE + 520, 5, 1, 192
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = 'po-102' AND medicine_id = 'med-rigix-10');

INSERT INTO public.purchase_order_items (
  purchase_order_id, medicine_id, medicine_name_en, batch_number, mfg_date, expiry_date, packs_ordered, bonus_packs, cost_per_pack
)
SELECT 'po-102', 'med-rocephin-1g', 'Rocephin 1g IV Injection', 'RCH-302N', CURRENT_DATE - 20, CURRENT_DATE + 400, 10, 0, 825
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = 'po-102' AND medicine_id = 'med-rocephin-1g');

INSERT INTO public.supplier_transactions (id, supplier_id, tx_date, type, amount, paid_amount, delivered_by, reference, note) VALUES
('stx-01', 'sup-mp', now() - interval '36 hours', 'delivery', 22020, 3620, 'Kamran Akmal (M&P Rider)', 'MP-CH-90218', 'Augmentin 625mg (40+2 Box) + Risek 40mg (20 Box) — Rs. 3,620 cash paid on spot'),
('stx-02', 'sup-mp', now() - interval '72 hours', 'delivery', 1680, 1680, 'Kamran Akmal (M&P Rider)', 'MP-INV-88342', 'Panadol 500mg (3 Box) — Full cash paid'),
('stx-03', 'sup-premier', now() - interval '120 hours', 'delivery', 14600, 5000, 'Tariq Mahmood (Premier Salesman)', 'PRM-77401', 'Abbott & Getz restock batch — Rs. 5,000 advance paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_shifts (id, opened_at, opened_by, opening_float, status) VALUES
('shift-active-01', date_trunc('day', now()) + interval '8 hours 30 minutes', 'Usman Tariq (Pharmacist)', 10000, 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.petty_expenses (id, shift_id, created_at, category, description, amount, recorded_by) VALUES
('exp-01', 'shift-active-01', now() - interval '180 minutes', 'Courier & Delivery', 'Home delivery rider fuel & cold-pack ice gel', 450, 'Usman Tariq (Pharmacist)'),
('exp-02', 'shift-active-01', now() - interval '95 minutes', 'Tea & Hospitality', 'Counter staff & doctor visit refreshments', 280, 'Usman Tariq (Pharmacist)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sale_invoices (
  id, invoice_number, created_at, cashier_name, customer_id, customer_name, customer_phone,
  doctor_name, rx_number, subtotal, item_discounts, extra_discount_rs, tax_percent,
  tax_amount, net_payable, payment_method, cash_tendered, change_due, status
) VALUES
('inv-1001', 'CP-2026-1001', now() - interval '145 minutes', 'Usman Tariq (Pharmacist)', NULL, 'Muhammad Bilal', '0300-4419820', 'Dr. Ayesha Siddiqa', 'RX-8821', 898, 0, 18, 0, 0, 880, 'cash', 1000, 120, 'completed'),
('inv-1002', 'CP-2026-1002', now() - interval '65 minutes', 'Usman Tariq (Pharmacist)', 'cust-02', 'Mrs. Shumaila Khan', '0321-8891204', '', '', 940, 24.5, 0, 0, 0, 915.5, 'easypaisa_jazzcash', 915.5, 0, 'completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sale_invoice_items (
  invoice_id, medicine_id, batch_id, batch_number, expiry_date, name_en, name_ur,
  sale_unit_type, quantity, units_deducted, unit_price, discount_percent, line_total,
  cost_total, dosage_label, requires_prescription
)
SELECT 'inv-1001', 'med-augmentin-625', 'bat-aug-01', 'AUG-219M', CURRENT_DATE + 22, 'Augmentin 625mg Tablet', 'آگمینٹن 625 ملی گرام گولی', 'pack', 2, 12, 415, 0, 830, 696, '1+0+1 After Meal · صبح و شام کھانے کے بعد', true
WHERE NOT EXISTS (SELECT 1 FROM public.sale_invoice_items WHERE invoice_id = 'inv-1001' AND medicine_id = 'med-augmentin-625');

INSERT INTO public.sale_invoice_items (
  invoice_id, medicine_id, batch_id, batch_number, expiry_date, name_en, name_ur,
  sale_unit_type, quantity, units_deducted, unit_price, discount_percent, line_total,
  cost_total, dosage_label, requires_prescription
)
SELECT 'inv-1001', 'med-panadol-500', 'bat-pan-01', 'PK-GSK-882A', CURRENT_DATE + 75, 'Panadol 500mg Tablet', 'پیناڈول 500 ملی گرام گولی', 'strip', 2, 20, 34, 0, 68, 56, 'SOS When Needed · بوقتِ ضرورت', false
WHERE NOT EXISTS (SELECT 1 FROM public.sale_invoice_items WHERE invoice_id = 'inv-1001' AND medicine_id = 'med-panadol-500');

INSERT INTO public.sale_invoice_items (
  invoice_id, medicine_id, batch_id, batch_number, expiry_date, name_en, name_ur,
  sale_unit_type, quantity, units_deducted, unit_price, discount_percent, line_total,
  cost_total, dosage_label, requires_prescription
)
SELECT 'inv-1002', 'med-risek-40', 'bat-ris-01', 'GTZ-771C', CURRENT_DATE + 290, 'Risek 40mg Capsule', 'رائزیک 40 ملی گرام کیپسول', 'pack', 1, 14, 490, 5, 465.5, 405, '1+0+0 Before Breakfast · نہار منہ روزانہ', false
WHERE NOT EXISTS (SELECT 1 FROM public.sale_invoice_items WHERE invoice_id = 'inv-1002' AND medicine_id = 'med-risek-40');

INSERT INTO public.sale_invoice_items (
  invoice_id, medicine_id, batch_id, batch_number, expiry_date, name_en, name_ur,
  sale_unit_type, quantity, units_deducted, unit_price, discount_percent, line_total,
  cost_total, dosage_label, requires_prescription
)
SELECT 'inv-1002', 'med-surbex-z', 'bat-sur-01', 'ABT-504Z', CURRENT_DATE + 510, 'Surbex-Z Tablet', 'سربیکس زیڈ وٹامن گولی', 'pack', 1, 30, 450, 0, 450, 375, '', false
WHERE NOT EXISTS (SELECT 1 FROM public.sale_invoice_items WHERE invoice_id = 'inv-1002' AND medicine_id = 'med-surbex-z');
