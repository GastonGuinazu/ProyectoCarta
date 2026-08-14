import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  AdminCategoryListResponse,
  AdminCategoryReorderPayload,
  AdminCategorySummary,
  AdminCategoryWritePayload,
  AdminComboDetail,
  AdminComboListResponse,
  AdminComboMediaUploadResponse,
  AdminComboWritePayload,
  AdminProductDetail,
  AdminProductListResponse,
  AdminProductMediaUploadResponse,
  AdminProductMediaSlot,
  AdminProductWritePayload,
  AdminCatalogTagsResponse,
} from './admin-catalog.models';

@Injectable({ providedIn: 'root' })
export class AdminCatalogApiService {
  private readonly http = inject(HttpClient);

  listProducts(): Observable<AdminProductListResponse> {
    return this.http.get<AdminProductListResponse>(
      `${environment.apiBaseUrl}/admin/catalog/products`,
    );
  }

  getProduct(id: string): Observable<AdminProductDetail> {
    return this.http.get<AdminProductDetail>(
      `${environment.apiBaseUrl}/admin/catalog/products/${id}`,
    );
  }

  createProduct(body: AdminProductWritePayload): Observable<AdminProductDetail> {
    return this.http.post<AdminProductDetail>(
      `${environment.apiBaseUrl}/admin/catalog/products`,
      body,
    );
  }

  updateProduct(
    id: string,
    body: AdminProductWritePayload,
  ): Observable<AdminProductDetail> {
    return this.http.put<AdminProductDetail>(
      `${environment.apiBaseUrl}/admin/catalog/products/${id}`,
      body,
    );
  }

  listCategories(): Observable<AdminCategoryListResponse> {
    return this.http.get<AdminCategoryListResponse>(
      `${environment.apiBaseUrl}/admin/catalog/categories`,
    );
  }

  listTags(): Observable<AdminCatalogTagsResponse> {
    return this.http.get<AdminCatalogTagsResponse>(
      `${environment.apiBaseUrl}/admin/catalog/tags`,
    );
  }

  createCategory(
    body: AdminCategoryWritePayload,
  ): Observable<AdminCategorySummary> {
    return this.http.post<AdminCategorySummary>(
      `${environment.apiBaseUrl}/admin/catalog/categories`,
      body,
    );
  }

  updateCategory(
    id: string,
    body: AdminCategoryWritePayload,
  ): Observable<AdminCategorySummary> {
    return this.http.put<AdminCategorySummary>(
      `${environment.apiBaseUrl}/admin/catalog/categories/${id}`,
      body,
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/catalog/categories/${id}`,
    );
  }

  reorderCategories(
    body: AdminCategoryReorderPayload,
  ): Observable<AdminCategoryListResponse> {
    return this.http.patch<AdminCategoryListResponse>(
      `${environment.apiBaseUrl}/admin/catalog/categories/reorder`,
      body,
    );
  }

  listCombos(): Observable<AdminComboListResponse> {
    return this.http.get<AdminComboListResponse>(
      `${environment.apiBaseUrl}/admin/catalog/combos`,
    );
  }

  getCombo(id: string): Observable<AdminComboDetail> {
    return this.http.get<AdminComboDetail>(
      `${environment.apiBaseUrl}/admin/catalog/combos/${id}`,
    );
  }

  createCombo(body: AdminComboWritePayload): Observable<AdminComboDetail> {
    return this.http.post<AdminComboDetail>(
      `${environment.apiBaseUrl}/admin/catalog/combos`,
      body,
    );
  }

  updateCombo(
    id: string,
    body: AdminComboWritePayload,
  ): Observable<AdminComboDetail> {
    return this.http.put<AdminComboDetail>(
      `${environment.apiBaseUrl}/admin/catalog/combos/${id}`,
      body,
    );
  }

  deleteCombo(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/catalog/combos/${id}`,
    );
  }

  uploadComboMedia(
    comboId: string,
    file: File,
  ): Observable<AdminComboMediaUploadResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<AdminComboMediaUploadResponse>(
      `${environment.apiBaseUrl}/admin/catalog/combos/${comboId}/media`,
      body,
    );
  }

  deleteComboMedia(comboId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/catalog/combos/${comboId}/media`,
    );
  }

  uploadProductMedia(
    productId: string,
    file: File,
    slot: AdminProductMediaSlot,
  ): Observable<HttpEvent<AdminProductMediaUploadResponse>> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<AdminProductMediaUploadResponse>(
      `${environment.apiBaseUrl}/admin/catalog/products/${productId}/media`,
      body,
      {
        reportProgress: true,
        observe: 'events',
        params: { slot },
      },
    );
  }

  deleteProductMedia(
    productId: string,
    slot: AdminProductMediaSlot,
  ): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/catalog/products/${productId}/media`,
      { params: { slot } },
    );
  }
}
