import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination';
import { BOARDS, Board, CHANNELS, Channel } from '../../database/entities/reservation.entity';
import { CreateGuestDto } from '../guests/guests.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: '$property doit être une date au format YYYY-MM-DD' };

export class CreateReservationDto {
  @ApiPropertyOptional({ description: 'Client existant (ou fournir `guest`)' }) @IsOptional() @IsUUID() guestId?: string;
  @ApiPropertyOptional({ type: CreateGuestDto, description: 'Nouveau client créé avec la réservation' })
  @IsOptional() @ValidateNested() @Type(() => CreateGuestDto) guest?: CreateGuestDto;
  @ApiProperty() @IsUUID() roomTypeId: string;
  @ApiProperty({ example: '2026-10-12' }) @Matches(DATE, DATE_MSG) arrivalDate: string;
  @ApiProperty({ example: '2026-10-14', description: 'Date de départ (nuit non incluse)' }) @Matches(DATE, DATE_MSG) departureDate: string;
  @ApiProperty({ example: 2 }) @IsInt() @Min(1) adults: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() @Min(0) children?: number;
  @ApiProperty({ enum: BOARDS }) @IsIn(BOARDS) board: Board;
  @ApiProperty({ enum: CHANNELS }) @IsIn(CHANNELS) channel: Channel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateReservationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() roomTypeId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) arrivalDate?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) departureDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) adults?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) children?: number;
  @ApiPropertyOptional({ enum: BOARDS }) @IsOptional() @IsIn(BOARDS) board?: Board;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CancelReservationDto {
  @ApiProperty({ example: 'Demande du client' }) @IsString() @MaxLength(500) reason: string;
}

export class AssignRoomDto {
  @ApiProperty({ nullable: true, description: 'Chambre à pré-attribuer, ou null pour retirer l’attribution' })
  @IsOptional() @IsUUID() roomId: string | null;
}

export class PlanningQuery {
  @ApiProperty({ example: '2026-10-01' }) @Matches(DATE, DATE_MSG) from: string;
  @ApiProperty({ example: '2026-10-15', description: 'Exclu ; 31 jours maximum' }) @Matches(DATE, DATE_MSG) to: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Chambre choisie ; sinon attribution automatique' }) @IsOptional() @IsUUID() roomId?: string;
}

export class ListReservationsQuery extends CursorQueryDto {
  @ApiPropertyOptional({ example: 'confirmed,checked_in', description: 'Un ou plusieurs statuts séparés par des virgules' })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: '2026-10-01' }) @IsOptional() @Matches(DATE, DATE_MSG) arrival_from?: string;
  @ApiPropertyOptional({ example: '2026-10-31' }) @IsOptional() @Matches(DATE, DATE_MSG) arrival_to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() guest_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional({ description: 'Recherche : référence, nom, prénom ou email du client (2 caractères minimum)' })
  @IsOptional() @IsString() @Length(2, 100) q?: string;
  @ApiPropertyOptional({ example: '2026-10-01' }) @IsOptional() @Matches(DATE, DATE_MSG) departure_from?: string;
  @ApiPropertyOptional({ example: '2026-10-31' }) @IsOptional() @Matches(DATE, DATE_MSG) departure_to?: string;
  @ApiPropertyOptional({ description: 'arrival_date | -arrival_date | created_at | -created_at' }) @IsOptional() @IsString() sort?: string;
}

export class AvailabilityQuery {
  @ApiProperty({ example: '2026-10-12' }) @Matches(DATE, DATE_MSG) from: string;
  @ApiProperty({ example: '2026-10-14', description: 'Exclu' }) @Matches(DATE, DATE_MSG) to: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() room_type_id?: string;
}

export class QuoteQuery {
  @ApiProperty() @IsUUID() room_type_id: string;
  @ApiProperty({ example: '2026-10-12' }) @Matches(DATE, DATE_MSG) arrival_date: string;
  @ApiProperty({ example: '2026-10-14' }) @Matches(DATE, DATE_MSG) departure_date: string;
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsInt() @Min(1) adults: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) children?: number;
  @ApiProperty({ enum: BOARDS }) @IsIn(BOARDS) board: Board;
  @ApiPropertyOptional({ description: 'Réservation modifiée, exclue du calcul de disponibilité' })
  @IsOptional() @IsUUID() exclude_reservation_id?: string;
}
