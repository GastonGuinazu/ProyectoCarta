import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { TenantStore } from '../stores/tenant.store';

type EventKind = 'scan' | 'search' | 'filter' | 'ar' | 'dwell';

interface EventBody {
  readonly kind: EventKind;
  readonly sessionId: string;
  readonly query?: string;
  readonly filterKind?: 'allergen' | 'dietary';
  readonly tagId?: string;
  readonly productId?: string;
  readonly durationMs?: number;
}

const SEARCH_DEBOUNCE_MS = 700;
const DWELL_HEARTBEAT_MS = 5_000;
const STAYED_THRESHOLD_MS = 30_000;

/**
 * Tracking anónimo de la carta. Un `sessionId` vive en memoria: F5 o
 * pestaña nueva = visita nueva. El dwell (tiempo visible) se manda con
 * POST normal: `keepalive` + JSON cross-origin no completa el preflight CORS
 * y dejaba “Se quedaron” siempre en cero.
 */
@Injectable({ providedIn: 'root' })
export class MenuAnalyticsService {
  private readonly tenantStore = inject(TenantStore);
  private readonly document = inject(DOCUMENT);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stayedTimer: ReturnType<typeof setTimeout> | null = null;
  private visibleStartedAt = 0;
  private hiddenAccumulatedMs = 0;
  private listenersBound = false;
  private sessionId: string | null = null;
  private tenantSlug: string | null = null;
  private branchSlug: string | null = null;
  private scanSent = false;
  private scanInFlight = false;
  private lastSentDwellMs = 0;

  startVisit(): void {
    const tenantSlug = this.tenantStore.tenant()?.slug ?? null;
    const branchSlug = this.tenantStore.branch()?.slug ?? null;
    if (!tenantSlug || !branchSlug) {
      return;
    }
    this.tenantSlug = tenantSlug;
    this.branchSlug = branchSlug;
    if (!this.sessionId) {
      this.sessionId = this.document.defaultView?.crypto.randomUUID() ?? null;
      this.hiddenAccumulatedMs = 0;
      this.visibleStartedAt = Date.now();
      this.lastSentDwellMs = 0;
    }
    if (!this.sessionId) {
      return;
    }
    this.bindDwellTracking();
    void this.sendScan();
  }

  recordSearch(query: string): void {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    if (this.searchTimer) {
      this.document.defaultView?.clearTimeout(this.searchTimer);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    this.searchTimer =
      this.document.defaultView?.setTimeout(() => {
        void this.send({ kind: 'search', sessionId, query: trimmed.slice(0, 80) }, false);
      }, SEARCH_DEBOUNCE_MS) ?? null;
  }

  recordFilter(filterKind: 'allergen' | 'dietary', tagId: string): void {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    void this.send({ kind: 'filter', sessionId, filterKind, tagId }, false);
  }

  recordArView(productId: string): void {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    void this.send({ kind: 'ar', sessionId, productId }, false);
  }

  private async sendScan(): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId || this.scanSent || this.scanInFlight) {
      return;
    }
    this.scanInFlight = true;
    const ok = await this.send({ kind: 'scan', sessionId }, false);
    this.scanInFlight = false;
    if (ok) {
      this.scanSent = true;
    }
  }

  private bindDwellTracking(): void {
    const view = this.document.defaultView;
    if (!view || this.listenersBound) {
      return;
    }
    this.listenersBound = true;
    if (this.visibleStartedAt === 0) {
      this.visibleStartedAt = Date.now();
    }

    const onHidden = (keepalive: boolean): void => {
      this.pauseVisibleClock();
      this.flushDwell(keepalive);
    };

    view.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'hidden') {
        onHidden(false);
      } else {
        this.resumeVisibleClock();
      }
    });
    view.addEventListener('pagehide', () => onHidden(true));
    this.heartbeatTimer = view.setInterval(() => this.flushDwell(false), DWELL_HEARTBEAT_MS);
    this.stayedTimer = view.setTimeout(() => this.flushDwell(false), STAYED_THRESHOLD_MS);
  }

  private currentDwellMs(): number {
    if (this.visibleStartedAt === 0) {
      return this.hiddenAccumulatedMs;
    }
    return this.hiddenAccumulatedMs + Math.max(0, Date.now() - this.visibleStartedAt);
  }

  private pauseVisibleClock(): void {
    if (this.visibleStartedAt === 0) {
      return;
    }
    this.hiddenAccumulatedMs += Math.max(0, Date.now() - this.visibleStartedAt);
    this.visibleStartedAt = 0;
  }

  private resumeVisibleClock(): void {
    if (this.document.visibilityState === 'hidden') {
      return;
    }
    if (this.visibleStartedAt === 0) {
      this.visibleStartedAt = Date.now();
    }
  }

  private flushDwell(keepalive: boolean): void {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    void this.sendScan();
    const durationMs = Math.round(this.currentDwellMs());
    if (durationMs < 1000 || durationMs <= this.lastSentDwellMs) {
      return;
    }
    void this.send({ kind: 'dwell', sessionId, durationMs }, keepalive).then((ok) => {
      if (ok) {
        this.lastSentDwellMs = durationMs;
      }
    });
  }

  private async send(body: EventBody, keepalive: boolean): Promise<boolean> {
    const tenantSlug = this.tenantSlug;
    const branchSlug = this.branchSlug;
    if (!tenantSlug || !branchSlug) {
      return false;
    }
    const url = `${environment.apiBaseUrl}/menu/public/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(branchSlug)}/events`;
    try {
      const response = await this.document.defaultView?.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
        mode: 'cors',
        credentials: 'omit',
      });
      return response?.ok === true;
    } catch {
      return false;
    }
  }
}
