import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
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
import { ParseUuidLikePipe, RequireTenantContext } from '../core';
import { MediaService } from './media.service';
import { MulterExceptionFilter } from './multer-exception.filter';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Foto representativa del combo (domain-modules.md §3.2). Sin slot 3D.
 * Vive en MediaModule para no mezclar Multer con el CRUD JSON de Catalog.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@UseFilters(MulterExceptionFilter)
@Controller('admin/catalog/combos')
export class AdminComboMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_MAX_BYTES },
    }),
  )
  upload(
    @Param('id', ParseUuidLikePipe) comboId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tenés que iniciar sesión para subir archivos.',
      });
    }
    return this.mediaService.uploadComboImage(comboId, file, user.id);
  }

  @Delete(':id/media')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUuidLikePipe) comboId: string) {
    return this.mediaService.deleteComboImage(comboId);
  }
}
