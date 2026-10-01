import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { Idempotent } from '../../common/idempotency';
import { UuidParam } from '../../common/uuid.pipe';
import { AvailabilityService } from './availability.service';
import {
  AssignRoomDto, AvailabilityQuery, CancelReservationDto, CheckInDto, CreateReservationDto, ListReservationsQuery, PlanningQuery, QuoteQuery, UpdateReservationDto,
} from './reservations.dto';
import { CheckOutDto } from '../billing/billing.dto';
import { PlanningService } from './planning.service';
import { ReservationsService } from './reservations.service';

const IdemKey = () => ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clé unique par opération, conservée 24 h' });

@ApiTags('Disponibilités')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get() @RequirePermissions('availability:read')
  @ApiOperation({ summary: 'Disponibilités et tarifs par type de chambre, nuit par nuit' })
  async get(@Query() q: AvailabilityQuery) {
    return { from: q.from, to: q.to, roomTypes: await this.availability.compute(q.from, q.to, { roomTypeId: q.room_type_id }) };
  }
}

@ApiTags('Réservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get() @RequirePermissions('reservations:read')
  list(@Query() q: ListReservationsQuery) {
    return this.reservations.list(q);
  }

  // Déclarée avant :id pour ne pas être interprétée comme un identifiant.
  @Get('quote') @RequirePermissions('availability:read')
  @ApiOperation({ summary: 'Prix et disponibilité d’un séjour envisagé' })
  quote(@Query() q: QuoteQuery) {
    return this.reservations.quote(q);
  }

  @Get(':id') @RequirePermissions('reservations:read')
  get(@Param('id', UuidParam) id: string) {
    return this.reservations.get(id);
  }

  @Get(':id/history') @RequirePermissions('reservations:read')
  @ApiOperation({ summary: 'Historique des opérations sur la réservation' })
  history(@Param('id', UuidParam) id: string) {
    return this.reservations.history(id);
  }

  @Post() @RequirePermissions('reservations:write') @Idempotent() @IdemKey()
  @ApiOperation({ summary: 'Créer une réservation (contrôle de disponibilité atomique)' })
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthUser) {
    return this.reservations.create(dto, user);
  }

  @Patch(':id') @RequirePermissions('reservations:write')
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateReservationDto,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservations.update(id, dto, ifMatch, user);
  }

  @Put(':id/room') @RequirePermissions('reservations:write')
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiOperation({ summary: 'Pré-attribuer une chambre (ou retirer l’attribution avec roomId: null)' })
  assignRoom(
    @Param('id', UuidParam) id: string,
    @Body() dto: AssignRoomDto,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservations.assignRoom(id, dto.roomId ?? null, ifMatch, user);
  }

  @Post(':id/cancel') @RequirePermissions('reservations:write') @HttpCode(200)
  cancel(@Param('id', UuidParam) id: string, @Body() dto: CancelReservationDto, @CurrentUser() user: AuthUser) {
    return this.reservations.cancel(id, dto, user);
  }

  @Post(':id/check-in') @RequirePermissions('frontdesk:operate') @HttpCode(200)
  @ApiOperation({ summary: 'Arrivée : attribue une chambre propre (automatique ou choisie)' })
  checkIn(@Param('id', UuidParam) id: string, @Body() dto: CheckInDto, @CurrentUser() user: AuthUser) {
    return this.reservations.checkIn(id, dto, user);
  }

  @Post(':id/check-out') @RequirePermissions('frontdesk:operate') @HttpCode(200)
  @ApiOperation({ summary: 'Départ : la chambre passe en nettoyage' })
  checkOut(@Param('id', UuidParam) id: string, @Body() dto: CheckOutDto, @CurrentUser() user: AuthUser) {
    return this.reservations.checkOut(id, user, dto.overrideBalanceReason);
  }
}

@ApiTags('Planning')
@ApiBearerAuth()
@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get() @RequirePermissions('reservations:read', 'rooms:read')
  @ApiOperation({ summary: 'Planning des chambres : chambres et séjours sur la période (31 jours max.)' })
  get(@Query() q: PlanningQuery) {
    return this.planning.get(q.from, q.to);
  }
}
