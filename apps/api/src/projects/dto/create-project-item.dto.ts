import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProjectItemDto {
  @IsOptional()
  @IsNumber()
  filamentId?: number;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsNumber()
  weight_required_g: number;
}
