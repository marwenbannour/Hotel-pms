import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController, PlanningController, ReservationsController } from './reservations.controller';
import { PlanningService } from './planning.service';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [BillingModule],
  controllers: [AvailabilityController, ReservationsController, PlanningController],
  providers: [AvailabilityService, ReservationsService, PlanningService],
})
export class ReservationsModule {}
