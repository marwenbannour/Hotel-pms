import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth.decorators';
import { appConfig } from '../../config';
import { LoginDto, MfaVerifyDto, RefreshDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Session')
@Public()
@Throttle({ default: { limit: appConfig.rateLimit.authPerMinute, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion ; renvoie les jetons ou un mfaToken si la MFA est active' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Second facteur (code TOTP)' })
  verify(@Body() dto: MfaVerifyDto) {
    return this.auth.verifyMfa(dto.mfaToken, dto.code);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotation du jeton de rafraîchissement' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Révoque la session (toute la famille de jetons)' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
