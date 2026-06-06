import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsNotEmpty()
  @IsString()
  provider: 'google' | 'apple';

  @IsNotEmpty()
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  socialId?: string;
}
