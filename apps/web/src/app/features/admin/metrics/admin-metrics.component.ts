import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { AdminMetricsApiService } from './admin-metrics-api.service';
import type { AnalyticsSummary } from './admin-metrics.models';

@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-metrics.component.html',
})
export class AdminMetricsComponent implements OnInit {
  private readonly metricsApi = inject(AdminMetricsApiService);
  private readonly authStore = inject(AuthStore);

  protected readonly periodDays = signal<7 | 30>(7);
  protected readonly summary = signal<AnalyticsSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly activeBranchName = computed(() => {
    const branchId = this.authStore.activeBranchId();
    const match = this.authStore
      .accessibleBranches()
      .find((branch) => branch.id === branchId);
    return match?.name ?? 'esta sucursal';
  });

  private initialized = false;
  private loadedBranchId: string | null = null;

  constructor() {
    effect(() => {
      const branchId = this.authStore.activeBranchId();
      if (!this.initialized || !branchId) {
        return;
      }
      if (branchId !== this.loadedBranchId) {
        void this.load();
      }
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    void this.load();
  }

  protected setPeriod(days: 7 | 30): void {
    if (this.periodDays() === days) {
      return;
    }
    this.periodDays.set(days);
    void this.load();
  }

  protected formatDuration(totalSeconds: number | null): string {
    if (totalSeconds === null) {
      return '—';
    }
    if (totalSeconds < 60) {
      return `${totalSeconds} s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
  }

  protected stayedPercent(summary: AnalyticsSummary): string {
    if (summary.visits === 0) {
      return '—';
    }
    return `${Math.round((summary.stayedCount / summary.visits) * 100)} %`;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.loadedBranchId = this.authStore.activeBranchId();
    try {
      const result = await firstValueFrom(
        this.metricsApi.summary(this.periodDays()),
      );
      this.summary.set(result);
    } catch (error: unknown) {
      this.summary.set(null);
      this.loadError.set(this.messageForLoadError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageForLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'No pudimos conectar con el servidor. Intentá de nuevo.';
    }
    return 'No pudimos cargar las métricas. Intentá de nuevo.';
  }
}
