import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class SignupDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\-\/\\+\*@#_]).{8,}$/, {
    message:
      'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character (- / \\ + * @ # _)',
  })
  password: string;

  @IsNotEmpty()
  @IsString()
  organizationName: string;
}
