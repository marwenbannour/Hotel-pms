import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import { UuidParam } from '../../common/uuid.pipe';
import { CreateNavigationItemDto, UpdateNavigationItemDto } from './navigation.dto';
import { NavigationService } from './navigation.service';

@ApiTags('Administration')
@ApiBearerAuth()
@RequirePermissions('admin:navigation')
@Controller('navigation-items')
export class NavigationController {
  constructor(private readonly nav: NavigationService) {}

  @Get()
  @ApiOperation({ summary: 'Toutes les entrées du menu (paramétrage)' })
  async list() {
    return { data: await this.nav.list(), nextCursor: null };
  }

  @Get(':id')
  get(@Param('id', UuidParam) id: string) {
    return this.nav.get(id);
  }

  @Post()
  create(@Body() dto: CreateNavigationItemDto, @CurrentUser() user: AuthUser) {
    return this.nav.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une entrée (If-Match obligatoire)' })
  update(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateNavigationItemDto,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.nav.update(id, dto, ifMatch, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', UuidParam) id: string, @Headers('if-match') ifMatch: string | undefined, @CurrentUser() user: AuthUser) {
    await this.nav.remove(id, ifMatch, user);
  }
}
