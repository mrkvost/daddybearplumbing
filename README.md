# Daddy Bear Plumbing

Website for a plumbing company serving Chicago and Suburbs.
Built with Angular 21, Tailwind CSS v3, deployed to AWS via Terraform.

---

## Prerequisites

- **Docker** — for building the Angular app (no local Node.js needed)
- **AWS CLI** — configured with credentials (`aws configure`)
- **Terraform** — v1.7 or higher

---

## Local Development

Using Docker (no local Node.js required):

```bash
# Build the app
./docker_build.sh

# Serve locally at http://localhost:8080
./docker_serve.sh
```

Or with local Node.js:

```bash
npm install
ng serve
# Open http://localhost:4200
```

---

## Building & Deploying

```bash
./docker_build.sh    # Build Angular app in Docker (node:24-alpine)
./deploy.sh          # Sync to S3 + invalidate CloudFront cache
```

The build uses Angular's `@angular/ssr` to **prerender every static route** in
`app.routes.ts` (15 files for the current routes). Each route gets its own
`<path>/index.html` so the initial paint already contains that page's content —
no flash of home shell when navigating directly to e.g. `/contact` or `/admin`.
`angular.json` has `prerender.discoverRoutes: true`; nothing in
`src/prerender-routes.txt` is needed (file deleted).

S3 + OAC doesn't auto-resolve `/admin/login` to `/admin/login/index.html`, so a
small CloudFront viewer-request Function (`aws_cloudfront_function.spa_router`)
rewrites incoming URIs to append `/index.html` for any path without a file
extension. Without it, every non-root URL falls through to the SPA 403 fallback
and serves the home shell.

---

## Multi-Deployment Setup (kvaking, daddybear, …)

This repo can drive multiple independent AWS deployments — each in its own
AWS account, region, and Terraform state — from a single codebase. The
current example: `kvaking.com` (staging, eu-central-1) and
`daddybearplumbing.com` (production, us-east-1).

### File layout

```
infrastructure/
├── main.tf                       # backend block is partial — no bucket/key/region
├── backends/
│   ├── kvaking.hcl               # state bucket + region for kvaking
│   └── daddybear.hcl             # state bucket + region for daddybear
├── terraform.tfvars.kvaking      # per-env variable values (domain, keys, etc.)
├── terraform.tfvars.daddybear
├── terraform.tfvars.example      # template — copy to add a new env
├── bootstrap.sh                  # reads backends/<env>.hcl, creates the state bucket
└── tf                            # wrapper: ./tf <env> <subcommand>
```

The single source of truth for each deployment is its pair of files:
`backends/<env>.hcl` (state location + region) and
`terraform.tfvars.<env>` (per-env variable values including `domain`,
`bucket_name`, `region`, feature-flag gates). `main.tf` is shared.

**Workspace convention: workspace name equals env name.** Each deployment's
state lives in a **Terraform workspace** matching its env name — env
`kvaking` uses workspace `kvaking`, env `daddybear` uses workspace
`daddybear`. Actual state key in the S3 backend for env `<env>`:
`env:/<env>/<env>/terraform.tfstate`. Terraform's built-in `default`
workspace is left empty. The `./tf <env> init` wrapper automatically
selects (or creates) the right workspace, so a fresh clone doesn't
accidentally land on `default` and try to recreate every resource.

### AWS profile setup

Split credentials + config by env so nothing runs against the wrong account:

`~/.aws/credentials`:
```ini
[kvaking]
aws_access_key_id     = ...
aws_secret_access_key = ...

[daddybear]
aws_access_key_id     = ...
aws_secret_access_key = ...
```

`~/.aws/config` (note the `profile ` prefix — required for named profiles):
```ini
[profile kvaking]
region = eu-central-1
output = json

[profile daddybear]
region = us-east-1
output = json
```

Drop `[default]` from both files. Bare `aws` commands will then error out
loudly instead of silently touching the wrong account. Every command gets
prefixed with `AWS_PROFILE=<env>` (or run through `./tf`, which sets it).

### The `./tf` wrapper

`./tf <env> <subcommand> [args...]` forwards to `terraform`, adding:

- `AWS_PROFILE=<env>` so the AWS SDK targets the right account.
- For `init`: `-backend-config=backends/<env>.hcl -reconfigure` so the S3
  backend points at the right state bucket/region, then
  `terraform workspace select -or-create <env>` to land on the right
  workspace (see workspace convention above).
- For `plan|apply|destroy|refresh|import|console|state|taint|untaint`:
  `-var-file=terraform.tfvars.<env>` so per-env values load. Workspace
  selection persists in `.terraform/environment` (gitignored) between
  commands, so no re-select is needed after init.

Examples:
```bash
./tf kvaking plan
./tf daddybear apply
./tf daddybear apply -var="publish_dns=true" -var="cloudfront_enabled=true"
./tf daddybear import aws_route53_zone.site Z0123456789ABCDEFGHIJK
```

Switching envs requires **one `./tf <env> init`** — Terraform holds one
backend config in `.terraform/` at a time. After that, all subcommands
against that env "just work".

### Bringing up a fresh deployment (daddybear pattern)

```bash
cd infrastructure

# 1. Populate AWS profile (~/.aws/credentials + ~/.aws/config) as above.

# 2. Create backends/<env>.hcl declaring bucket, key, dynamodb_table, region.
#    (See backends/kvaking.hcl for the shape; conventionally
#    "<env>-terraform-state" / "<env>-terraform-locks".)

# 3. Bootstrap the state bucket + lock table (reads backends/<env>.hcl):
AWS_PROFILE=<env> ./bootstrap.sh <env>

# 4. Copy tfvars template and fill in real values:
cp terraform.tfvars.example terraform.tfvars.<env>
# Edit: domain, bucket_name, project, region, contact_email,
# turnstile_secret, github_repo_url. Keep publish_dns=false and
# cloudfront_enabled=false for the initial apply — see "Staged rollout" below.

# 5. If the target domain is already registered via Route 53 Domains, its
#    hosted zone already exists. Import it so Terraform doesn't try to create
#    a duplicate:
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='<domain>.'].{Id:Id, Name:Name}" \
  --profile <env>
./tf <env> init
./tf <env> import aws_route53_zone.site <ZONE_ID>

#    If the domain is at a third-party registrar, skip the import — Terraform
#    creates the hosted zone and outputs 4 AWS name servers; point the
#    registrar's NS at them.

# 6. If this is a fresh deployment (not migrating existing resources into
#    Terraform state), delete import.tf — that file only exists to adopt
#    the kvaking resources that pre-dated this codebase:
rm import.tf

# 7. First apply. With publish_dns=false and cloudfront_enabled=false the
#    stack builds but nothing serves traffic yet:
./tf <env> plan
./tf <env> apply

# 8. Note the Cognito outputs and paste into src/environments/environment.ts:
./tf <env> output cognito_user_pool_id
./tf <env> output cognito_client_id
./tf <env> output cognito_identity_pool_id
./tf <env> output rebuild_trigger_url
./tf <env> output rebuild_status_url

# 9. Create the first admin user (no self-signup):
AWS_PROFILE=<env> aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username <email> \
  --temporary-password <temp-password>

# 10. Migrate content into the new deployment's S3 buckets. From the source
#     account/region (adjust bucket names as needed):
AWS_PROFILE=<source> aws s3 sync \
  s3://<source>-gallery/  s3://<env>-gallery/  --exact-timestamps
AWS_PROFILE=<source> aws s3 sync \
  s3://<source>-reviews/  s3://<env>-reviews/  --exact-timestamps

# 11. Build + deploy the Angular app with the new env's Cognito IDs baked in:
cd ..
./docker_build.sh
AWS_PROFILE=<env> BUCKET_NAME=<env-site-bucket> ./deploy.sh
```

At this point the whole stack is built but invisible: DNS doesn't resolve to
the new domain, and CloudFront returns 403 to anyone who somehow finds the
default `d1a2b3c4.cloudfront.net` hostname. You can preview at the CF default
hostname by temporarily flipping `cloudfront_enabled` (see below).

### Staged rollout — `publish_dns` and `cloudfront_enabled`

Two independent variables gate visibility. Both default to `true` so
existing deployments (kvaking) keep serving on every apply — you only set
them to `false` explicitly during the setup of a new deployment.

| Variable | `false` behaviour | `true` behaviour |
|---|---|---|
| `publish_dns` | Route 53 A/AAAA records are *not* created; the domain doesn't resolve. | Records created; the domain aliases to CloudFront. |
| `cloudfront_enabled` | Distribution exists but returns HTTP 403 to *every* request (including the CF default hostname). | Distribution serves normally. |

Typical launch sequence for a new deployment:

```bash
# Initial build — invisible from both angles.
./tf daddybear apply    # tfvars has publish_dns=false, cloudfront_enabled=false

# Preview via the CloudFront default hostname (real cert served by CF's own
# wildcard on *.cloudfront.net, so no browser cert warnings):
./tf daddybear output cloudfront_domain
# → open https://<that-hostname>/
./tf daddybear apply -var="cloudfront_enabled=true"      # unlock the CF door

# When content + admin flows are verified, flip DNS on. The site goes live.
./tf daddybear apply -var="publish_dns=true" -var="cloudfront_enabled=true"

# Or set both to true in terraform.tfvars.daddybear once for good.
```

Rollback is symmetric: flip either variable back to `false` and apply.
CloudFront's `enabled` change propagates in ~5 minutes; DNS records add/remove
in seconds.

---

## Gallery Photos

Photos are stored in S3 (`<bucket>-gallery/gallery-images/`) and served via CloudFront at `/gallery-images/*`.

**Filename convention:**
```
<number>_<datetime>_<tag>.ext
e.g.: 0001_2026-02-25-10-30-00_water-heaters.jpg
```

**Upload methods:**
1. **Admin UI** — log in at `/admin`, set a tag, pick files, upload. Drag to reorder. Click tag to edit.
2. **CLI** — `aws s3 cp photo.jpg s3://<bucket>-gallery/gallery-images/<filename>`

**How it works:**
- Admin writes `gallery.json` after every change (upload, delete, reorder, tag edit)
- `gallery.json` stores the ordered list with optional custom tags
- Public gallery page reads `gallery.json` (not cached — `/gallery-images/*.json` uses CachingDisabled)
- Images are cached by CloudFront (CachingOptimized)

---

## Reviews

Reviews are stored as `reviews.json` in S3 (`<bucket>-reviews/reviews-data/`).

Managed via the admin panel (Reviews tab): add, edit, delete.
Public reviews page reads `reviews.json` via CloudFront (not cached — instant updates).

---

## Contact Form

The `/contact` page sends submissions via Lambda + SES.
See `docs/contact-form-setup.md` for full setup instructions (Turnstile, SES verification, etc.).

---

## Admin-Triggered Rebuild

The admin **Dashboard** has a "Rebuild Site" button that kicks off a CodeBuild run
which rebuilds the Angular app (baking in the latest hero/about/OG image refs and
locations), syncs `dist/.../browser/` to the site bucket, and invalidates CloudFront.

CodeBuild pulls source from GitHub via an AWS **CodeConnections** connection
(formerly "CodeStar Connections"). Terraform creates the connection resource; the
GitHub OAuth handshake itself has to be approved once in the console because AWS
provides no API for it.

### Setup

1. Fill in the GitHub variables in `infrastructure/terraform.tfvars.<env>`:

   ```hcl
   github_repo_url = "https://github.com/mrkvost/daddybearplumbing"
   github_branch   = "master"
   ```

2. Apply Terraform — this creates the connection in `PENDING` state along with
   the CodeBuild project and the trigger/status Lambdas:

   ```bash
   cd infrastructure
   ./tf <env> apply
   ```

3. Authorise the GitHub connection (one-time, browser-only). Easiest path is to
   search **"CodeConnections"** in the AWS Console top search bar.
   Direct URL: <https://console.aws.amazon.com/codesuite/settings/connections>.
   Alternative path: **CodePipeline** service → left nav → **Settings → Connections**.
   Make sure the region selector (top-right) matches the deployment's region
   (`eu-central-1` for kvaking, `us-east-1` for daddybear).

   - You should see a connection named `daddybear-github` (or whatever your
     `project` var is) with status **Pending**.
   - Click the connection name → **Update pending connection**.
   - Sign in to GitHub when prompted, click **Authorize AWS Connector for GitHub**,
     install the AWS Connector app on the `mrkvost` account, and grant it access
     to the `daddybearplumbing` repo.
   - Status flips to **Available**. No further Terraform action needed —
     subsequent `terraform apply` runs leave the connection untouched.

4. Grab the two Lambda Function URLs from outputs and paste them into
   `src/environments/environment.ts` (`rebuildTriggerUrl` / `rebuildStatusUrl`):

   ```bash
   ./tf <env> output rebuild_trigger_url
   ./tf <env> output rebuild_status_url
   ```

5. Rebuild + deploy once locally so the URLs are baked into the published bundle:

   ```bash
   cd ..
   ./docker_build.sh
   ./deploy.sh
   ```

After that, **Admin → Dashboard → Rebuild Site** triggers a real CodeBuild run,
polls for completion every 30 seconds, and republishes + invalidates CloudFront on
success.

> The Cognito-authenticated IAM role must grant **both** `lambda:InvokeFunctionUrl`
> and `lambda:InvokeFunction` (the latter scoped with
> `lambda:InvokedViaFunctionUrl=true`) on the two rebuild Lambdas. AWS started
> enforcing this dual-permission requirement on Function URLs created after October
> 2025 — missing the second action returns 403 from the URL even when the first
> is granted. The Terraform `aws_iam_role_policy.cognito_invoke_rebuild` already
> sets both.

---

## Admin Area

The `/admin` route is protected by Cognito authentication.
- Only manually created users can log in (no self-signup)
- First login requires setting a new password
- Session survives page refresh (tokens in sessionStorage, auto-refreshed; cleared on tab close)
- Tabs: **Dashboard**, **Hero**, **OG**, **About**, **Residential**, **Commercial**, **Construction**, **Gallery**, **Albums**, **Reviews**, **Locations**, **FAQ**, **Settings**, plus a top-bar **Rebuild** icon (publish button, with a yellow `!` when changes are pending)
- **Hero image**: select file → full grayscale preview (matches homepage look) → confirm upload. Hash-based filenames for cache busting. Falls back to default `hero.jpg` if no custom image set.
- **OG image**: same flow, used for social media link previews (1200×630 recommended)
- Both tracked via `meta.json` in the gallery bucket
- **Service cards**: edit cards shown on `/residential` and `/commercial` pages. Drag-and-drop reorder, add/edit/delete. Optional per-card image (Residential + Commercial Industries) shown in the card detail modal — uploaded files are stored under `gallery-images/cards/<hash>.<ext>` and old ones are cleaned up on replace/remove/delete. "Load Defaults" to populate from hardcoded cards for first-time editing. Card metadata stored as `services-residential.json` and `services-commercial.json` in the gallery bucket.
- **Construction cards**: same pattern as service cards but for `/construction/residential` and `/construction/commercial`. Stored as a single `construction.json` with `{residential: [...], commercial: [...]}`.
- **Locations**: edit suburb list shown on home + contact. Stored as `locations.json`.
- **FAQ**: edit question + answer + optional bullet list shown on `/faq`. Stored as `faq.json`.
- **Albums**: group photos into named collections (e.g. "Bathroom Remodel — La Grange"). Each album has title, slug, optional description/location, and a cover photo picked from gallery. Customer-facing landing at `/gallery` shows the albums grid above the photo grid; deep link `/gallery/album/<slug>` drills into one album. Photos are assigned to an album from the Gallery admin tab (book-mark icon next to each row). Stored as `albums.json`; per-photo `albumId` lives on entries in `gallery.json`.
- All list tabs share: editable position numbers (click to edit, clamps to valid range), drag-and-drop reorder, pagination (10/page, top + bottom).
- Admin pages are not indexed (noindex meta + robots.txt)

### Dashboard

Opens directly on metrics — no welcome page. Reads `s3://kvaking-gallery/metrics/dashboard.json`
(written daily at 04:00 America/Chicago by `kvaking-metrics-snapshot` Lambda; admin SPA fetches it
via SigV4 directly, with `cache: 'no-cache'` so manual re-invokes show up without waiting for the
5-min HTTP cache).

- Three sparklines side-by-side (CF requests, contact form invocations, rebuilds) with **error
  counts overlaid in red**. Single-day series renders as a labelled value.
- Cost block: month-to-date, previous month, end-of-month forecast with 80% interval bounds, top 5 services.
- Activity block: SES sends/bounces/complaints, admin user count, latest CodeBuild run.
- Footer: "Snapshot generated …" with timezone.

Schema is at **v4**. When the Lambda changes the shape, bump `SCHEMA_VERSION` (Lambda) and the
sessionStorage `CACHE_KEY` (`metrics-dashboard-v4` in `src/app/services/metrics.service.ts`) in lockstep
so stale client caches don't crash the new template.

### Rebuild Indicator

The top-bar **Rebuild** icon shows a yellow `!` badge when admin has made changes that aren't yet
baked into the prerendered HTML. **Only four areas trigger a rebuild**: Hero image, OG image,
About image, Locations. Everything else (gallery, reviews, FAQ, cards, albums, …) is fetched at
runtime by the public SPA and goes live as soon as the JSON is uploaded.

- Pending state is stored at `s3://kvaking-gallery/admin-pending.json` (cross-session, cross-device).
- Baseline state (last published values) lives at `s3://kvaking-gallery/admin-baseline.json`; updated
  by the SPA when a rebuild reaches `SUCCEEDED`.
- Each save calls `reconcilePendingArea(area)` which diffs current vs baseline — so an add+delete
  that returns the data to the published state correctly clears the badge.
- Before the first SUCCEEDED build (no baseline yet), reconciliation falls back to "always mark";
  one rebuild seeds the baseline and the diff logic takes over.

---

## Project Structure

```
src/
  app/
    components/        # Reusable UI (navbar, footer, hero, trust-stats, services-grid, service-area)
    pages/             # Route pages (home, gallery, reviews, contact, about, residential, commercial, faq, terms, privacy, cookies, admin, login)
    services/          # AuthService, UploadService, GalleryService, ReviewsService, CanonicalService, RebuildService, MetricsService, sigv4
    components/sparkline/ # SVG sparkline used by admin Dashboard (supports an optional red error overlay)
    guards/            # authGuard (protects /admin, SSR-aware so /admin can prerender)
    app.routes.ts      # Route configuration
    app.ts / app.html  # Root layout shell
    globals.ts         # BUSINESS const — phone, email, address, domain (used by 16+ files)
  environments/        # AWS/infra config only (Cognito IDs, bucket names, Function URLs, Turnstile site key)
                       # — business info lives in src/app/globals.ts
  main.server.ts       # Angular SSR bootstrap (BootstrapContext, Angular 21 API)
  fonts.css            # Self-hosted @font-face (Public Sans + Inter)
  styles.css           # Tailwind directives + custom utilities
  index.html           # HTML entry point
infrastructure/
  main.tf              # All AWS resources (S3 x3, CloudFront + spa_router Function, Route53, ACM, Cognito, SES, CodeBuild, Lambda x4, EventBridge Scheduler)
  buildspec.yml        # CodeBuild spec used by admin-triggered rebuild (Node 24)
  lambda/
    contact_form.py     # Contact form handler (Turnstile + SES)
    trigger_rebuild.py  # Starts a CodeBuild run
    rebuild_status.py   # Reads latest build state
    metrics_snapshot.py # Daily metrics snapshot → metrics/dashboard.json (Python 3.13)
  variables.tf         # Input variables (incl. github_repo_url, github_branch)
  outputs.tf           # Terraform outputs (incl. rebuild_trigger_url, rebuild_status_url, github_connection_status)
  import.tf            # Import blocks for existing resources
  bootstrap.sh         # Creates state bucket + lock table
  terraform.tfvars.example
docs/
  TODO.md              # Project goals and acceptance criteria
  diagrams.html        # Interactive architecture & component diagrams
deploy.sh              # S3 sync + CloudFront invalidation
docker_build.sh        # Build Angular in Docker
docker_serve.sh        # Serve dist/ via nginx locally
public/
  fonts/               # Self-hosted Public Sans + Inter (woff2, latin + latin-ext)
  robots.txt           # Disallows /admin
  sitemap.xml          # Public routes for search engines
  favicon.ico          # Bear paw favicon
```

---

## Documentation

Open `docs/diagrams.html` in a browser for interactive diagrams:
- Infrastructure architecture (AWS resources, permissions, connections)
- Angular component tree and services
- Build pipeline
- Route configuration
- User/admin flow diagrams
- TODOs

See `docs/TODO.md` for the full project roadmap.
