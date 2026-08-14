import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoleType } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiredRole } from '../auth/decorators/required-role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireTenantContext } from '../core';
import { MediaService } from './media.service';
import { MulterExceptionFilter } from './multer-exception.filter';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const brandingUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
});

/**
 * Logo (1:1) y portada (16:9) de la sucursal. Vive en MediaModule para no
 * mezclar Multer con el PATCH JSON de TenantModule.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@UseFilters(MulterExceptionFilter)
@Controller('admin/settings/branch')
export class AdminBranchBrandingController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('logo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(brandingUpload)
  uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.upload('logo', file, user);
  }

  @Post('banner')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(brandingUpload)
  uploadBanner(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.upload('banner', file, user);
  }

  @Delete('logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLogo() {
    return this.mediaService.deleteBranchBranding('logo');
  }

  @Delete('banner')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBanner() {
    return this.mediaService.deleteBranchBranding('banner');
  }

  private upload(
    slot: 'logo' | 'banner',
    file: Express.Multer.File | undefined,
    user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tenés que iniciar sesión para subir archivos.',
      });
    }
    return this.mediaService.uploadBranchBranding(slot, file, user.id);
  }
}
