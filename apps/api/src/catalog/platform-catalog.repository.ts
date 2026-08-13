import { Injectable } from '@nestjs/common';
import { PrismaService, type LocalizedText } from '../core';
import type { AllergenRow, DietaryTagRow } from './platform-catalog.types';

/**
 * `Allergen` y `DietaryTag` son catálogos GLOBALES de la plataforma, sin
 * `tenantId` (prisma/schema.prisma, comentario junto a ambos modelos;
 * `tenant-scoped-models.ts` los excluye explícitamente de
 * `TENANT_SCOPED_MODELS`). Por eso este Repository inyecta `PrismaService`
 * (el cliente "crudo"), en vez de `TENANT_PRISMA_CLIENT`: no hay ningún
 * `tenantId` que filtrar, y usar el cliente extendido acá sugeriría
 * falsamente que estos datos son tenant-scoped (aunque en la práctica la
 * extensión sea un no-op para modelos fuera de esa lista).
 *
 * No requiere un provider nuevo ni un import adicional en `CatalogModule`:
 * `PrismaService` ya está registrado como singleton global en `CoreModule`
 * (`@Global()`), así que alcanza con inyectarlo por constructor.
 */
@Injectable()
export class PlatformCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAllergens(): Promise<readonly AllergenRow[]> {
    const allergens = await this.prisma.allergen.findMany({
      orderBy: { code: 'asc' },
    });

    return allergens.map((allergen) => ({
      id: allergen.id,
      code: allergen.code,
      name: allergen.name as LocalizedText,
      iconUrl: allergen.iconUrl,
    }));
  }

  async findAllDietaryTags(): Promise<readonly DietaryTagRow[]> {
    const dietaryTags = await this.prisma.dietaryTag.findMany({
      orderBy: { code: 'asc' },
    });

    return dietaryTags.map((dietaryTag) => ({
      id: dietaryTag.id,
      code: dietaryTag.code,
      name: dietaryTag.name as LocalizedText,
      iconUrl: dietaryTag.iconUrl,
    }));
  }
}
