/**
 * RebuildService — triggers and polls admin-initiated CodeBuild rebuilds.
 *
 * Calls two AWS Lambda Function URLs (AWS_IAM auth) using temporary
 * credentials obtained from the Cognito Identity Pool, signed via SigV4.
 */
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { signAndFetch } from './sigv4';
import { environment } from '../../environments/environment';

export interface BuildSummary {
  id: string;
  buildNumber: number | null;
  status: string;
  currentPhase: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class RebuildService {
  private auth = inject(AuthService);
  private region = environment.aws.region;

  async start(): Promise<BuildSummary> {
    const creds = await this.auth.getCredentials();
    const url = environment.rebuildTriggerUrl;
    if (!url) throw new Error('rebuildTriggerUrl not configured');

    const res = await signAndFetch({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode('{}'),
      region: this.region,
      service: 'lambda',
      credentials: creds,
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Trigger failed: ${res.status}`);
    }
    return {
      id: data.buildId,
      buildNumber: data.buildNumber ?? null,
      status: data.status,
      currentPhase: null,
      startedAt: data.startedAt ?? null,
      endedAt: null,
    };
  }

  async status(buildId?: string): Promise<BuildSummary | null> {
    const creds = await this.auth.getCredentials();
    const base = environment.rebuildStatusUrl;
    if (!base) throw new Error('rebuildStatusUrl not configured');
    const url = buildId ? `${base}?id=${encodeURIComponent(buildId)}` : base;

    const res = await signAndFetch({
      method: 'GET',
      url,
      headers: {},
      region: this.region,
      service: 'lambda',
      credentials: creds,
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Status fetch failed: ${res.status}`);
    }
    return data.build ?? null;
  }
}
