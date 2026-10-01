import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { UuidParam } from '../../common/uuid.pipe';
import { CreateRoomDto, CreateRoomTypeDto, ListRoomsQuery, RoomStatusDto, UpdateRoomDto, UpdateRoomTypeDto } from './rooms.dto';
import { RoomsService } from './rooms.service';

const IfMatch = () => ApiHeader({ name: 'If-Match', required: true, description: 'ETag obtenu à la lecture' });

@ApiTags('Chambres')
@ApiBearerAuth()
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly rooms: RoomsService) {}

  @Get() @RequirePermissions('rooms:read')
  async list() {
    return { data: await this.rooms.listTypes(), nextCursor: null };
  }

  @Get(':id') @RequirePermissions('rooms:read')
  get(@Param('id', UuidParam) id: string) {
    return this.rooms.getType(id);
  }

  @Post() @RequirePermissions('rooms:write')
  create(@Body() dto: CreateRoomTypeDto) {
    return this.rooms.createType(dto);
  }

  @Patch(':id') @RequirePermissions('rooms:write') @IfMatch()
  update(@Param('id', UuidParam) id: string, @Body() dto: UpdateRoomTypeDto, @Headers('if-match') ifMatch?: string) {
    return this.rooms.updateType(id, dto, ifMatch);
  }
}

@ApiTags('Chambres')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get() @RequirePermissions('rooms:read')
  list(@Query() q: ListRoomsQuery) {
    return this.rooms.list(q);
  }

  @Get(':id') @RequirePermissions('rooms:read')
  get(@Param('id', UuidParam) id: string) {
    return this.rooms.get(id);
  }

  @Post() @RequirePermissions('rooms:write')
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  @Patch(':id') @RequirePermissions('rooms:write') @IfMatch()
  update(@Param('id', UuidParam) id: string, @Body() dto: UpdateRoomDto, @Headers('if-match') ifMatch?: string) {
    return this.rooms.update(id, dto, ifMatch);
  }

  @Patch(':id/status') @RequirePermissions('rooms:status') @IfMatch()
  @ApiOperation({ summary: 'Changer l’état d’une chambre (propre, nettoyage, maintenance)' })
  setStatus(
    @Param('id', UuidParam) id: string,
    @Body() dto: RoomStatusDto,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.setStatus(id, dto.status, ifMatch, user);
  }
}
