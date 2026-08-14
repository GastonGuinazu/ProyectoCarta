import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TenantModule } from '../tenant/tenant.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    TenantModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresRaw = config.get<string>('JWT_ACCESS_EXPIRES_SECONDS');
        const expiresIn = expiresRaw ? Number.parseInt(expiresRaw, 10) : 900;
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 900,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    JwtAuthGuard,
    TenantContextGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtAuthGuard, TenantContextGuard, RolesGuard],
})
export class AuthModule {}
