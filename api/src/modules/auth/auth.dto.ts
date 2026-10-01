import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'reception@hotel.local' }) @IsEmail() email: string;
  @ApiProperty({ example: 'ChangeMe!2026' }) @IsString() @MinLength(1) password: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @MinLength(10) refreshToken: string;
}

export class MfaVerifyDto {
  @ApiProperty({ description: 'Jeton `mfaToken` renvoyé par /auth/login' }) @IsString() mfaToken: string;
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6) code: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6) code: string;
}
