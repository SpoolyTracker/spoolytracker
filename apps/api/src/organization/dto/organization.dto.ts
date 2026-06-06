import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsEmail,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AddMemberDto {
  @IsNumber()
  @IsOptional()
  userId: number;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @IsEnum(['admin', 'member'])
  role?: 'admin' | 'member';
}
