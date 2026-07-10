import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class ResendOtpDto {
  @IsEmail()
  email!: string;
}

/** A 6-digit authenticator code or an 8–12 char recovery code (with optional dash). */
export class MfaCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}

export class MfaVerifyLoginDto {
  @IsString()
  @MinLength(10)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}
