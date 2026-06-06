import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional()
  image_url?: string;

  @IsOptional()
  target_selling_price?: number;

  @IsOptional()
  notes?: string;

  @IsOptional()
  start_date?: string | null;

  @IsOptional()
  end_date?: string | null;
}
