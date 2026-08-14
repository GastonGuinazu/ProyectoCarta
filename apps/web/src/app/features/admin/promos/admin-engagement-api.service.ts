import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  AdminHappyHour,
  AdminHappyHourWritePayload,
  AdminProductOffer,
  AdminPromo,
  AdminPromoWritePayload,
} from './admin-engagement.models';

@Injectable({ providedIn: 'root' })
export class AdminEngagementApiService {
  private readonly http = inject(HttpClient);

  listPromos(): Observable<{ readonly items: readonly AdminPromo[] }> {
    return this.http.get<{ readonly items: readonly AdminPromo[] }>(
      `${environment.apiBaseUrl}/admin/engagement/promos`,
    );
  }

  getPromo(id: string): Observable<AdminPromo> {
    return this.http.get<AdminPromo>(
      `${environment.apiBaseUrl}/admin/engagement/promos/${id}`,
    );
  }

  createPromo(body: AdminPromoWritePayload): Observable<AdminPromo> {
    return this.http.post<AdminPromo>(
      `${environment.apiBaseUrl}/admin/engagement/promos`,
      body,
    );
  }

  updatePromo(id: string, body: AdminPromoWritePayload): Observable<AdminPromo> {
    return this.http.put<AdminPromo>(
      `${environment.apiBaseUrl}/admin/engagement/promos/${id}`,
      body,
    );
  }

  deletePromo(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/engagement/promos/${id}`,
    );
  }

  listHappyHours(): Observable<{ readonly items: readonly AdminHappyHour[] }> {
    return this.http.get<{ readonly items: readonly AdminHappyHour[] }>(
      `${environment.apiBaseUrl}/admin/engagement/happy-hours`,
    );
  }

  getHappyHour(id: string): Observable<AdminHappyHour> {
    return this.http.get<AdminHappyHour>(
      `${environment.apiBaseUrl}/admin/engagement/happy-hours/${id}`,
    );
  }

  createHappyHour(body: AdminHappyHourWritePayload): Observable<AdminHappyHour> {
    return this.http.post<AdminHappyHour>(
      `${environment.apiBaseUrl}/admin/engagement/happy-hours`,
      body,
    );
  }

  updateHappyHour(
    id: string,
    body: AdminHappyHourWritePayload,
  ): Observable<AdminHappyHour> {
    return this.http.put<AdminHappyHour>(
      `${environment.apiBaseUrl}/admin/engagement/happy-hours/${id}`,
      body,
    );
  }

  deleteHappyHour(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/admin/engagement/happy-hours/${id}`,
    );
  }

  listProductOffers(
    productId: string,
  ): Observable<{ readonly items: readonly AdminProductOffer[] }> {
    return this.http.get<{ readonly items: readonly AdminProductOffer[] }>(
      `${environment.apiBaseUrl}/admin/engagement/product-offers`,
      { params: { productId } },
    );
  }
}
