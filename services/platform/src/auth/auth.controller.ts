import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { authCookieOptions } from './jwt-cookie';
import type { JwtUser } from './jwt.strategy';
import { Public } from './public.decorator';
import { CLIENT_TOKEN_COOKIE, STUDIO_TOKEN_COOKIE } from './roles';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Public()
  @Post('register')
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    await this.assertAuthRateLimit(req);
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    await this.assertAuthRateLimit(req);
    const { accessToken, user } = await this.authService.login(dto);
    res.cookie(CLIENT_TOKEN_COOKIE, accessToken, authCookieOptions(req));
    return { user };
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(CLIENT_TOKEN_COOKIE, authCookieOptions(req));
    return { ok: true as const };
  }

  @Public()
  @Post('studio/login')
  async studioLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    await this.assertAuthRateLimit(req);
    const { accessToken, user } = await this.authService.studioLogin(dto);
    res.cookie(STUDIO_TOKEN_COOKIE, accessToken, authCookieOptions(req));
    return { user };
  }

  @Public()
  @Post('studio/logout')
  async studioLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.recordStudioLogout(req);
    res.clearCookie(STUDIO_TOKEN_COOKIE, authCookieOptions(req));
    return { ok: true as const };
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user);
  }

  private async assertAuthRateLimit(req: Request) {
    if (await this.rateLimit.tooMany(this.clientIp(req))) {
      throw new HttpException(
        'Muitas tentativas. Tente de novo em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '0.0.0.0';
  }
}
