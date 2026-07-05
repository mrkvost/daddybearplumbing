# Daddy Bear Plumbing — Project TODO

Goals are listed in recommended execution order.
Work through them one at a time. Each goal has acceptance criteria that define "done."

---


## GOAL 3 — Search Engine Optimization

**Why:** A plumbing company lives or dies on local search. Most of this is code-level work
with some external steps that cannot be automated.

**Decisions:**
- Priority: **local SEO** (rank for "[service] + suburb" queries)

**Sub-tasks (in-code):**
- [ ] Add `LocalBusiness` JSON-LD structured data schema (name, address, phone, hours,
      service area, geo coordinates) to Angular's `index.html` or via a service
- [x] Create `robots.txt` in Angular's `public/` folder (disallows /admin)
- [x] Create `sitemap.xml` listing all public routes; robots.txt points to it
- [x] Add `<link rel="canonical">` per page (CanonicalService, auto on navigation, skips /admin)
- [x] Angular SSG full prerender — `@angular/ssr` installed, `angular.json` uses
      `prerender.discoverRoutes: true` so every static route in `app.routes.ts` gets its
      own `index.html`. **15 files** generated (`/`, `/about`, `/contact`, `/residential`,
      `/commercial`, `/construction/interior`, `/construction/exterior`, `/gallery`,
      `/reviews`, `/faq`, `/terms`, `/privacy`, `/cookies`, `/admin`, `/admin/login`).
      `main.server.ts` bootstraps with `BootstrapContext` (Angular 21 API);
      `app.config.server.ts` adds `provideServerRendering()`.
      SSR-safety guards added so prerender doesn't hang or crash:
      `AuthService.loadTokens` / `saveTokens` / `clearTokens` skip on server;
      `authGuard` returns `true` on server so `/admin` prerenders the shell instead of
      redirecting; `AdminComponent.ngOnInit` skips all data fetches on server;
      `GalleryService` + `ReviewsService` return empty arrays on server;
      `ContactComponent.ngAfterViewInit` skips Turnstile widget init on server (also
      cleans up via `turnstile.remove(widgetId)` on destroy).
      Companion CloudFront viewer-request Function (`aws_cloudfront_function.spa_router`
      in `infrastructure/main.tf`) rewrites incoming URIs like `/admin/login` →
      `/admin/login/index.html` so the prerendered files actually get served (S3 with
      OAC has no directory-index resolution; without this rewrite every non-root path
      hits the 403 fallback and serves the home shell, causing a navbar flash before
      Angular routes client-side).
      Business info (domain, phone, email, address) moved out of `environment.ts` into
      `src/app/globals.ts` (`BUSINESS` const) — clean split between business data and
      AWS/infra config. `generate-seo.js` reads `domain` from `globals.ts`.
- [x] Self-host Public Sans + Inter fonts (eliminates Google Fonts round-trip for text fonts)

**Sub-tasks (external — checklist only, no code):**
- [ ] Claim and complete **Google Business Profile** (address, phone, hours, photos, service areas)
- [ ] Submit sitemap to **Google Search Console**
- [ ] Submit sitemap to **Bing Webmaster Tools**
- [ ] Build 3–5 local citations (Yelp, Angi, HomeAdvisor, local chamber of commerce)
- [ ] Ask satisfied customers for **Google reviews** (share direct link from GBP dashboard)

**Acceptance criteria:**
- Google's Rich Results Test shows a valid `LocalBusiness` schema with no errors
- Lighthouse SEO score ≥ 90 on mobile
- Site is indexed in Google Search Console with no coverage errors

---

## GOAL 4 — Update README.md ✅ COMPLETE

README covers: prerequisites, local dev, build/deploy, infrastructure setup,
admin user creation, gallery photo convention, project structure.

---

## GOAL 6 — Future Work (unstructured)

- [x] Enhanced footer (5-column layout: brand, services, navigate, information, accreditation with license numbers)
- [x] Admin-triggered rebuild — fully wired end-to-end.
      - `infrastructure/buildspec.yml` — Node 22, generate-seo.js, npm install, ng build,
        `aws s3 sync` site bucket, `cloudfront create-invalidation`.
      - `infrastructure/lambda/trigger_rebuild.py` + `rebuild_status.py` — start build /
        read CodeBuild state. Function URLs use `AWS_IAM` auth.
      - `infrastructure/main.tf` — CodeBuild project (GitHub source via CodeConnections),
        Lambda function URLs, IAM. Cognito authenticated role gets **both**
        `lambda:InvokeFunctionUrl` *and* `lambda:InvokeFunction` (the latter with
        `lambda:InvokedViaFunctionUrl=true` condition) — AWS started requiring both on
        Function URLs created after October 2025; missing the second caused 403s.
      - `src/app/services/sigv4.ts` (generic AWS SigV4 signer) + `rebuild.service.ts`
        (start + status polling).
      - Admin → Dashboard tab → "Rebuild Site" button + status panel (30 s poll).
      One-time setup (full walkthrough in README "Admin-Triggered Rebuild"): set
      `github_repo_url`/`github_branch`, `terraform apply`, authorise the GitHub
      `CodeConnections` connection in the AWS console, paste the two Function URLs
      into `src/environments/environment.ts`, bake + deploy once locally.
- [x] Admin dashboard metrics — implemented end-to-end. **Schema is at v4**:
      `cloudfront.{requests,bytesDownloaded,errors4xxRate,errors5xxRate,totalErrorRate,errorsTotal}`,
      `contactForm.{invocations30d,errors30d,series,errorsSeries}`,
      `rebuilds.{total30d,succeeded30d,failed30d,series,successSeries,failedSeries,lastBuild}`,
      `ses.*`, `cognito.userCount`, `cost.{monthToDate,previousMonth,topServices,forecastRemainder,
      forecastEndOfMonth,forecastLower,forecastUpper}`. All daily series are padded to exactly 30
      entries (missing days → 0).
      - Lambda: `infrastructure/lambda/metrics_snapshot.py` (Python 3.13, 256 MB, 60 s timeout).
        Fetches CloudWatch (CloudFront in us-east-1 + Lambda metrics in eu-central-1), Cost Explorer
        (`GetCostAndUsage` + `GetCostForecast`), SES `GetSendStatistics`, Cognito `ListUsers`,
        CodeBuild `ListBuildsForProject` + `BatchGetBuilds`. Writes
        `s3://kvaking-gallery/metrics/dashboard.json` with `Cache-Control: max-age=300`.
      - EventBridge Scheduler: daily at 04:00 America/Chicago (DST-aware).
      - IAM: dedicated exec role for the Lambda; scheduler role with `lambda:InvokeFunction`;
        Cognito authenticated role extended with read-only `s3:GetObject` on `metrics/*`.
      - SPA: `MetricsService` reads via SigV4 directly from S3 (no CloudFront in path). Sends
        `cache: 'no-cache'` so the 5-min HTTP cache doesn't hide fresh snapshots after a manual
        re-invoke. sessionStorage cache (`metrics-dashboard-v4`) for stale-while-revalidate paint.
      - UI: KPI cards removed in favour of three sparklines side-by-side:
        CF requests (with error count overlaid in red), contact form invocations (errors in red),
        rebuilds (failed builds in red). Beneath: cost MTD + previous month + end-of-month forecast
        with 80% interval bounds + top services; activity block with SES/Cognito/last build.
        Footer shows snapshot timestamp with timezone (`'M/d/yy, h:mm a zzz'`).
      - Sparkline component (`src/app/components/sparkline/sparkline.component.ts`) is a single
        standalone SVG, no charting library. Supports an optional `overlayPoints` (drawn first in
        red, primary line on top); shared Y-axis between primary + overlay. Single-day series
        renders as a labelled value instead of "No data".
      - Cost: ~$0.30/mo (Cost Explorer is the only non-free item).
- [x] Browser cache headers — Lighthouse "Use efficient cache lifetimes" had flagged ~351 KiB
      missing `Cache-Control`. Fixed end-to-end:
      - Extracted publish step into `scripts/publish.sh` (shared by `deploy.sh` and CodeBuild
        `buildspec.yml` so cache strategy lives in one place).
      - Layered 3-pass upload: `chunk-*.js` / `styles-*.css` / `logo.svg` → `max-age=31536000,
        immutable` (1y); `fonts/*` → `max-age=2592000` (30d); HTML / sitemap / robots →
        `max-age=300, must-revalidate` (5min).
      - Side-fix: the old `deploy.sh` excluded only the root `index.html` from immutable
        caching, so the prerendered nested `*/index.html` files were wrongly being tagged
        for a year. Now they get the short cache like the root.
      - `UploadService.upload()` sets `Cache-Control: public, max-age=31536000, immutable`
        on every PutObject — safe because every admin-uploaded image is content-hashed
        (`hero-<hash>.jpg`, `card-<hash>.png`, gallery photos) so the URL is the cache key.
        `putJson()` deliberately doesn't set it: JSON manifests are runtime data and must
        stay fresh.
      - One-shot backfill on existing gallery objects via
        `aws s3 cp s3://kvaking-gallery/gallery-images/ ... --recursive --metadata-directive
        REPLACE --exclude "*.json"` followed by per-extension `--content-type` passes
        (REPLACE wipes Content-Type, had to re-set image/jpeg, image/png, image/svg+xml)
        and a CloudFront invalidation for `/gallery-images/*`.
- [ ] Unify S3 buckets — currently 3 buckets (site `kvaking`, gallery `kvaking-gallery`, reviews
      `kvaking-reviews`), each with its own bucket policy, CORS, IAM scoping, and CloudFront origin.
      A single bucket with prefixes (`/site/*`, `/gallery-images/*`, `/reviews-data/*`, `/metrics/*`)
      would simplify Terraform, IAM scoping, and cache-policy management. Migration: copy contents,
      flip CloudFront origin + behaviors, update environment.ts bucket names, update Cognito IAM
      role resource ARNs, then delete the empty buckets. Done well, this is a one-shot change with
      no user-visible impact.
- [ ] Online chat integration - more complex
- [ ] Polish service-card modal `alt` text — residential + commercial card modals currently use
      just `selectedCard.title` (e.g., "Drain Cleaning"). Append a service qualifier
      ("Drain Cleaning service" or "Drain Cleaning — residential plumbing") for marginal keyword
      density on the photo. Functional today; minor SEO polish only.
- [x] Pagination for admin gallery and reviews lists (+ editable position numbers)
- [x] Session persistence (tokens in sessionStorage + auto-refresh)
- [ ] Google Business Profile link on map/address
- [x] Investigated **service worker / PWA** — decided **not worth it** for this site.
      Visitor profile is one-time / low-frequency lookups whose primary CTA is the call
      button (no-internet failure mode = call, not "wait to retry contact form"), and
      the site is already well-optimized: SSG with 15 prerendered routes, hashed JS
      bundles cached forever by CloudFront, `fetchpriority="high"` on the hero LCP
      image, `font-display: optional` on Public Sans so the fallback never swaps.
      A service worker would add real costs — SW update / versioning story, stale-cache
      debugging, iOS Safari quirks, admin-area exclusion (admin relies on live S3
      fetches and would be silently masked by a SW cache) — for marginal LCP gains on
      repeat visits the HTTP cache already covers. The one borderline case
      (background-sync queueing for offline contact-form submits) is a tiny slice of
      visitors and adds queue/retry logic that has to be tested per-browser. Revisit
      if site usage shifts toward returning visitors (e.g. customer portal, dashboard).
- [ ] **Admin documentation page.** New tab (or a `?` icon link) inside admin that
      walks through each tab's workflow: how to upload hero/OG/about images, edit
      service & construction cards, manage albums, edit FAQ/locations, trigger a
      rebuild, what each indicator means. Markdown rendered in-app, content lives in
      the repo so it stays in sync with code changes.

---

## Notes

- Goals 1 and 2 are complete.
- Goals 3 and 5 can be done in any order (both operate on Angular components).
- `terraform.tfvars` is gitignored — never commit real AWS account details.
- For a new deployment: copy `terraform.tfvars.example`, delete `import.tf`, run `bootstrap.sh`.

- should we remove dead code?
- should we refactor (make parts that repeat re-usable)?
- rebuilder and metrics as one (with possible parameters?)
- og-placeholder can be removed (og-<hash> is enough)

- on the home page fix text in the need plumbing help
- on the home page divider on the bottom does not match, how should the divider on the about us page look like? i do not like current white line
- logo for the footer needs rework (white background)
- footer text should be updated
- footer IDPH add slightly more white around it

- current inconsistent looks of the top parts of the pages

- navigate links in the footer, google, plus youtube link? https://www.youtube.com/@DaddyBearPlumbing
- the texts comparison from the before redesign.

- my own: 'No reviews if no reviews'?
