import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { authCookieOptions } from '../auth/jwt-cookie';
import type { JwtUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { STUDIO_TOKEN_COOKIE, USER_ROLE } from '../auth/roles';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantService } from './tenant.service';

@Controller('studio/tenants')
@Roles(USER_ROLE.ROOT)
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Post('stop-impersonation')
  stopImpersonation(
    @CurrentUser() actor: JwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const issued = this.tenants.stopImpersonation(actor);
    res.cookie(
      STUDIO_TOKEN_COOKIE,
      issued.accessToken,
      authCookieOptions(req, { rememberMe: true }),
    );
    return { user: issued.user };
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.tenants.activity(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tenants.get(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Post(':id/impersonate')
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() actor: JwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const issued = await this.tenants.impersonate(actor, id);
    res.cookie(
      STUDIO_TOKEN_COOKIE,
      issued.accessToken,
      authCookieOptions(req, { rememberMe: true }),
    );
    return { user: issued.user };
  }
}
