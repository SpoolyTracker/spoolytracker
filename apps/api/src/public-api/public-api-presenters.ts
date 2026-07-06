import { Filament } from '../filament/filament.entity';

export function toPublicFilament(filament: Filament) {
  return {
    id: filament.id,
    spoolReference: filament.spoolReference,
    brand: filament.brand
      ? { id: filament.brand.id, name: filament.brand.name }
      : null,
    material: filament.material
      ? { id: filament.material.id, name: filament.material.name }
      : null,
    types:
      filament.types?.map((type) => ({ id: type.id, name: type.name })) || [],
    color: filament.color,
    colorHex: filament.colorHex,
    colorName: filament.colorName,
    colors: filament.colors || [],
    weightInitial: filament.weightInitial,
    weightRemaining: filament.weightRemaining,
    virtualWeightRemaining: filament.virtualWeightRemaining,
    plannedWeight: filament.plannedWeight,
    lowStockThreshold: filament.lowStockThreshold,
    lowStockThresholdType: filament.lowStockThresholdType,
    diameterMm: filament.diameterMm,
    densityGcm3: filament.densityGcm3,
    isLocked: filament.isLocked,
    createdAt: filament.createdAt,
    updatedAt: filament.updatedAt,
  };
}

export function toPublicConsumptionLog(log: any) {
  return {
    id: log.id,
    filamentId: log.filamentId,
    amount: log.amount,
    type: log.type,
    notes: log.notes,
    date: log.date,
    externalJobId: log.externalJobId,
    isPlanned: log.is_planned,
    printTaskId: log.printTaskId,
    printStatus: log.printStatus,
    plannedPrintAmount: log.plannedPrintAmount,
    failureProgressPercent: log.failureProgressPercent,
    filament: log.filament ? toPublicFilament(log.filament) : null,
  };
}
