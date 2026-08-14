import { Injectable } from '@nestjs/common';
import { TenantContextService, type LocalizedText } from '../../core';
import { TenantService } from '../../tenant/tenant.service';
import {
  AdminCategoryNotFoundException,
  CategoryInUseException,
  CategoryReorderMismatchException,
  CategoryValidationException,
} from './admin-category.exceptions';
import type { AdminCategoryRecord } from './category.repository';
import { CategoryRepository } from './category.repository';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export interface AdminCategorySummary {
  readonly id: string;
  readonly name: LocalizedText;
  readonly order: number;
  readonly productCount: number;
  readonly childCount: number;
}

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantService: TenantService,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async list(): Promise<{ readonly items: readonly AdminCategorySummary[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const rows = await this.categoryRepository.findAdminSummaries(tenantId);
    return { items: rows.map(toSummary) };
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategorySummary> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const defaultLanguage = await this.requireDefaultLanguage(tenantId);
    this.assertDefaultLanguage(dto.name, defaultLanguage);

    const slug = await this.allocateSlug(
      tenantId,
      dto.name[defaultLanguage] ?? Object.values(dto.name)[0],
    );
    const maxOrder = await this.categoryRepository.findMaxOrder(tenantId);
    const created = await this.categoryRepository.createAdmin(tenantId, {
      slug,
      name: dto.name,
      order: maxOrder + 1,
    });
    return toSummary(created);
  }

  async update(
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<AdminCategorySummary> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.categoryRepository.findAdminById(
      tenantId,
      categoryId,
    );
    if (!existing) {
      throw new AdminCategoryNotFoundException();
    }

    const defaultLanguage = await this.requireDefaultLanguage(tenantId);
    this.assertDefaultLanguage(dto.name, defaultLanguage);

    const updated = await this.categoryRepository.updateAdmin(
      tenantId,
      categoryId,
      dto.name,
    );
    return toSummary(updated);
  }

  async remove(categoryId: string): Promise<void> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existing = await this.categoryRepository.findAdminById(
      tenantId,
      categoryId,
    );
    if (!existing) {
      throw new AdminCategoryNotFoundException();
    }
    if (existing.productCount > 0 || existing.childCount > 0) {
      throw new CategoryInUseException();
    }
    await this.categoryRepository.deleteAdmin(tenantId, categoryId);
  }

  async reorder(
    dto: ReorderCategoriesDto,
  ): Promise<{ readonly items: readonly AdminCategorySummary[] }> {
    const tenantId = this.tenantContextService.getTenantIdOrThrow();
    const existingIds = await this.categoryRepository.findIdsByTenant(tenantId);
    this.assertReorderSet(existingIds, dto.categoryIds);
    await this.categoryRepository.reorderAdmin(tenantId, dto.categoryIds);
    return this.list();
  }

  private async requireDefaultLanguage(tenantId: string): Promise<string> {
    const limits = await this.tenantService.findCatalogLimits(tenantId);
    if (!limits) {
      throw new CategoryValidationException(
        'tenantId',
        'No se encontró el restaurante de la sesión.',
      );
    }
    return limits.defaultLanguage;
  }

  private assertDefaultLanguage(
    text: LocalizedText,
    defaultLanguage: string,
  ): void {
    const value = text[defaultLanguage];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new CategoryValidationException(
        `name.${defaultLanguage}`,
        'El nombre en el idioma por defecto del tenant es obligatorio.',
      );
    }
  }

  private assertReorderSet(
    existingIds: readonly string[],
    incomingIds: readonly string[],
  ): void {
    if (existingIds.length !== incomingIds.length) {
      throw new CategoryReorderMismatchException();
    }
    const existing = new Set(existingIds);
    for (const id of incomingIds) {
      if (!existing.has(id)) {
        throw new CategoryReorderMismatchException();
      }
    }
  }

  private async allocateSlug(tenantId: string, source: string): Promise<string> {
    const base = slugify(source);
    let candidate = base;
    let suffix = 2;
    while (await this.categoryRepository.findIdBySlug(tenantId, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

function toSummary(row: AdminCategoryRecord): AdminCategorySummary {
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    productCount: row.productCount,
    childCount: row.childCount,
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
  return slug.length > 0 ? slug : 'categoria';
}
