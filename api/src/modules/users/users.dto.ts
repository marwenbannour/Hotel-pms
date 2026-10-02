import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { LANGS, Lang } from '../../common/i18n';
import { ROLES, Role } from '../../common/permissions';

/** Mot de passe initial ou réinitialisé : longueur minimale plutôt que règles de composition (NIST 800-63B). */
const PASSWORD = { min: 12, max: 128 };

export class CreateUserDto {
  @ApiProperty({ example: 'nadia@hotel.local' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Nadia Haddad' }) @IsString() @Length(1, 120) fullName: string;
  @ApiProperty({ enum: ROLES }) @IsIn(ROLES) role: Role;
  @ApiPropertyOptional({ enum: LANGS, default: 'fr' }) @IsOptional() @IsIn(LANGS) locale?: Lang;
  @ApiProperty({ minLength: PASSWORD.min, description: 'Mot de passe initial, à communiquer à la personne' })
  @IsString() @Length(PASSWORD.min, PASSWORD.max) password: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) fullName?: string;
  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES) role?: Role;
  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS) locale?: Lang;
  @ApiPropertyOptional({ description: 'false : le compte ne peut plus se connecter et ses sessions sont fermées' })
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: PASSWORD.min }) @IsString() @Length(PASSWORD.min, PASSWORD.max) password: string;
}
