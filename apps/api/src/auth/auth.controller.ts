import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipTenantResolution, Public, SkipTenantContext } from '../core';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService, type LoginResult } from './auth.service';
import type { AuthenticatedUser } from './auth.types';

/**
 * `POST /api/v1/admin/auth/login` y `POST /api/v1/admin/auth/refresh`
 * (docs/api-contracts.md §4). El refresh opaco va en cookie HttpOnly.
 * `POST /api/v1/admin/auth/change-password` exige JWT (no `@Public()`).
 */
@SkipTenantResolution()
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    this.attachRefreshCookie(response, result);
    return result.body;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawCookie = this.readRefreshCookie(request);
    const result = await this.authService.refresh(rawCookie);
    this.attachRefreshCookie(response, result);
    return result.body;
  }

  @SkipTenantContext()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'La sesión expiró. Volvé a ingresar.',
      });
    }
    const result = await this.authService.changePassword(
      user.id,
      user.tenantId,
      dto.currentPassword,
      dto.newPassword,
    );
    this.attachRefreshCookie(response, result);
  }

  private readRefreshCookie(request: Request): string | undefined {
    const value = request.cookies?.[this.authService.cookieName()];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private attachRefreshCookie(
    response: Response,
    result: Pick<LoginResult, 'refreshToken' | 'refreshExpiresAt'>,
  ): void {
    response.cookie(this.authService.cookieName(), result.refreshToken, {
      httpOnly: true,
      secure: this.authService.cookieSecure(),
      sameSite: this.authService.cookieSameSite(),
      path: '/api/v1/admin/auth',
      expires: result.refreshExpiresAt,
    });
  }
}
