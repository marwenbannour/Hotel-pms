import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { UuidParam } from '../../common/uuid.pipe';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Administration')
@ApiBearerAuth()
@RequirePermissions('admin:users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Comptes utilisateurs' })
  list() {
    return this.users.list();
  }

  @Get(':id')
  get(@Param('id', UuidParam) id: string) {
    return this.users.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un compte avec un mot de passe initial' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Nom, rôle, langue, activation (ferme les sessions si le rôle change ou si le compte est désactivé)' })
  update(@Param('id', UuidParam) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor);
  }

  @Post(':id/password') @HttpCode(200)
  @ApiOperation({ summary: 'Définir un nouveau mot de passe (ferme les sessions)' })
  resetPassword(@Param('id', UuidParam) id: string, @Body() dto: ResetPasswordDto, @CurrentUser() actor: AuthUser) {
    return this.users.resetPassword(id, dto.password, actor);
  }

  @Post(':id/mfa/reset') @HttpCode(200)
  @ApiOperation({ summary: 'Réinitialiser la double authentification (réenrôlement à la prochaine connexion)' })
  resetMfa(@Param('id', UuidParam) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.resetMfa(id, actor);
  }
}
