import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StorageUnitKind } from '../storage-unit.entity';

export class CreateStorageUnitDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  location?: string | null;

  @IsIn(['shelf', 'cabinet', 'display', 'bin'])
  @IsOptional()
  kind?: StorageUnitKind;

  @IsNumber()
  @Min(1)
  levels: number;

  @IsNumber()
  @Min(1)
  slotsPerLevel: number;

  @IsString()
  @IsOptional()
  tagId?: string | null;

  @IsBoolean()
  @IsOptional()
  favorite?: boolean;
}

export class UpdateStorageUnitDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string | null;

  @IsIn(['shelf', 'cabinet', 'display', 'bin'])
  @IsOptional()
  kind?: StorageUnitKind;

  @IsNumber()
  @Min(1)
  @IsOptional()
  levels?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  slotsPerLevel?: number;

  @IsString()
  @IsOptional()
  tagId?: string | null;

  @IsBoolean()
  @IsOptional()
  favorite?: boolean;
}

export class PlaceFilamentDto {
  @IsNumber()
  @IsOptional()
  storageUnitId?: number | null;

  @IsNumber()
  @IsOptional()
  storageLevel?: number | null;

  @IsNumber()
  @IsOptional()
  storageSlot?: number | null;
}
