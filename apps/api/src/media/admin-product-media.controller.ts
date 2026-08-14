import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { UploadProductMediaQueryDto } from './dto/upload-product-media-query.dto';
import { MediaService } from './media.service';
import { MulterExceptionFilter } from './multer-exception.filter';

const MODEL_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Media de un producto: `POST` sube a un slot y `DELETE` lo vacía
 * (`.../products/:id/media?slot=presentation|immersive`).
 * Vive en MediaModule (docs/backend-architecture.md §2.1) para no mezclar
 * Multer con el CRUD JSON de Catalog. El `tenantId` sale del TenantContext.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequiredRole(RoleType.ADMIN)
@RequireTenantContext()
@UseFilters(MulterExceptionFilter)
@Controller('admin/catalog/products')
export class AdminProductMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MODEL_MAX_BYTES },
    }),
  )
  upload(
    @Param('id', ParseUuidLikePipe) productId: string,
    @Query() query: UploadProductMediaQueryDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tenés que iniciar sesión para subir archivos.',
      });
    }
    return this.mediaService.uploadProductMedia(
      productId,
      file,
      user.id,
      query.slot,
    );
  }

  @Delete(':id/media')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUuidLikePipe) productId: string,
    @Query() query: UploadProductMediaQueryDto,
  ) {
    return this.mediaService.deleteProductMediaSlot(productId, query.slot);
  }
}
