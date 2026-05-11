# Daddy Bear Plumbing — Project TODO

Goals are listed in recommended execution order.
Work through them one at a time. Each goal has acceptance criteria that define "done."

---

## GOAL 1 — Angular Application ✅ COMPLETE

**What was built:**
- Angular 21 SPA with standalone components (no NgModules)
- Tailwind CSS v3 via PostCSS with "Architectural Minimalist" design system
- Design: grayscale palette, burnt orange accent (#b02f00), 0px border-radius, Public Sans + Inter fonts (self-hosted)
- Components: Navbar, Hero, TrustStats (operational hours), ServicesGrid, ServiceArea (Google Maps), Footer
- Pages: Home (composition), Gallery (S3 images + tags + lightbox), Reviews (star ratings), Contact (form + Turnstile + SES), About Us, Residential Services, Commercial Services, FAQ, Terms, Privacy, Cookies, Admin (gallery + reviews + site images + service cards), Login (Cognito auth)
- Services: AuthService (Cognito), UploadService (S3 SigV4), GalleryService, ReviewsService
- Auth guard on /admin route, noindex meta tags on admin pages, robots.txt disallows /admin
- Phone number + address centralized in environment config
- All routes lazy-loaded, scroll-to-top on navigation

---

## GOAL 2 — Terraform Infrastructure ✅ COMPLETE

**What was built:**
- 3 S3 buckets (site, gallery, reviews) — all private, CloudFront OAC only
- CloudFront distribution with 3 origins + path behaviors:
  - `/*` → site bucket (CachingOptimized)
  - `/gallery-images/*.json` → gallery bucket (CachingDisabled) — gallery.json + meta.json
  - `/reviews-data/reviews.json` → reviews bucket (CachingDisabled)
  - `/gallery-images/*` → gallery bucket (CachingOptimized)
  - `/reviews-data/*` → reviews bucket (CachingOptimized)
- ACM wildcard certificate (DNS validation, us-east-1)
- Route53 hosted zone + A/AAAA alias records
- Cognito User Pool (no self-signup) + Identity Pool (temp S3 credentials)
- IAM role scoped to gallery-images/* and reviews-data/* prefixes
- S3 CORS for browser-based uploads from the domain
- SES domain identity + DKIM for sending contact form emails
- Lambda function + function URL for contact form (reserved concurrency 10)
- WAF auto-managed by CloudFront security bundle (not in Terraform)
- Remote state in S3 + DynamoDB lock table
- All resources parameterized via terraform.tfvars
- AWS managed cache policies only (compatible with free CloudFront plan)

**Files:**
```
infrastructure/
  bootstrap.sh             # Creates state bucket + lock table (one-time)
  main.tf                  # All AWS resource definitions
  variables.tf             # Input variables (domain, bucket_name, project, region)
  outputs.tf               # Cognito IDs, CloudFront domain, bucket names
  import.tf                # Import blocks for pre-existing resources
  terraform.tfvars         # Actual values (gitignored)
  terraform.tfvars.example # Template for new deployments
```

---

## GOAL 3 — Search Engine Optimization

**Why:** A plumbing company lives or dies on local search. Most of this is code-level work
with some external steps that cannot be automated.

**Decisions:**
- Priority: **local SEO** (rank for "[service] + suburb" queries)

**Sub-tasks (in-code):**
- [ ] Add `LocalBusiness` JSON-LD structured data schema (name, address, phone, hours,
      service area, geo coordinates) to Angular's `index.html` or via a service
- [x] Set `<title>` and `<meta name="description">` per page via route data + CanonicalService
- [x] Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`) for link sharing
      — managed by CanonicalService; OG image uploadable from Admin → SEO tab
- [x] Add OG placeholder image (`public/og-placeholder.jpg`, 1200×630, rasterized from `meta/og-placeholder.svg`)
- [x] Ensure heading hierarchy is correct: one `<h1>` per page, logical `<h2>`/`<h3>` order
      — audited; pages already had a single `<h1>` and clean h2/h3 nesting. Fixed the only
      level-skips: footer columns and ServiceArea card headings were `<h4>` jumping past `<h3>`,
      now `<h3>` to match their position right after page-level `<h2>` content.
- [x] Add descriptive `alt` text to all images — audited; every public `<img>` has descriptive alt
      (Hero, footer logo + IDPH, gallery thumbnails/lightbox/album covers). All admin images also
      have alt for a11y. See Future Work for an optional polish item on the service-card modal alts.
- [x] Create `robots.txt` in Angular's `public/` folder (disallows /admin)
- [x] Create `sitemap.xml` listing all public routes; robots.txt points to it
- [x] Add `<link rel="canonical">` per page (CanonicalService, auto on navigation, skips /admin)
- [x] Build-time data injection — first wave of the SSR work.
      `scripts/generate-seo.js` fetches `meta.json` + `locations.json` from S3 on every build,
      writes `src/environments/site-data.ts` (hero/about/OG image refs + locations), and
      substitutes the `og:image`/`twitter:image` URLs in `src/index.html` so non-JS crawlers
      (Facebook, LinkedIn, X) see the real OG image. Build aborts on S3 fetch failure.
      Public components (Hero, PageHeader, ServiceArea, Contact, CanonicalService) import
      `SITE_DATA` instead of fetching at runtime. Admin keeps live fetches for previewing
      staged uploads. Old `src/app/defaults/locations.ts` removed — single source of truth.
- [x] Angular SSG app-shell — `@angular/ssr` installed, prerender configured via
      `src/prerender-routes.txt` (only `/` and `/admin/login`). `main.server.ts` bootstraps
      with `BootstrapContext` (Angular 21 API); `app.config.server.ts` adds
      `provideServerRendering()`. `AuthService.loadTokens` / `saveTokens` / `clearTokens`
      guarded with `isPlatformBrowser`. Result: `dist/.../browser/index.html` contains
      `<app-navbar>`, `<app-hero>` (with baked-in image URL), and `<app-footer>` server-side;
      `admin/login/index.html` contains `<app-login>` + footer with no navbar. Page body for
      other routes is still client-rendered (intentional — cards are dynamic, body content
      visibility to crawlers is not a concern).
- [x] Self-host Public Sans + Inter fonts (eliminates Google Fonts round-trip for text fonts)
- [x] Verify Core Web Vitals: Google Maps iframe + gallery thumbnails are `loading="lazy"`;
      hero image is `fetchpriority="high"` + `decoding="async"` to prioritise the LCP element

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

## GOAL 5 — Tests

**Why:** Catch regressions when components are changed. Keep tests minimal and focused.

**Sub-tasks (unit tests — one spec file per component):**
- [ ] `NavbarComponent` — renders logo text, call button has correct phone number,
      hamburger click toggles menu visibility
- [ ] `HeroComponent` — renders headline and subtext
- [ ] `TrustStatsComponent` — renders correct hours strings
- [ ] `ServicesGridComponent` — renders all 4 service card titles
- [ ] `ServiceAreaComponent` — Google Maps `<iframe>` is present in the DOM;
      renders all 6 location names
- [ ] `FooterComponent` — renders copyright text
- [ ] `GalleryComponent` — loads images, tag filtering works
- [ ] `ReviewsComponent` — loads reviews, displays star ratings
- [ ] `AdminComponent` — upload queue, review form
- [ ] `LoginComponent` — form submission, error display, password change flow

**Sub-tasks (E2E tests with Playwright):**
- [ ] Install and configure Playwright (`npm init playwright`)
- [ ] Test: homepage loads and `<h1>` contains expected text
- [ ] Test: mobile menu is hidden by default, visible after hamburger click
- [ ] Test: call button `href` is a `tel:` link with +1 country code
- [ ] Test: all 4 service cards are visible on desktop viewport
- [ ] Test: navigating to `/gallery` loads images
- [ ] Test: navigating to `/reviews` shows reviews or empty state
- [ ] Test: `/admin` redirects to `/admin/login` when not authenticated

**Acceptance criteria:**
- `ng test --watch=false` exits with 0 failures
- `npx playwright test` exits with 0 failures against `ng serve` or the built `dist/`

---

## GOAL 6 — Future Work (unstructured)

- [x] Home page background image (real photo) — admin-uploadable hero image with preview
- [x] Business address on the site (service area, contact page, footer)
- [x] Footer links: FAQ, Privacy Policy, Terms & Conditions, Cookies
- [x] Menu additions: About Us, Services (Residential / Commercial), Gallery, Reviews, Contact
- [x] Content pages: About Us, Residential Services, Commercial Services, FAQ, Terms, Privacy, Cookies
- [x] Admin service cards editor (drag-and-drop reorder, add/edit/delete, load defaults)
- [x] Enhanced footer (5-column layout: brand, services, navigate, information, accreditation with license numbers)
- [ ] Admin-triggered rebuild: button in admin to trigger AWS build pipeline (CodeBuild or Lambda)
      so that hero image + locations + OG image (currently `og-placeholder.jpg` in `index.html`,
      replaced at runtime by CanonicalService — but JS-less crawlers like Facebook/LinkedIn/X
      never see that swap) are statically embedded in the HTML at build time
      (improves SEO — crawlers see real content instead of JS-fetched data)
- [ ] Admin dashboard metrics — daily-snapshot Lambda writes `metrics/dashboard.json` to the gallery
      bucket (admin-only path, no CloudFront behavior). EventBridge Scheduler at 04:00 America/Chicago.
      Renders Requests/4xx/5xx/bandwidth sparklines, Cost Explorer month-to-date + top services,
      contact-form Lambda + SES + Cognito user count. Browser cache via sessionStorage + SWR.
      Full plan in `docs/ADMIN_DASHBOARD_METRICS_PLAN.md`. ~$0.30/mo running cost.
- [x] Unify input styling across admin + contact form — canonical `.form-input` class added in
      `src/styles.css` under `@layer components`. Combines contact's calmer non-focused border
      (`outline-variant/60`) with admin's quiet focus (no ring, just `border-primary`). Applied
      across admin, contact, and login (~12 input/textarea/select instances).
      Button styling unification still open if you want one consistent primary/secondary set.
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
- [x] Admin FAQ editor (question + answer + optional bullet list, reorder, pagination)
- [x] Session persistence (tokens in sessionStorage + auto-refresh)
- [x] Google Maps: update to real business coordinates
- [ ] Google Business Profile link on map/address

---

## Notes

- Goals 1 and 2 are complete.
- Goals 3 and 5 can be done in any order (both operate on Angular components).
- `terraform.tfvars` is gitignored — never commit real AWS account details.
- For a new deployment: copy `terraform.tfvars.example`, delete `import.tf`, run `bootstrap.sh`.
- [x] Residential & commercial cards: fixed height (`h-64`), description clamped to 3 lines, click → modal showing the full text and an image (or large icon if no image)
- [x] Admin support for uploading per-card images — image upload UI in the card form (Residential + Commercial Industries), stored at `gallery-images/cards/`; old images are cleaned up on replace/remove/delete
- [x] New "Construction" section with subpages `/construction/interior` and `/construction/exterior`
      (mirrors Services pattern: cards + modal). Each subpage has its own intro paragraphs + 3 cards
      with substantive descriptions sourced from `construction.txt`. Shared component driven by route
      data. Admin "Construction" tab with both lists; cards stored in `gallery-images/construction.json`
      as `{ interior, exterior }`. Construction dropdown in navbar (Interior first, Exterior second)
      and routes in sitemap.
- [x] Albums in the gallery — `albums.json` data model + `/gallery/album/:slug` route + admin Albums tab (CRUD,
      cover-photo picker, drag-drop reorder, pagination) + per-photo album assignment in the gallery admin tab
- [x] Shrink `public/idph_logo.jpg` — resized 1773×490 (65 KB) → 300×83 (8.6 KB) and added explicit
      `width`/`height` attributes in the footer to reserve the box.
- [x] Fix Cumulative Layout Shift on initial paint — preloaded `/fonts/public-sans-latin.woff2`
      in `<head>` and switched both Public Sans `@font-face` blocks to `font-display: optional`,
      so the fallback never swaps to Public Sans mid-render. This eliminates the headline reflow
      that affected the brand title and the call button. IDPH logo `width`/`height` covered above.

- [x] About Us picture editable in admin — mirrors the hero upload flow. New section at the top
      of the Admin "About" tab (preview with overlaid eyebrow + title, upload / cancel / remove).
      Image stored at `gallery-images/meta/about-<hash>.<ext>`, filename tracked in `meta.json`
      under the `about` key. Public `/about` page reads `meta.json` on init and renders the image
      as background of the 300px header section (`object-cover`, `opacity-60`). Falls back to
      solid black when unset.
- [x] Services cards: include smaller versions of the pictures right on the card. Top h-40 block
      shows the image (object-cover, hover scale) when present, falls back to a centered 6xl icon
      otherwise. Cards grew h-64 → h-96. Applied to /residential, /commercial industries, and both
      /construction/* pages. Modal still shows the full-size image + description as before.
