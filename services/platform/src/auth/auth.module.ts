import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { StudioActivityModule } from '../studio-activity/studio-activity.module';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieOriginGuard } from './cookie-origin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { resolveJwtSecret } from './jwt-secret';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { StudioPermissionGuard } from './studio-permission.guard';
import { TenantContextInterceptor } from '../tenant/tenant.interceptor';
import { TenantGuard } from '../tenant/tenant.guard';

@Module({
  imports: [
    MailModule,
    StudioActivityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AuthRateLimitService,
    JwtAuthGuard,
    RolesGuard,
    StudioPermissionGuard,
    CookieOriginGuard,
    TenantGuard,
    TenantContextInterceptor,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: StudioPermissionGuard },
    { provide: APP_GUARD, useClass: CookieOriginGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtStrategy,
    PassportModule,
    JwtAuthGuard,
    RolesGuard,
    StudioPermissionGuard,
    CookieOriginGuard,
  ],
})
export class AuthModule {}
