# Admin Dashboard — Daily Metrics Snapshot

**Date:** 2026-05-07
**Status:** **IMPLEMENTED** (2026-05-12). Schema is at v4. See the matching `[x]` entry
in `docs/TODO.md` for the as-built shape and any deviations from this plan
(notably: the Lambda is a single flat `metrics_snapshot.py` rather than the multi-file
layout, matching the existing `contact_form.py` / `trigger_rebuild.py` style; schema
gained `cloudfront.totalErrorRate`, `cloudfront.errorsTotal`, `contactForm.series`
+ `errorsSeries`, full `rebuilds` block, and Cost Explorer forecast fields).
**Decision recap:**
- Daily snapshot pattern (not live proxy) — admin loads a static JSON, instant render
- Run once per day at **04:00 America/Chicago** via EventBridge Scheduler (timezone-aware → no DST drift)
- File is admin-only — stored under a non-CloudFront-routed prefix, fetched by the admin SPA via Cognito temp credentials
- Includes daily AWS cost (Cost Explorer)
- Browser-side cache for the JSON to avoid re-fetching on every dashboard tab open

---

## Architecture overview

```
EventBridge Scheduler  ──cron, America/Chicago──►  Lambda metrics-snapshot
                                                          │
                                                          ├─► CloudWatch GetMetricData (request counts, errors, bytes…)
                                                          ├─► Lambda metrics for the contact-form Lambda
                                                          ├─► SES GetSendStatistics
                                                          ├─► Cognito ListUsers
                                                          ├─► Cost Explorer GetCostAndUsage
                                                          │
                                                          └─► PUT s3://kvaking-gallery/metrics/dashboard.json

Admin SPA  ──Cognito JWT─►  STS temp creds  ──SigV4 GetObject─►  S3 metrics/dashboard.json
```

Key property: `metrics/*` has no CloudFront behavior. CloudFront serves only `gallery-images/*`,
`reviews-data/*`, and the SPA itself. A request to `kvaking.com/metrics/dashboard.json` falls into
the default `/*` rule, hits the site bucket (no such file), returns 404. Direct S3 access
returns 403 because public access is blocked. The only successful read path is admin-authenticated
SigV4.

---

## Caching strategy (addresses the slow-load concern)

The S3 GET for `metrics/dashboard.json` is **not** cached at the CloudFront edge — it goes browser
→ S3 directly via SigV4. Mitigations layered together:

1. **In-memory cache in `AdminComponent`** — fetched once per page load, reused as the user moves
   between tabs. No fetch on tab switch.
2. **sessionStorage cache (15 min TTL)** — survives admin tab navigations and page reloads within
   a session. Keyed by `metrics-dashboard-v1` so a schema bump invalidates old data.
3. **Stale-while-revalidate** — if `sessionStorage` holds a cached snapshot, render it immediately
   AND fire a background fetch. Replace if the new snapshot has a newer `generatedAt` timestamp.
4. **`Cache-Control: max-age=300` set on the PUT from the snapshot Lambda** — lets browsers reuse
   their HTTP cache for 5 minutes even outside our explicit code path. Safe because the file only
   changes once per day; 5 min is well below the regeneration cadence.
5. **Snapshot is small** — under 5 KB JSON. Even on a cold fetch, the GET is ~100–300 ms. With the
   layers above, the dashboard renders in <50 ms after the first session-level fetch.

Net result: first dashboard open of a session takes one ~200 ms request. Every subsequent open
within 15 minutes is instant.

---

## JSON schema (`metrics/dashboard.json`)

```json
{
  "version": 1,
  "generatedAt": "2026-05-07T09:00:00Z",
  "rangeDays": 7,

  "cloudfront": {
    "requests":         { "total7d": 12480, "total30d": 51230, "series": [{ "ts": "2026-05-01", "value": 1620 }, …] },
    "bytesDownloaded":  { "total7dBytes": 2480000000, "series": [{ "ts": "2026-05-01", "value": 332000000 }, …] },
    "errors4xxRate":    { "avg7d": 0.012, "series": [{ "ts": "2026-05-01", "value": 0.014 }, …] },
    "errors5xxRate":    { "avg7d": 0.001, "series": [{ "ts": "2026-05-01", "value": 0.000 }, …] }
  },

  "contactForm": {
    "invocations30d": 14,
    "errors30d": 0
  },

  "ses": {
    "sends30d": 14,
    "bounces30d": 0,
    "complaints30d": 0
  },

  "cognito": {
    "userCount": 1
  },

  "cost": {
    "currency": "USD",
    "monthToDate": 1.42,
    "previousMonth": 3.18,
    "topServices": [
      { "service": "Amazon CloudFront",     "monthToDate": 0.61 },
      { "service": "Amazon Route 53",       "monthToDate": 0.50 },
      { "service": "AWS Lambda",            "monthToDate": 0.07 },
      { "service": "Amazon Simple Storage", "monthToDate": 0.05 }
    ]
  }
}
```

`series` arrays are **daily** points. Series length is `rangeDays`. Last point is "yesterday in
America/Chicago" — the snapshot intentionally does not include the partial current day.

---

## Lambda: `metrics-snapshot`

**Runtime:** Python 3.12 (matches existing contact-form Lambda style)
**Memory:** 256 MB
**Timeout:** 60s
**Source:** `infrastructure/lambdas/metrics-snapshot/`
**Layout:**
```
metrics-snapshot/
  handler.py        # entry point
  cloudwatch.py     # GetMetricData wrappers
  cost.py           # Cost Explorer wrapper
  schema.py         # JSON shape constants + version bumping
  requirements.txt  # boto3 (provided in runtime), tzdata
```

**Pseudo-flow (handler.py):**
```python
def handler(event, context):
    today_chicago = today_in("America/Chicago")
    end   = today_chicago.midnight()                      # exclusive
    start = end - timedelta(days=7)                       # 7d window
    series_30d = end - timedelta(days=30)

    cf      = cloudwatch.cloudfront_summary(start, end)
    cf_30d  = cloudwatch.cloudfront_totals(series_30d, end)
    contact = cloudwatch.lambda_metrics(CONTACT_FN, series_30d, end)
    ses     = ses_client.get_send_statistics()
    users   = cognito.list_users(USER_POOL_ID)
    cost    = ce.month_to_date_with_top_services()

    snapshot = build_snapshot(cf, cf_30d, contact, ses, users, cost)

    s3.put_object(
        Bucket=GALLERY_BUCKET,
        Key="metrics/dashboard.json",
        Body=json.dumps(snapshot),
        ContentType="application/json",
        CacheControl="max-age=300",
    )
```

**Environment variables:**
- `GALLERY_BUCKET=kvaking-gallery`
- `DISTRIBUTION_ID=<cf id>` (for the CloudFront metric dimension)
- `CONTACT_FN=kvaking-contact-form`
- `USER_POOL_ID=<cognito pool id>`

**IAM role permissions:**
- `cloudwatch:GetMetricData` on `*` (CW doesn't support resource-level scoping for this)
- `ce:GetCostAndUsage` (account-level)
- `ses:GetSendStatistics`
- `cognito-idp:ListUsers` on the User Pool ARN
- `s3:PutObject` on `arn:aws:s3:::kvaking-gallery/metrics/*`

---

## EventBridge Scheduler

```hcl
resource "aws_scheduler_schedule" "metrics_snapshot" {
  name        = "kvaking-metrics-snapshot-daily"
  group_name  = "default"
  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 4 * * ? *)"
  schedule_expression_timezone = "America/Chicago"

  target {
    arn      = aws_lambda_function.metrics_snapshot.arn
    role_arn = aws_iam_role.scheduler_invoke.arn
  }
}
```

- Cron runs daily at **04:00 America/Chicago** — DST transitions handled automatically
- ~1 hour after midnight Chicago = previous day's CloudWatch data is fully published

---

## Cognito IAM extension

The existing authenticated role currently grants `s3:GetObject/PutObject/DeleteObject` on
`gallery-images/*` and `reviews-data/*`. Add a new statement:

```hcl
statement {
  effect    = "Allow"
  actions   = ["s3:GetObject"]
  resources = ["${aws_s3_bucket.gallery.arn}/metrics/*"]
}
```

Read-only — admin SPA never writes the dashboard file.

---

## Admin UI

**File:** `src/app/pages/admin/admin.component.ts` (and the dashboard tab in the HTML)

### State

```ts
interface DashboardSnapshot { /* matches JSON schema above */ }

dashboardSnapshot: DashboardSnapshot | null = null;
dashboardLoading = false;
dashboardError = '';
private dashboardCacheTtlMs = 15 * 60 * 1000; // 15 min
private readonly DASHBOARD_KEY = 'metrics/dashboard.json';
private readonly DASHBOARD_CACHE_KEY = 'metrics-dashboard-v1';
```

### Load flow

```ts
async loadDashboard(): Promise<void> {
  // 1. Render from sessionStorage if present + fresh
  const cached = this.readDashboardCache();
  if (cached) {
    this.dashboardSnapshot = cached.snapshot;
    this.cdr.detectChanges();
  }

  // 2. Always fetch in background (stale-while-revalidate)
  if (!cached) this.dashboardLoading = true;
  try {
    const fresh = await this.uploadService.getJson<DashboardSnapshot>(
      this.DASHBOARD_KEY,
      GALLERY_BUCKET,
    );
    if (!cached || fresh.generatedAt > cached.snapshot.generatedAt) {
      this.dashboardSnapshot = fresh;
      this.writeDashboardCache(fresh);
    }
  } catch (e) {
    if (!cached) this.dashboardError = 'Could not load metrics.';
  } finally {
    this.dashboardLoading = false;
    this.cdr.detectChanges();
  }
}
```

`uploadService.getJson(key, bucket)` is a tiny addition (mirrors existing `putJson`).

### Layout (Dashboard tab)

```
┌──────────────────────────────────────────────────────────────────┐
│  KPI cards row (4 cards, h-32):                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│  │ Requests   │ │ Bandwidth  │ │ 4xx        │ │ 5xx        │     │
│  │ 12,480     │ │ 2.48 GB    │ │ 1.2%       │ │ 0.1%       │     │
│  │ last 7 days│ │ last 7 days│ │ avg        │ │ avg        │     │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘     │
│                                                                  │
│  Requests sparkline (full width, h-40)                           │
│  ▁▂▄▆█▇▅▃                                                        │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐      │
│  │ Cost month-to-date       │  │ Activity (30d)           │      │
│  │ $1.42                    │  │ Contact form: 14 / 0 err │      │
│  │ Last month: $3.18        │  │ SES sends: 14            │      │
│  │ Top: CloudFront $0.61    │  │ Bounces / complaints: 0  │      │
│  │      Route 53   $0.50    │  │ Admin users: 1           │      │
│  │      Lambda     $0.07    │  │                          │      │
│  └──────────────────────────┘  └──────────────────────────┘      │
│                                                                  │
│  Footer: "Snapshot generated YYYY-MM-DD HH:MM CT"                │
└──────────────────────────────────────────────────────────────────┘
```

**Sparkline rendering:** hand-rolled SVG (~30 LOC component). No charting library dependency.
The series is small (7–30 points), so `<polyline>` plus a Y-axis range is plenty.

---

## Terraform additions (summary)

New files / resources in `infrastructure/`:

```
infrastructure/
├── lambdas/
│   └── metrics-snapshot/             # NEW
│       ├── handler.py
│       ├── cloudwatch.py
│       ├── cost.py
│       └── schema.py
└── main.tf                           # MODIFY — add the resources below
```

Resources added (~120 LOC HCL):
1. `aws_lambda_function.metrics_snapshot` — Python runtime, code zipped from `lambdas/metrics-snapshot/`
2. `aws_iam_role.metrics_snapshot_exec` + 5 inline policy statements
3. `aws_iam_role.scheduler_invoke` + permission to invoke the Lambda
4. `aws_scheduler_schedule.metrics_snapshot` — daily at 04:00 America/Chicago
5. `aws_iam_role_policy.cognito_authenticated` — extend with the `metrics/*` GetObject statement

No new buckets, no new CloudFront behaviors, no DNS changes.

---

## Cost summary (final)

| Item                           | Monthly cost   |
|--------------------------------|----------------|
| EventBridge Scheduler          | $0             |
| Lambda execution (30/mo)       | $0 (free tier) |
| CloudWatch GetMetricData       | ~$0.003        |
| Cost Explorer (1 call/day)     | ~$0.30         |
| S3 PUT/GET/storage             | ~$0            |
| **Total**                      | **~$0.30/mo**  |

The Cost Explorer call is the only line item that's not effectively free. If you ever want to
trim this further, the Lambda could call CE only once per week and reuse the cached number on
intervening days, which drops the total to ~$0.05/mo. Daily refresh seems worth $0.30.

---

## Open questions / decisions to revisit

- **Series length:** 7 days vs 30 days for the request graph. 30d gives more shape but 7d is
  more legible on a small sparkline. Default to 7d, optionally compute both and let the UI pick.
- **History accumulation:** could also write `metrics/dashboard-2026-05-07.json` (dated) alongside
  `metrics/dashboard.json` (latest). Storage cost is trivial. Worth doing if you ever want
  long-term trend lines beyond the 30d snapshot. Defer until requested.
- **Lambda cold-start latency:** ~1s for Python 3.12. Irrelevant for a daily scheduled invoke.
- **Failure handling:** if the snapshot Lambda fails one day, the admin dashboard shows
  yesterday's data with a small "Snapshot is N days old" warning. Acceptable.
- **Backfill on first deploy:** the admin will see "no snapshot yet" until the first scheduled
  run completes (up to 24h after deploy). Acceptable, or we can manually invoke the Lambda once
  via `aws lambda invoke` post-apply.
