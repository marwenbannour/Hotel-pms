import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination';
import { GUEST_SEGMENTS, GuestSegment } from '../../database/entities/guest.entity';

export class CreateGuestDto {
  @ApiProperty({ example: 'Amina' }) @IsString() @Length(1, 100) firstName: string;
  @ApiProperty({ example: 'Benali' }) @IsString() @Length(1, 100) lastName: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ example: '+33612345678' }) @IsOptional() @Matches(/^\+?[0-9 ().-]{6,20}$/) phone?: string;
  @ApiPropertyOptional({ example: 'FR', description: 'Code pays ISO 3166-1 alpha-2' }) @IsOptional() @Matches(/^[A-Z]{2}$/) nationality?: string;
  @ApiPropertyOptional({ enum: GUEST_SEGMENTS }) @IsOptional() @IsIn(GUEST_SEGMENTS) segment?: GuestSegment;
  @ApiPropertyOptional({ example: { pillow: 'firm', floor: 'high' } }) @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
export class UpdateGuestDto extends PartialType(CreateGuestDto) {}

export class ListGuestsQuery extends CursorQueryDto {
  @ApiPropertyOptional({ description: 'Recherche sur nom, prénom ou email' }) @IsOptional() @IsString() @Length(2, 100) q?: string;
  @ApiPropertyOptional({ enum: GUEST_SEGMENTS }) @IsOptional() @IsIn(GUEST_SEGMENTS) segment?: GuestSegment;
  @ApiPropertyOptional({ description: 'last_name | -last_name | created_at | -created_at' }) @IsOptional() @IsString() sort?: string;
}
