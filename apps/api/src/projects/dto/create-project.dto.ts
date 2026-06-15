import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ProjectStatus } from '../entities/project.entity';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  start_date?: string | null;

  @IsOptional()
  end_date?: string | null;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsNumber()
  target_selling_price?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  print_time_seconds?: number;

  @IsOptional()
  @IsNumber()
  labor_time_seconds?: number;

  @IsOptional()
  @IsNumber()
  machine_hourly_rate?: number;

  @IsOptional()
  @IsNumber()
  labor_hourly_rate?: number;

  @IsOptional()
  @IsNumber()
  misc_costs?: number;

  @IsOptional()
  @IsNumber()
  printer_power_kw?: number;

  @IsOptional()
  @IsNumber()
  electricity_cost_kwh?: number;

  @IsOptional()
  @IsArray()
  overhead_rates?: Array<{ label: string; percentage: number }>;
}
