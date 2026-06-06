import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class CreateTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class CreateColorReferenceDto {
  @IsNumber()
  brandId: number;

  @IsNumber()
  @IsOptional()
  materialId?: number | null;

  @IsNumber()
  @IsOptional()
  typeId?: number | null;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  primaryHex: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hexes?: string[];

  @IsString()
  @IsOptional()
  source?: 'manual' | 'spoolman';

  @IsString()
  @IsOptional()
  sourceExternalId?: string | null;

  @IsString()
  @IsOptional()
  finish?: string | null;

  @IsString()
  @IsOptional()
  pattern?: string | null;

  @IsString()
  @IsOptional()
  multiColorDirection?: string | null;

  @IsBoolean()
  @IsOptional()
  translucent?: boolean | null;

  @IsBoolean()
  @IsOptional()
  glow?: boolean | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}
