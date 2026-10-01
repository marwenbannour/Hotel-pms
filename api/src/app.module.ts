import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, PermissionsGuard, RateLimitGuard } from './common/guards';
import { IdempotencyInterceptor } from './common/idempotency';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { ResponseShapingInterceptor } from './common/response.interceptor';
import { appConfig } from './config';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GuestsModule } from './modules/guests/guests.module';
import { HealthController } from './modules/health/health.controller';
import { MeModule } from './modules/me/me.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { RoomsModule } from './modules/rooms/rooms.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...dataSourceOptions(), migrationsRun: process.env.MIGRATIONS_RUN !== 'false' }),
    JwtModule.register({ global: true, secret: appConfig.jwt.secret }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: appConfig.rateLimit.defaultPerMinute }]),
    CommonModule,
    AuthModule,
    MeModule,
    NavigationModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    DashboardModule,
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordre des gardes : limitation de débit, authentification, puis droits.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Ordre des intercepteurs : mise en forme (externe) puis idempotence (interne).
    { provide: APP_INTERCEPTOR, useClass: ResponseShapingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
