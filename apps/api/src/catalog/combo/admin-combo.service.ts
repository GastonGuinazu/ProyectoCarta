import { Injectable } from '@nestjs/common';
import { AvailabilityStatus } from '@prisma/client';
import { MediaService } from '../../media/media.service';
import { TenantContextService, type LocalizedText } from '../../core';
import { TenantService } from '../../tenant/tenant.service';
import { ProductRepository } from '../product/product.repository';
import {
  ComboNotFoundException,
  ComboProductNotFoundException,
  ComboValidationException,
} from './admin-combo.exceptions';
import type {
  AdminComboPatchInput,
  AdminComboRecord,
  AdminComboWriteInput,
} from './combo.repository';
import { ComboRepository } from './combo.repository';
import type { ComboItemDto, CreateComboDto } from './dto/create-combo.dto';
import type { UpdateComboDto } from './dto/update-combo.dto';

export interface AdminComboListItem {
  readonly id: string;
  readonly name: LocalizedText;
  readonly price: number;
  readonly currency: string;
  readonly availability: string;
  readonly items: readonly AdminComboItemResponse[];
}

export interface AdminComboItemResponse {
  readonly productId: string;
  readonly quantity: number;
  readonly productName: LocalizedText;
}

export interface AdminComboResponse {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText | null;
  readonly price: number;
  readonly currency: string;
  readonly availability: string;
  readonly imageUrl: string | null;
  readonly items: readonly AdminComboItemResponse[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class AdminComboService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly comboRepository: ComboRepository,
    private readonly productRepository: ProductRepository,
    private readonly mediaService: MediaService,
  ) {}

  async list(): Promise<{ readonly items: readonly AdminComboListItem[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const rows = await this.comboRepository.findAdminList(tenantId);
    return { items: rows.map(toListItem) };
  }

  async getById(comboId: string): Promise<AdminComboResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.comboRepository.findAdminById(tenantId, comboId);
    if (!existing) {
      throw new ComboNotFoundException();
    }
    return this.toResponse(existing);
  }

  async create(dto: CreateComboDto): Promise<AdminComboResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const defaultLanguage = await this.requireDefaultLanguage(tenantId);
    this.assertDefaultLanguage(dto.name, defaultLanguage, 'name');
    if (dto.description) {
      this.assertDefaultLanguage(dto.description, defaultLanguage, 'description');
    }
    const items = await this.assertItems(tenantId, dto.items);

    const slug = await this.allocateSlug(
      tenantId,
      dto.name[defaultLanguage] ?? Object.values(dto.name)[0],
    );

    const created = await this.comboRepository.createAdmin(tenantId, {
      slug,
      name: dto.name,
      description: dto.description ?? null,
      priceCents: dto.price,
      currency: dto.currency,
      availability: dto.availability ?? AvailabilityStatus.AVAILABLE,
      items,
    } satisfies AdminComboWriteInput);
    return this.toResponse(created);
  }

  async update(
    comboId: string,
    dto: UpdateComboDto,
  ): Promise<AdminComboResponse> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.comboRepository.findAdminById(tenantId, comboId);
    if (!existing) {
      throw new ComboNotFoundException();
    }

    const defaultLanguage = await this.requireDefaultLanguage(tenantId);
    if (dto.name) {
      this.assertDefaultLanguage(dto.name, defaultLanguage, 'name');
    }
    if (dto.description) {
      this.assertDefaultLanguage(dto.description, defaultLanguage, 'description');
    }

    const items = dto.items
      ? await this.assertItems(tenantId, dto.items)
      : undefined;

    const updated = await this.comboRepository.updateAdmin(tenantId, comboId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.price !== undefined ? { priceCents: dto.price } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.availability !== undefined
        ? { availability: dto.availability }
        : {}),
      ...(items !== undefined ? { items } : {}),
    } satisfies AdminComboPatchInput);
    return this.toResponse(updated);
  }

  async remove(comboId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.comboRepository.findAdminById(tenantId, comboId);
    if (!existing) {
      throw new ComboNotFoundException();
    }
    await this.comboRepository.deleteAdmin(tenantId, comboId);
  }

  private async requireDefaultLanguage(tenantId: string): Promise<string> {
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    if (!limits) {
      throw new ComboValidationException(
        'tenantId',
        'No se encontró el restaurante de la sesión.',
      );
    }
    return limits.defaultLanguage;
  }

  private assertDefaultLanguage(
    text: LocalizedText,
    defaultLanguage: string,
    field: string,
  ): void {
    const value = text[defaultLanguage];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ComboValidationException(
        `${field}.${defaultLanguage}`,
        'El nombre en el idioma por defecto del tenant es obligatorio.',
      );
    }
  }

  private async assertItems(
    tenantId: string,
    items: readonly ComboItemDto[],
  ): Promise<readonly { readonly productId: string; readonly quantity: number }[]> {
    const uniqueIds = [...new Set(items.map((item) => item.productId))];
    if (uniqueIds.length !== items.length) {
      throw new ComboValidationException(
        'items',
        'Cada producto puede aparecer una sola vez. Usá la cantidad para repetirlo.',
      );
    }
    if (uniqueIds.length < 2) {
      throw new ComboValidationException(
        'items',
        'Un combo debe incluir al menos dos productos distintos.',
      );
    }
    const existing = await this.productRepository.findExistingIds(
      tenantId,
      uniqueIds,
    );
    if (existing.length !== uniqueIds.length) {
      throw new ComboProductNotFoundException();
    }
    return items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
  }

  private async allocateSlug(tenantId: string, source: string): Promise<string> {
    const base = slugify(source);
    let candidate = base;
    let suffix = 2;
    while (await this.comboRepository.findIdBySlug(tenantId, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private async toResponse(record: AdminComboRecord): Promise<AdminComboResponse> {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      price: record.priceCents,
      currency: record.currency,
      availability: record.availability,
      imageUrl: await this.resolveImageUrl(record.imageMediaAssetId),
      items: record.items.map(toItemResponse),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private async resolveImageUrl(assetId: string | null): Promise<string | null> {
    if (!assetId) {
      return null;
    }
    const resolved = await this.mediaService.resolveMediaAssets([assetId]);
    return resolved.get(assetId)?.detailUrl ?? null;
  }
}

function toListItem(record: AdminComboRecord): AdminComboListItem {
  return {
    id: record.id,
    name: record.name,
    price: record.priceCents,
    currency: record.currency,
    availability: record.availability,
    items: record.items.map(toItemResponse),
  };
}

function toItemResponse(
  item: AdminComboRecord['items'][number],
): AdminComboItemResponse {
  return {
    productId: item.productId,
    quantity: item.quantity,
    productName: item.productName,
  };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug.length > 0 ? slug : 'combo';
}
