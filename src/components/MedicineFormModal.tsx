import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Package, RefreshCw, Sparkles, X } from 'lucide-react';
import { Medicine, MedicineBatch, MedicineCategory } from '../types/pharmacy';
import { generateEan13Barcode } from '../utils/barcode';
import { formatPKR } from '../i18n/translations';

interface MedicineFormModalProps {
  isOpen: boolean;
  mode: 'add_medicine' | 'edit_medicine' | 'add_batch';
  initialMedicine?: Medicine | null;
  onClose: () => void;
  onSaveMedicine: (med: Medicine, initialBatch?: Omit<MedicineBatch, 'id' | 'medicineId'>) => void;
  onSaveBatch: (medicineId: string, batch: Omit<MedicineBatch, 'id' | 'medicineId'>) => void;
}

const CATEGORIES: Array<{ value: MedicineCategory; label: string; ur: string }> = [
  { value: 'Tablet', label: 'Tablet', ur: 'گولی' },
  { value: 'Capsule', label: 'Capsule', ur: 'کیپسول' },
  { value: 'Syrup', label: 'Syrup', ur: 'شربت' },
  { value: 'Injection', label: 'Injection', ur: 'ٹیکہ' },
  { value: 'Drops', label: 'Drops', ur: 'قطرے' },
  { value: 'Ointment', label: 'Ointment / Cream', ur: 'مرہم / کریم' },
  { value: 'Surgical', label: 'Surgical / Other', ur: 'سرجیکل / دیگر' },
];

const PACK_PRESETS = [
  { label: 'Box 20 (2×10)', pack: 20, strip: 10, loose: true },
  { label: 'Box 10 (1×10)', pack: 10, strip: 10, loose: true },
  { label: 'Box 30 (3×10)', pack: 30, strip: 10, loose: true },
  { label: 'Single Bottle / Pack (1×1)', pack: 1, strip: 1, loose: false },
];

function addMonthsIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const MedicineFormModal: React.FC<MedicineFormModalProps> = ({
  isOpen,
  mode,
  initialMedicine,
  onClose,
  onSaveMedicine,
  onSaveBatch,
}) => {
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  const [genericSalt, setGenericSalt] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState<MedicineCategory>('Tablet');
  const [barcode, setBarcode] = useState('');
  const [rackLocation, setRackLocation] = useState('A-01');
  const [packSize, setPackSize] = useState(20);
  const [stripSize, setStripSize] = useState(10);
  const [allowLooseSale, setAllowLooseSale] = useState(true);
  const [mrpPerPack, setMrpPerPack] = useState(300);
  const [costPerPack, setCostPerPack] = useState(245);
  const [minStockUnits, setMinStockUnits] = useState(20);
  const [requiresPrescription, setRequiresPrescription] = useState(false);

  // Batch & intuitive stock entry
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(() => addMonthsIso(18));
  const [stockEntryMode, setStockEntryMode] = useState<'packs' | 'units'>('packs');
  const [packsCount, setPacksCount] = useState(5);
  const [directUnitsCount, setDirectUnitsCount] = useState(100);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit_medicine' && initialMedicine) {
      setNameEn(initialMedicine.nameEn);
      setNameUr(initialMedicine.nameUr);
      setGenericSalt(initialMedicine.genericSalt);
      setManufacturer(initialMedicine.manufacturer);
      setCategory(initialMedicine.category);
      setBarcode(initialMedicine.barcode);
      setRackLocation(initialMedicine.rackLocation);
      setPackSize(initialMedicine.packSize);
      setStripSize(initialMedicine.stripSize);
      setAllowLooseSale(initialMedicine.allowLooseSale);
      setMrpPerPack(initialMedicine.mrpPerPack);
      setCostPerPack(initialMedicine.costPerPack);
      setMinStockUnits(initialMedicine.minStockUnits);
      setRequiresPrescription(initialMedicine.requiresPrescription);
    } else if (mode === 'add_medicine') {
      setNameEn('');
      setNameUr('');
      setGenericSalt('');
      setManufacturer('');
      setCategory('Tablet');
      setBarcode(generateEan13Barcode());
      setRackLocation('A-10');
      setPackSize(20);
      setStripSize(10);
      setAllowLooseSale(true);
      setMrpPerPack(300);
      setCostPerPack(245);
      setMinStockUnits(20);
      setRequiresPrescription(false);
      setBatchNumber('CP-' + Math.floor(1000 + Math.random() * 9000));
      setMfgDate(new Date().toISOString().slice(0, 10));
      setExpiryDate(addMonthsIso(18));
      setStockEntryMode('packs');
      setPacksCount(5);
      setDirectUnitsCount(100);
    } else if (mode === 'add_batch') {
      setBatchNumber('NEW-' + Math.floor(1000 + Math.random() * 9000));
      setMfgDate(new Date().toISOString().slice(0, 10));
      setExpiryDate(addMonthsIso(18));
      setStockEntryMode('packs');
      setPacksCount(5);
      setDirectUnitsCount(initialMedicine ? initialMedicine.packSize * 5 : 50);
    }
  }, [isOpen, mode, initialMedicine]);

  const effectivePackSize =
    mode === 'add_batch' && initialMedicine
      ? Math.max(1, initialMedicine.packSize)
      : Math.max(1, Number(packSize) || 1);

  const effectiveStripSize =
    mode === 'add_batch' && initialMedicine
      ? Math.max(1, Math.min(effectivePackSize, initialMedicine.stripSize))
      : Math.max(1, Math.min(effectivePackSize, Number(stripSize) || 1));

  const effectiveMrp =
    mode === 'add_batch' && initialMedicine ? initialMedicine.mrpPerPack : Math.max(0, Number(mrpPerPack) || 0);

  const effectiveCost =
    mode === 'add_batch' && initialMedicine ? initialMedicine.costPerPack : Math.max(0, Number(costPerPack) || 0);

  const calculatedTotalUnits = useMemo(() => {
    if (stockEntryMode === 'packs') {
      return Math.max(1, (Number(packsCount) || 0) * effectivePackSize);
    }
    return Math.max(1, Number(directUnitsCount) || 0);
  }, [stockEntryMode, packsCount, directUnitsCount, effectivePackSize]);

  const livePricing = useMemo(() => {
    const perUnitSale = effectivePackSize > 0 ? effectiveMrp / effectivePackSize : effectiveMrp;
    const perStripSale = perUnitSale * effectiveStripSize;
    const profitPerBox = effectiveMrp - effectiveCost;
    const marginPct = effectiveMrp > 0 ? (profitPerBox / effectiveMrp) * 100 : 0;
    const stockRetailValue = (calculatedTotalUnits / effectivePackSize) * effectiveMrp;
    const stockCostValue = (calculatedTotalUnits / effectivePackSize) * effectiveCost;
    const stripsInStock = effectiveStripSize > 0 ? Math.floor(calculatedTotalUnits / effectiveStripSize) : 0;

    return {
      perUnitSale,
      perStripSale,
      profitPerBox,
      marginPct,
      stockRetailValue,
      stockCostValue,
      stripsInStock,
    };
  }, [effectivePackSize, effectiveStripSize, effectiveMrp, effectiveCost, calculatedTotalUnits]);

  if (!isOpen) return null;

  const handleCategoryChange = (nextCat: MedicineCategory) => {
    setCategory(nextCat);
    if (mode === 'add_medicine') {
      if (nextCat === 'Syrup' || nextCat === 'Injection' || nextCat === 'Drops' || nextCat === 'Ointment' || nextCat === 'Surgical') {
        setPackSize(1);
        setStripSize(1);
        setAllowLooseSale(false);
        setMinStockUnits(5);
      } else {
        setPackSize(20);
        setStripSize(10);
        setAllowLooseSale(true);
        setMinStockUnits(20);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'add_batch' && initialMedicine) {
      onSaveBatch(initialMedicine.id, {
        batchNumber: batchNumber.trim() || 'BATCH-01',
        mfgDate,
        expiryDate,
        quantityUnits: calculatedTotalUnits,
      });
      onClose();
      return;
    }

    const safePack = Math.max(1, Number(packSize) || 1);
    const safeStrip = Math.max(1, Math.min(safePack, Number(stripSize) || 1));

    const med: Medicine = {
      id: mode === 'edit_medicine' && initialMedicine ? initialMedicine.id : `med-${Date.now()}`,
      barcode: barcode.trim() || generateEan13Barcode(),
      nameEn: nameEn.trim(),
      nameUr: nameUr.trim() || nameEn.trim(),
      genericSalt: genericSalt.trim() || nameEn.trim(),
      manufacturer: manufacturer.trim() || 'Standard Pharma',
      category,
      rackLocation: rackLocation.trim() || 'A-01',
      packSize: safePack,
      stripSize: safeStrip,
      allowLooseSale,
      mrpPerPack: Math.max(1, Number(mrpPerPack) || 1),
      costPerPack: Math.max(1, Number(costPerPack) || 1),
      minStockUnits: Math.max(1, Number(minStockUnits) || 1),
      requiresPrescription,
    };

    onSaveMedicine(
      med,
      mode === 'add_medicine'
        ? {
            batchNumber: batchNumber.trim() || 'B-001',
            mfgDate,
            expiryDate,
            quantityUnits: calculatedTotalUnits,
          }
        : undefined
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              {mode === 'add_medicine' && 'Add New Medicine & Stock (نئی دوائی شامل کریں)'}
              {mode === 'edit_medicine' && 'Edit Medicine Details (دوائی میں تبدیلی کریں)'}
              {mode === 'add_batch' && `Add Stock Batch — ${initialMedicine?.nameEn}`}
            </h2>
            <p className="font-urdu text-xs text-slate-500 dark:text-slate-400" dir="rtl">
              {mode === 'add_batch'
                ? 'صرف ڈبیاں (Boxes) اور ایکسپائری تاریخ لکھیں — کل گولیاں خودکار شمار ہوں گی'
                : 'ساری تفصیلات (نام، قیمت، کتنی ڈبیاں آئیں، ایکسپائری) آسانی سے درج کریں'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto">
          {mode !== 'add_batch' && (
            <>
              {/* Step 1: Basic Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    1. Medicine Name & Formula · دوائی کی بنیادی معلومات
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Medicine Name (دوائی کا نام) *
                    </label>
                    <input
                      required
                      autoFocus
                      type="text"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      placeholder="e.g. Panadol 500mg / Augmentin 625mg"
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Urdu Name — Optional (اردو نام)
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={nameUr}
                      onChange={(e) => setNameUr(e.target.value)}
                      placeholder="خالی چھوڑیں تو خودکار انگلش نام آجائے گا"
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-urdu text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Formula / Generic Salt (فارمولا)
                    </label>
                    <input
                      type="text"
                      value={genericSalt}
                      onChange={(e) => setGenericSalt(e.target.value)}
                      placeholder="e.g. Paracetamol 500mg"
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Company (کمپنی)
                    </label>
                    <input
                      type="text"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="e.g. GSK / Getz / Sami"
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Barcode (ڈبے کا بار کوڈ اسکین یا آٹو بنائیں) *
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        required
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Scan barcode here..."
                        className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setBarcode(generateEan13Barcode())}
                        title="Auto-generate new barcode"
                        className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>New</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Category (قسم)
                      </label>
                      <select
                        value={category}
                        onChange={(e) => handleCategoryChange(e.target.value as MedicineCategory)}
                        className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label} ({c.ur})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Shelf / Rack (خانہ نمبر)
                      </label>
                      <input
                        type="text"
                        value={rackLocation}
                        onChange={(e) => setRackLocation(e.target.value)}
                        placeholder="A-01"
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Packing & Pricing with Live Calculator */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>2. Packing & Prices · پیکنگ اور قیمت</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {PACK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setPackSize(preset.pack);
                          setStripSize(preset.strip);
                          setAllowLooseSale(preset.loose);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          packSize === preset.pack && stripSize === preset.strip
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tablets / Box (1 ڈبی میں)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={packSize}
                      onChange={(e) => setPackSize(Math.max(1, Number(e.target.value)))}
                      className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tablets / Patta (1 پتے میں)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={stripSize}
                      onChange={(e) => setStripSize(Math.max(1, Number(e.target.value)))}
                      className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Sale Price / Box (فروخت) *
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      step="0.5"
                      value={mrpPerPack}
                      onChange={(e) => setMrpPerPack(Number(e.target.value))}
                      className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Cost / Box (خرید قیمت) *
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      step="0.5"
                      value={costPerPack}
                      onChange={(e) => setCostPerPack(Number(e.target.value))}
                      className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Low Alert (کم اسٹاک الرٹ)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minStockUnits}
                      onChange={(e) => setMinStockUnits(Number(e.target.value))}
                      className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                    />
                  </div>
                </div>

                {/* Live Auto-Calculated Breakdown */}
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      1 Box ({effectivePackSize} units)
                    </div>
                    <div className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                      {formatPKR(effectiveMrp)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      1 Patta ({effectiveStripSize} units)
                    </div>
                    <div className="font-mono-num font-bold text-emerald-700 dark:text-emerald-400">
                      {formatPKR(livePricing.perStripSale)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      1 Tablet / Unit
                    </div>
                    <div className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                      {formatPKR(livePricing.perUnitSale)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Profit / Box (منافع)
                    </div>
                    <div
                      className={`font-mono-num font-bold ${
                        livePricing.profitPerBox >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatPKR(livePricing.profitPerBox)} ({livePricing.marginPct.toFixed(1)}%)
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowLooseSale}
                      onChange={(e) => setAllowLooseSale(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>Allow Single Piece / Tablet Sale (1 پیس / گولی بیچنے کی اجازت)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresPrescription}
                      onChange={(e) => setRequiresPrescription(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>Doctor Prescription Required [Rx] (ڈاکٹر کا نسخہ لازمی)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Opening Stock / New Batch */}
          {mode !== 'edit_medicine' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {mode === 'add_batch'
                      ? 'New Stock & Expiry · نیا مال اور ایکسپائری'
                      : '3. Opening Stock (کتنا مال آیا؟)'}
                  </span>
                </span>

                {/* Easy Toggle: Enter in Boxes vs Units */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setStockEntryMode('packs')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      stockEntryMode === 'packs'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    By Boxes / ڈبیاں ({effectivePackSize}/box)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockEntryMode('units')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      stockEntryMode === 'units'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    By Individual Units / گولیاں
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {stockEntryMode === 'packs'
                      ? 'How Many Boxes? (کتنی ڈبیاں؟) *'
                      : 'Total Units (کل گولیاں/پیس) *'}
                  </label>
                  {stockEntryMode === 'packs' ? (
                    <input
                      required
                      type="number"
                      min={1}
                      value={packsCount}
                      onChange={(e) => setPacksCount(Math.max(1, Number(e.target.value)))}
                      className="w-full h-10 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 font-mono-num text-sm font-bold text-emerald-900 dark:text-emerald-200"
                    />
                  ) : (
                    <input
                      required
                      type="number"
                      min={1}
                      value={directUnitsCount}
                      onChange={(e) => setDirectUnitsCount(Math.max(1, Number(e.target.value)))}
                      className="w-full h-10 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 font-mono-num text-sm font-bold text-emerald-900 dark:text-emerald-200"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Batch # (بیچ نمبر) *
                  </label>
                  <input
                    required
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Mfg Date (تاریخ تیاری)
                  </label>
                  <input
                    required
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Expiry Date (ایکسپائری) *
                    </label>
                    <div className="flex items-center gap-1">
                      {[
                        { label: '+1Y', mo: 12 },
                        { label: '+2Y', mo: 24 },
                      ].map((exp) => (
                        <button
                          key={exp.label}
                          type="button"
                          onClick={() => setExpiryDate(addMonthsIso(exp.mo))}
                          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono-num text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        >
                          {exp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    required
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm"
                  />
                </div>
              </div>

              {/* Instant Total Stock & Value Banner */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Stock to Add:{' '}
                    <strong className="font-mono-num text-emerald-700 dark:text-emerald-400">
                      {calculatedTotalUnits} Units
                    </strong>
                    {effectivePackSize > 1 && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        ({Math.floor(calculatedTotalUnits / effectivePackSize)} Boxes ·{' '}
                        {livePricing.stripsInStock} Pattay)
                      </span>
                    )}
                  </span>
                </div>
                <div className="font-mono-num flex items-center gap-4 text-slate-700 dark:text-slate-300">
                  <span>
                    Cost Total: <strong>{formatPKR(livePricing.stockCostValue)}</strong>
                  </span>
                  <span>
                    Sale Total: <strong className="text-emerald-700 dark:text-emerald-400">{formatPKR(livePricing.stockRetailValue)}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>All fields auto-calculate patta & tablet prices for instant POS billing</span>
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                {mode === 'add_batch'
                  ? `Add ${calculatedTotalUnits} Units to Stock`
                  : mode === 'edit_medicine'
                  ? 'Update Medicine'
                  : 'Save Medicine & Stock'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
