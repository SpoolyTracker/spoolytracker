import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class ConsumeGroupDto {
  @IsNumber()
  brandId: number;

  @IsNumber()
  materialId: number;

  @IsString()
  color: string;

  @IsOptional()
  @IsNumber()
  typeId?: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  plannedPrintAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  failureProgressPercent?: number;

  @IsOptional()
  @IsString()
  type?: 'MANUAL' | 'PRINT' | 'FAIL';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  isPlanned?: boolean;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  printStatus?: 'SUCCESS' | 'FAILED';
}
