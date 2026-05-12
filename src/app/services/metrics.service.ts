import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UploadService } from './upload.service';
import { environment } from '../../environments/environment';

export interface SeriesPoint {
  ts: string;
  value: number;
}

export interface DashboardSnapshot {
  version: number;
  generatedAt: string;
  rangeDays: number;
  cloudfront: {
    requests: { total7d: number; total30d: number; series: SeriesPoint[] };
    bytesDownloaded: { total7dBytes: number; series: SeriesPoint[] };
    errors4xxRate: { avg7d: number; series: SeriesPoint[] };
    errors5xxRate: { avg7d: number; series: SeriesPoint[] };
    totalErrorRate?: { avg7d: number; avg30d: number; series: SeriesPoint[] };
    errorsTotal?: { total7d: number; total30d: number; series: SeriesPoint[] };
  };
  contactForm: {
    invocations30d: number;
    errors30d: number;
    series: SeriesPoint[];
    errorsSeries: SeriesPoint[];
  };
  rebuilds: {
    total30d: number;
    succeeded30d: number;
    failed30d: number;
    series: SeriesPoint[];
    successSeries: SeriesPoint[];
    failedSeries: SeriesPoint[];
    lastBuild: { buildId: string; buildNumber: number; status: string; startedAt: string } | null;
  };
  ses: { sends30d: number; bounces30d: number; complaints30d: number };
  cognito: { userCount: number };
  cost: {
    currency: string;
    monthToDate: number;
    previousMonth: number;
    topServices: { service: string; monthToDate: number }[];
    forecastRemainder: number | null;
    forecastEndOfMonth: number | null;
    forecastLower: number | null;
    forecastUpper: number | null;
  };
}

const KEY = 'metrics/dashboard.json';
const CACHE_KEY = 'metrics-dashboard-v4';
const CACHE_TTL_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private uploadService = inject(UploadService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private bucket = environment.aws.galleryBucket;

  /** Returns cached snapshot synchronously (if present + fresh), otherwise null. */
  readCache(): DashboardSnapshot | null {
    if (!this.isBrowser) return null;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw) as { savedAt: number; snapshot: DashboardSnapshot };
      if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
      return entry.snapshot;
    } catch {
      return null;
    }
  }

  /** Fetches fresh snapshot from S3 and updates cache. */
  async fetch(): Promise<DashboardSnapshot> {
    // cacheBypass: the snapshot JSON has Cache-Control: max-age=300 from the Lambda,
    // so without this the browser HTTP cache serves a stale copy for up to 5 minutes
    // after the Lambda re-runs. no-cache makes the browser do a conditional GET
    // (cheap when unchanged, fresh when changed).
    const snapshot = await this.uploadService.getJson<DashboardSnapshot>(KEY, this.bucket, { cacheBypass: true });
    if (this.isBrowser) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot }));
      } catch { /* quota/safari private — ignore */ }
    }
    return snapshot;
  }
}
