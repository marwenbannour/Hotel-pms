import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { pickLang } from '../../common/i18n';
import { User } from '../../database/entities';
import { DashboardService } from './dashboard.service';
import { DashboardQuery, KpiQuery } from './dashboard.dto';
import { KpiService } from './kpi.service';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly dashboard: DashboardService,
    private readonly kpis: KpiService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord du jour, adapté aux droits du profil' })
  async get(@CurrentUser() user: AuthUser, @Query() q: DashboardQuery, @Headers('accept-language') acceptLanguage?: string) {
    const lang = acceptLanguage
      ? pickLang(acceptLanguage)
      : (await this.ds.getRepository(User).findOneByOrFail({ id: user.id })).locale;
    return this.dashboard.forUser(user, lang, q.date);
  }

  @Get('reports/kpis')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Occupation, ADR, RevPAR et durée moyenne de séjour sur une période' })
  kpi(@Query() q: KpiQuery) {
    return this.kpis.summary(q.from, q.to);
  }
}
