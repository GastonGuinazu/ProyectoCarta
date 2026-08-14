import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  MediaStorageNotConfiguredException,
  MediaStorageUploadException,
} from './media.exceptions';

/**
 * Único punto de contacto con Supabase Storage (docs/architecture.md §2.3,
 * .cursor/rules/03-backend-nestjs.mdc). El resto de MediaModule no instancia
 * el SDK. Usa la service_role key: NestJS ya aisló el tenant; no se usa el
 * JWT de GoTrue.
 *
 * El cliente se crea en el primer upload, no en el constructor: el resto de
 * la API (auth, catálogo) debe poder arrancar aunque Storage todavía no esté
 * configurado en el .env.
 */
@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucket: string | null = null;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  async uploadTenantProductFile(input: {
    readonly tenantId: string;
    readonly productId: string;
    readonly originalName: string;
    readonly body: Buffer;
    readonly contentType: string;
  }): Promise<{ readonly path: string; readonly publicUrl: string }> {
    const { client, bucket } = await this.clientReady();
    const path = buildStoragePath(
      input.tenantId,
      input.productId,
      input.originalName,
    );
    const { error } = await client.storage.from(bucket).upload(path, input.body, {
      contentType: input.contentType,
      upsert: false,
    });

    if (error) {
      throw new MediaStorageUploadException();
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  async uploadTenantBrandingFile(input: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly originalName: string;
    readonly body: Buffer;
    readonly contentType: string;
  }): Promise<{ readonly path: string; readonly publicUrl: string }> {
    const { client, bucket } = await this.clientReady();
    const path = buildBrandingStoragePath(
      input.tenantId,
      input.branchId,
      input.originalName,
    );
    const { error } = await client.storage.from(bucket).upload(path, input.body, {
      contentType: input.contentType,
      upsert: false,
    });

    if (error) {
      throw new MediaStorageUploadException();
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  async remove(path: string): Promise<void> {
    const { client, bucket } = await this.clientReady();
    await client.storage.from(bucket).remove([path]);
  }

  pathFromPublicUrl(publicUrl: string): string | null {
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim();
    if (!bucket) {
      return null;
    }
    const marker = `/object/public/${bucket}/`;
    const index = publicUrl.indexOf(marker);
    if (index < 0) {
      return null;
    }
    return decodeURIComponent(publicUrl.slice(index + marker.length));
  }

  private async clientReady(): Promise<{
    client: SupabaseClient;
    bucket: string;
  }> {
    const ctx = this.requireClient();
    this.bucketReady ??= this.ensurePublicBucket(ctx.client, ctx.bucket);
    try {
      await this.bucketReady;
    } catch (error) {
      this.bucketReady = null;
      throw error;
    }
    return ctx;
  }

  private async ensurePublicBucket(
    client: SupabaseClient,
    bucket: string,
  ): Promise<void> {
    const fileSizeLimit = this.maxUploadBytes();
    const { data: existing } = await client.storage.getBucket(bucket);
    if (existing) {
      if (existing.public && fileSizeLimit === undefined) {
        return;
      }
      const { error } = await client.storage.updateBucket(bucket, {
        public: true,
        fileSizeLimit,
      });
      if (error) {
        throw new MediaStorageUploadException();
      }
      return;
    }

    const { error } = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit,
    });
    if (error) {
      throw new MediaStorageUploadException();
    }
  }

  private maxUploadBytes(): number | undefined {
    const image = parsePositiveInt(
      this.config.get<string>('MEDIA_IMAGE_MAX_BYTES'),
    );
    const model = parsePositiveInt(
      this.config.get<string>('MEDIA_MODEL_MAX_BYTES'),
    );
    const values = [image, model].filter(
      (value): value is number => value !== undefined,
    );
    return values.length > 0 ? Math.max(...values) : undefined;
  }

  private requireClient(): { client: SupabaseClient; bucket: string } {
    if (this.client && this.bucket) {
      return { client: this.client, bucket: this.bucket };
    }

    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey = this.config
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim();

    if (!url || !serviceRoleKey || !bucket) {
      throw new MediaStorageNotConfiguredException();
    }

    this.bucket = bucket;
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { client: this.client, bucket: this.bucket };
  }
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function buildStoragePath(
  tenantId: string,
  productId: string,
  originalName: string,
): string {
  const safeName = sanitizeFileName(originalName);
  return `${tenantId}/${productId}/${safeName}`;
}

function buildBrandingStoragePath(
  tenantId: string,
  branchId: string,
  originalName: string,
): string {
  const safeName = sanitizeFileName(originalName);
  return `${tenantId}/${branchId}/branding/${safeName}`;
}

function sanitizeFileName(originalName: string): string {
  const trimmed = originalName.replace(/\\/g, '/').split('/').pop() ?? 'archivo';
  const lastDot = trimmed.lastIndexOf('.');
  const ext = lastDot > 0 ? trimmed.slice(lastDot).toLowerCase() : '';
  const base = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${randomUUID()}-${base || 'archivo'}${ext}`;
}
