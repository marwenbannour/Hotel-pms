import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination';
import { ROOM_STATUSES, RoomStatus } from '../../database/entities/room.entity';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'DBL' }) @Matches(/^[A-Z0-9_-]{1,20}$/) code: string;
  @ApiProperty({ example: 'Chambre double' }) @IsString() @Length(1, 120) name: string;
  @ApiProperty({ example: 2 }) @IsInt() @Min(1) @Max(20) capacity: number;
  @ApiProperty({ example: 9500, description: 'Tarif de base par nuit en unités mineures' }) @IsInt() @Min(0) basePrice: number;
  @ApiPropertyOptional({ example: 'EUR' }) @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
}
export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}

export class CreateRoomDto {
  @ApiProperty({ example: '204' }) @IsString() @Length(1, 20) number: string;
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @IsInt() floor?: number;
  @ApiProperty() @IsUUID() roomTypeId: string;
}
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class RoomStatusDto {
  @ApiProperty({ enum: ROOM_STATUSES }) @IsIn(ROOM_STATUSES) status: RoomStatus;
}

export class ListRoomsQuery extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ROOM_STATUSES }) @IsOptional() @IsIn(ROOM_STATUSES) status?: RoomStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() room_type_id?: string;
  @ApiPropertyOptional({ example: 'number', description: 'number | -number | floor | -floor' }) @IsOptional() @IsString() sort?: string;
}
