import { Component, Input } from '@angular/core';

export interface SparkPoint { ts: string; value: number; }

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    @if (points.length >= 2) {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none"
        class="w-full h-full" role="img" [attr.aria-label]="label">
        @if (showFill) {
          <polygon [attr.points]="fillPoints" class="fill-primary/10" />
        }
        @if (overlayPoints.length === points.length) {
          <polyline fill="none" stroke-width="1.5" [attr.stroke]="overlayColor" [attr.points]="overlayStrokePoints" />
        }
        <polyline fill="none" stroke="currentColor" stroke-width="1.5" [attr.points]="strokePoints" />
      </svg>
    } @else if (points.length === 1) {
      <div class="flex items-center justify-center h-full text-xs text-secondary">
        Single day · <span class="font-mono ml-1 text-on-surface">{{ points[0].value }}</span> on {{ points[0].ts }}
      </div>
    } @else {
      <div class="flex items-center justify-center h-full text-xs text-secondary italic">No activity</div>
    }
  `,
})
export class SparklineComponent {
  @Input({ required: true }) points: SparkPoint[] = [];
  @Input() overlayPoints: SparkPoint[] = [];
  @Input() overlayColor = '#dc2626'; // red-600
  @Input() label = '';
  @Input() showFill = true;

  readonly width = 200;
  readonly height = 60;
  private readonly pad = 2;

  get strokePoints(): string {
    return this.scaled(this.points).map(([x, y]) => `${x},${y}`).join(' ');
  }

  get overlayStrokePoints(): string {
    return this.scaled(this.overlayPoints).map(([x, y]) => `${x},${y}`).join(' ');
  }

  get fillPoints(): string {
    const pts = this.scaled(this.points);
    if (pts.length < 2) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const baseline = this.height - this.pad;
    return [`${first[0]},${baseline}`, ...pts.map(([x, y]) => `${x},${y}`), `${last[0]},${baseline}`].join(' ');
  }

  /** Both series share the same Y-axis range so they are visually comparable. */
  private get yRange(): { min: number; max: number } {
    const all = [...this.points.map(p => p.value), ...this.overlayPoints.map(p => p.value)];
    const min = Math.min(...all, 0);
    const max = Math.max(...all, 1);
    return { min, max };
  }

  private scaled(series: SparkPoint[]): [number, number][] {
    const { min, max } = this.yRange;
    const range = max - min || 1;
    const usable = this.width - this.pad * 2;
    const usableH = this.height - this.pad * 2;
    return series.map((p, i) => {
      const x = this.pad + (i / Math.max(1, series.length - 1)) * usable;
      const y = this.pad + (1 - (p.value - min) / range) * usableH;
      return [x, y];
    });
  }
}
