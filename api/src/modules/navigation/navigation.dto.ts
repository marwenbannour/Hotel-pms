import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '../../common/permissions';

export class CreateNavigationItemDto {
  @ApiProperty({ example: 'reservations' }) @Matches(/^[a-z0-9][a-z0-9._-]{0,63}$/) key: string;
  @ApiPropertyOptional({ example: 'frontdesk' }) @IsOptional() @IsString() parentKey?: string | null;
  @ApiPropertyOptional({ example: '/reservations' }) @IsOptional() @IsString() @MaxLength(200) path?: string | null;
  @ApiPropertyOptional({ example: 'calendar' }) @IsOptional() @IsString() @MaxLength(50) icon?: string | null;
  @ApiPropertyOptional({ enum: PERMISSIONS }) @IsOptional() @IsIn(PERMISSIONS as unknown as string[]) permission?: string | null;
  @ApiPropertyOptional({ example: 'core', default: 'core' }) @IsOptional() @IsString() module?: string;
  @ApiProperty() @IsString() @MinLength(1) labelFr: string;
  @ApiProperty() @IsString() @MinLength(1) labelEn: string;
  @ApiProperty() @IsString() @MinLength(1) labelAr: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateNavigationItemDto extends PartialType(CreateNavigationItemDto) {}
