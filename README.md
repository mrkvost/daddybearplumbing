# Daddy Bear Plumbing

Website for a plumbing company serving Chicago's Western Suburbs.
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
./docker_build.sh    # Build Angular app in Docker
./deploy.sh          # Sync to S3 + invalidate CloudFront cache
```

---

## Infrastructure Setup (first time)

```bash
cd infrastructure

# 1. Create Terraform state bucket and DynamoDB lock table
./bootstrap.sh <project-name> <region>
# e.g.: ./bootstrap.sh kvaking eu-central-1

# 2. Update the backend block in main.tf with the state bucket/table names

# 3. Copy and fill in the variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (domain, bucket_name, project, region)

# 4. For a new deployment, delete import.tf (only needed to adopt existing resources)

# 5. Initialize and apply
terraform init
terraform plan
terraform apply

# 6. Note the Cognito outputs and update src/environments/environment.ts:
terraform output cognito_user_pool_id
terraform output cognito_client_id
terraform output cognito_identity_pool_id

# 7. Create admin users (no self-signup):
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username <email> \
  --temporary-password <temp-password>

# 8. Build and deploy the Angular app
cd ..
./docker_build.sh
./deploy.sh

# 9. First login at /admin/login will prompt for a new password
```

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

## Admin Area

The `/admin` route is protected by Cognito authentication.
- Only manually created users can log in (no self-signup)
- First login requires setting a new password
- Session survives page refresh (tokens in sessionStorage, auto-refreshed; cleared on tab close)
- Tabs: **Dashboard**, **Hero**, **OG**, **About**, **Residential**, **Commercial**, **Gallery**, **Reviews**, **Locations**, **FAQ**, **Settings**
- **Hero image**: select file → full grayscale preview (matches homepage look) → confirm upload. Hash-based filenames for cache busting. Falls back to default `hero.jpg` if no custom image set.
- **OG image**: same flow, used for social media link previews (1200×630 recommended)
- Both tracked via `meta.json` in the gallery bucket
- **Service cards**: edit cards shown on `/residential` and `/commercial` pages. Drag-and-drop reorder, add/edit/delete. Optional per-card image (Residential + Commercial Industries) shown in the card detail modal — uploaded files are stored under `gallery-images/cards/<hash>.<ext>` and old ones are cleaned up on replace/remove/delete. "Load Defaults" to populate from hardcoded cards for first-time editing. Card metadata stored as `services-residential.json` and `services-commercial.json` in the gallery bucket.
- **Locations**: edit suburb list shown on home + contact. Stored as `locations.json`.
- **FAQ**: edit question + answer + optional bullet list shown on `/faq`. Stored as `faq.json`.
- All list tabs share: editable position numbers (click to edit, clamps to valid range), drag-and-drop reorder, pagination (10/page, top + bottom).
- Admin pages are not indexed (noindex meta + robots.txt)

---

## Project Structure

```
src/
  app/
    components/        # Reusable UI (navbar, footer, hero, trust-stats, services-grid, service-area)
    pages/             # Route pages (home, gallery, reviews, contact, about, residential, commercial, faq, terms, privacy, cookies, admin, login)
    services/          # AuthService, UploadService, GalleryService, ReviewsService, CanonicalService
    guards/            # authGuard (protects /admin)
    app.routes.ts      # Route configuration
    app.ts / app.html  # Root layout shell
  environments/        # AWS config (Cognito IDs, bucket names, phone number)
  fonts.css            # Self-hosted @font-face (Public Sans + Inter)
  styles.css           # Tailwind directives + custom utilities
  index.html           # HTML entry point
infrastructure/
  main.tf              # All AWS resources (S3 x3, CloudFront, Route53, ACM, Cognito, SES, Lambda)
  lambda/
    contact_form.py    # Contact form handler (Turnstile + SES)
  variables.tf         # Input variables
  outputs.tf           # Terraform outputs
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
