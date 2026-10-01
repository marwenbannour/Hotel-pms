import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { CursorQueryDto } from '../../common/pagination';
import { UuidParam } from '../../common/uuid.pipe';
import { CreateGuestDto, ListGuestsQuery, UpdateGuestDto } from './guests.dto';
import { GuestsService } from './guests.service';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get() @RequirePermissions('guests:read')
  list(@Query() q: ListGuestsQuery) {
    return this.guests.list(q);
  }

  @Get(':id') @RequirePermissions('guests:read')
  get(@Param('id', UuidParam) id: string) {
    return this.guests.get(id);
  }

  @Post() @RequirePermissions('guests:write')
  create(@Body() dto: CreateGuestDto) {
    return this.guests.create(dto);
  }

  @Patch(':id') @RequirePermissions('guests:write')
  @ApiHeader({ name: 'If-Match', required: true })
  update(@Param('id', UuidParam) id: string, @Body() dto: UpdateGuestDto, @Headers('if-match') ifMatch?: string) {
    return this.guests.update(id, dto, ifMatch);
  }

  @Get(':id/stays') @RequirePermissions('guests:read', 'reservations:read')
  @ApiOperation({ summary: 'Historique des séjours du client' })
  stays(@Param('id', UuidParam) id: string, @Query() q: CursorQueryDto) {
    return this.guests.stays(id, q);
  }

  @Post(':id/erase') @RequirePermissions('guests:erase') @HttpCode(200)
  @ApiOperation({ summary: 'Effacement RGPD (anonymisation irréversible)' })
  erase(@Param('id', UuidParam) id: string, @CurrentUser() user: AuthUser) {
    return this.guests.erase(id, user);
  }
}
