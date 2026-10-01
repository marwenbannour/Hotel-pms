import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AllowMfaPending, AuthUser, CurrentUser } from '../../common/auth.decorators';
import { hotelToday } from '../../common/dates';
import { appConfig } from '../../config';
import { pickLang } from '../../common/i18n';
import { MFA_REQUIRED_ROLES } from '../../common/permissions';
import { User } from '../../database/entities';
import { MfaCodeDto } from '../auth/auth.dto';
import { AuthService } from '../auth/auth.service';
import { NavigationService } from '../navigation/navigation.service';

@ApiTags('Session')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly nav: NavigationService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @AllowMfaPending()
  @ApiOperation({ summary: 'Profil et droits de l’utilisateur connecté' })
  async me(@CurrentUser() cu: AuthUser) {
    const u = await this.ds.getRepository(User).findOneByOrFail({ id: cu.id });
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      locale: u.locale,
      permissions: cu.permissions,
      mfaEnabled: u.mfaEnabled,
      mfaRequired: MFA_REQUIRED_ROLES.includes(u.role),
      // Référence de date pour les interfaces : le jour de l'établissement, pas celui du poste.
      hotel: {
        name: appConfig.hotel.name,
        timezone: appConfig.hotel.timezone,
        currency: appConfig.hotel.currency,
        today: hotelToday(),
      },
    };
  }

  @Get('navigation')
  @ApiOperation({ summary: 'Menu dynamique : entrées autorisées, dans la langue demandée' })
  async navigation(@CurrentUser() cu: AuthUser, @Headers('accept-language') acceptLanguage?: string) {
    const lang = acceptLanguage
      ? pickLang(acceptLanguage)
      : (await this.ds.getRepository(User).findOneByOrFail({ id: cu.id })).locale;
    return this.nav.menuFor(cu, lang);
  }

  @Post('mfa/setup')
  @AllowMfaPending()
  @HttpCode(200)
  @ApiOperation({ summary: 'Génère le secret TOTP à scanner dans l’application d’authentification' })
  setupMfa(@CurrentUser() cu: AuthUser) {
    return this.auth.setupMfa(cu.id);
  }

  @Post('mfa/enable')
  @AllowMfaPending()
  @HttpCode(200)
  @ApiOperation({ summary: 'Active la MFA après vérification d’un premier code' })
  enableMfa(@CurrentUser() cu: AuthUser, @Body() dto: MfaCodeDto) {
    return this.auth.enableMfa(cu.id, dto.code);
  }
}
