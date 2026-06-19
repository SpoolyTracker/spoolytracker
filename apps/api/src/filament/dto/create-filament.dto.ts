import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConditionalTemperatureRuleDto {
  @IsNumber()
  @IsOptional()
  speedMinMmS?: number | null;

  @IsNumber()
  @IsOptional()
  speedMaxMmS?: number | null;

  @IsNumber()
  @IsOptional()
  nozzleTempMin?: number | null;

  @IsNumber()
  @IsOptional()
  nozzleTempMax?: number | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}

export class CreateFilamentDto {
  @IsNumber()
  @IsOptional()
  brandId: number;

  @IsNumber()
  @IsOptional()
  materialId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  typeIds: number[];

  @IsString()
  @IsOptional()
  color: string;

  @IsString()
  @IsOptional()
  colorHex: string;

  @IsString()
  @IsOptional()
  colorName: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @IsNumber()
  @IsOptional()
  colorReferenceId?: number | null;

  @IsNumber()
  weightInitial: number;

  @IsNumber()
  weightRemaining: number;

  @IsString()
  @IsOptional()
  nfcTagId?: string | null;

  // Inventory Fields
  @IsDateString()
  @IsOptional()
  purchaseDate?: string | null;

  @IsNumber()
  @IsOptional()
  price?: number | null;

  @IsString()
  @IsOptional()
  vendor?: string | null;

  @IsBoolean()
  @IsOptional()
  isRefill?: boolean;

  @IsBoolean()
  @IsOptional()
  favorite?: boolean;

  @IsString()
  @IsOptional()
  lotNumber?: string | null;

  @IsString()
  @IsOptional()
  spoolReference?: string | null;

  @IsNumber()
  @IsOptional()
  storageUnitId?: number | null;

  @IsNumber()
  @IsOptional()
  storageLevel?: number | null;

  @IsNumber()
  @IsOptional()
  storageSlot?: number | null;

  // Technical Specs
  @IsNumber()
  @IsOptional()
  nozzleTempMin?: number | null;

  @IsNumber()
  @IsOptional()
  nozzleTempMax?: number | null;

  @IsNumber()
  @IsOptional()
  bedTempMin?: number | null;

  @IsNumber()
  @IsOptional()
  bedTempMax?: number | null;

  @IsNumber()
  @IsOptional()
  bedTemp?: number | null;

  @IsNumber()
  @IsOptional()
  chamberTempMin?: number | null;

  @IsNumber()
  @IsOptional()
  chamberTempMax?: number | null;

  @IsNumber()
  @IsOptional()
  dryTemp?: number | null;

  @IsNumber()
  @IsOptional()
  dryTime?: number | null;

  @IsNumber()
  @IsOptional()
  printSpeedMin?: number | null;

  @IsNumber()
  @IsOptional()
  printSpeedMax?: number | null;

  @IsNumber()
  @IsOptional()
  retractionDistanceMm?: number | null;

  @IsNumber()
  @IsOptional()
  retractionSpeedMmS?: number | null;

  @IsNumber()
  @IsOptional()
  retractionZHopMm?: number | null;

  @IsString()
  @IsOptional()
  retractionNotes?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionalTemperatureRuleDto)
  @IsOptional()
  conditionalTemperatureRules?: ConditionalTemperatureRuleDto[];

  @IsNumber()
  @IsOptional()
  kFactor?: number | null;

  @IsNumber()
  @IsOptional()
  maxVolumetricSpeedMm3S?: number | null;

  @IsNumber()
  @IsOptional()
  flowRatio?: number | null;

  @IsNumber()
  @IsOptional()
  densityGcm3?: number | null;

  @IsNumber()
  @IsOptional()
  diameterMm?: number | null;

  @IsNumber()
  @IsOptional()
  lowStockThreshold?: number | null;

  @IsString()
  @IsOptional()
  lowStockThresholdType?: 'GRAMS' | 'PERCENTAGE';

  @IsNumber()
  @IsOptional()
  weightUsed?: number | null;

  @IsArray()
  @IsOptional()
  selectedOptions?: any[];

  // Multi-Select Options
  @IsArray()
  @IsOptional()
  options?: number[];

  @IsString()
  @IsOptional()
  customBrandName?: string;

  @IsString()
  @IsOptional()
  customTypeName?: string;

  @IsNumber()
  @IsOptional()
  organizationId?: number;

  // TigerTag Mapping Fields
  @IsNumber()
  @IsOptional()
  tigerBrandId?: number;

  @IsNumber()
  @IsOptional()
  tigerMaterialId?: number;

  @IsNumber()
  @IsOptional()
  tigerTypeId?: number;

  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;

  @IsNumber()
  @IsOptional()
  plannedWeight?: number;

  @IsNumber()
  @IsOptional()
  virtualWeightRemaining?: number;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}
