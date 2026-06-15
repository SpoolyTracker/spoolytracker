import { IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateProjectExternalItemDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  external_ref?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsNumber()
  @Min(0)
  quantity: number;
}
