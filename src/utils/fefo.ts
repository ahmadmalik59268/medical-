import {
  BatchHealthStatus,
  Medicine,
  MedicineBatch,
  SaleUnitType,
} from '../types/pharmacy';

export function daysUntilDate(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getBatchHealth(batch: MedicineBatch): BatchHealthStatus {
  if (batch.quarantined) return 'quarantined';
  const days = daysUntilDate(batch.expiryDate);
  if (days <= 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'healthy';
}

export function getSellableBatches(medicineId: string, batches: MedicineBatch[]): MedicineBatch[] {
  return batches
    .filter((b) => {
      if (b.medicineId !== medicineId || b.quantityUnits <= 0 || b.quarantined) return false;
      return daysUntilDate(b.expiryDate) > 0;
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function getBestFefoBatch(medicineId: string, batches: MedicineBatch[]): MedicineBatch | null {
  const sellable = getSellableBatches(medicineId, batches);
  return sellable.length > 0 ? sellable[0] : null;
}

export function getTotalSellableUnits(medicineId: string, batches: MedicineBatch[]): number {
  return getSellableBatches(medicineId, batches).reduce((sum, b) => sum + b.quantityUnits, 0);
}

export function getExpiredOrQuarantinedBatches(medicineId: string, batches: MedicineBatch[]): MedicineBatch[] {
  return batches.filter((b) => {
    if (b.medicineId !== medicineId || b.quantityUnits <= 0) return false;
    return b.quarantined || daysUntilDate(b.expiryDate) <= 0;
  });
}

export function calculateUnitPricing(
  medicine: Medicine,
  saleUnitType: SaleUnitType
): { unitsPerSelectedUnit: number; unitPrice: number; costPerBaseUnit: number } {
  const safePackSize = Math.max(1, medicine.packSize);
  const safeStripSize = Math.max(1, Math.min(safePackSize, medicine.stripSize));
  const pricePerBaseUnit = medicine.mrpPerPack / safePackSize;
  const costPerBaseUnit = medicine.costPerPack / safePackSize;

  if (saleUnitType === 'pack') {
    return {
      unitsPerSelectedUnit: safePackSize,
      unitPrice: Math.round(medicine.mrpPerPack * 100) / 100,
      costPerBaseUnit,
    };
  }
  if (saleUnitType === 'strip') {
    return {
      unitsPerSelectedUnit: safeStripSize,
      unitPrice: Math.round(pricePerBaseUnit * safeStripSize * 100) / 100,
      costPerBaseUnit,
    };
  }
  return {
    unitsPerSelectedUnit: 1,
    unitPrice: Math.round(pricePerBaseUnit * 100) / 100,
    costPerBaseUnit,
  };
}

export function formatStockReadable(totalUnits: number, medicine: Medicine): string {
  if (totalUnits <= 0) return '0';
  if (medicine.packSize <= 1) return `${totalUnits} Box`;
  const packs = Math.floor(totalUnits / medicine.packSize);
  const rem = totalUnits % medicine.packSize;
  if (packs > 0 && rem > 0) return `${packs} Box + ${rem}u`;
  if (packs > 0) return `${packs} Box (${totalUnits}u)`;
  return `${rem}u`;
}

export function findSaltSubstitutes(
  sourceMedicine: Medicine,
  allMedicines: Medicine[],
  batches: MedicineBatch[]
): Array<{ medicine: Medicine; sellableUnits: number; bestBatch: MedicineBatch | null }> {
  const normalizedSalt = sourceMedicine.genericSalt.trim().toLowerCase();
  return allMedicines
    .filter(
      (m) =>
        m.id !== sourceMedicine.id &&
        m.genericSalt.trim().toLowerCase() === normalizedSalt
    )
    .map((m) => ({
      medicine: m,
      sellableUnits: getTotalSellableUnits(m.id, batches),
      bestBatch: getBestFefoBatch(m.id, batches),
    }))
    .sort((a, b) => b.sellableUnits - a.sellableUnits);
}
