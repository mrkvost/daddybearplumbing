# Daddy Bear Plumbing — Project TODO

Goals are listed in recommended execution order.
Work through them one at a time. Each goal has acceptance criteria that define "done."

---

## GOAL 0 — Links Page

- [ ] Create useful links/resources page
  e.g.: https://www.chicago.gov/city/en/sites/guide-to-building-permits/home/instructions/EPP/PLUMB.html

---

## GOAL 1 — Angular Application ✅ COMPLETE

**What was built:**
- Angular 21 SPA with standalone components (no NgModules)
- Tailwind CSS v3 via PostCSS with "Architectural Minimalist" design system
- Design: grayscale palette, burnt orange accent (#b02f00), 0px border-radius, Public Sans + Inter fonts
- Components: Navbar, Hero, TrustStats (operational hours), ServicesGrid, ServiceArea (Google Maps), Footer
- Pages: Home (composition), Gallery (S3 images + tags + lightbox), Reviews (star ratings), Contact (form + Turnstile + SES), Admin (gallery + reviews management), Login (Cognito auth)
- Services: AuthService (Cognito), UploadService (S3 SigV4), GalleryService, ReviewsService
- Auth guard on /admin route, noindex meta tags on admin pages, robots.txt disallows /admin
- Phone number + address centralized in environment config
- All routes lazy-loaded

---

## GOAL 2 — Terraform Infrastructure ✅ COMPLETE

**What was built:**
- 3 S3 buckets (site, gallery, reviews) — all private, CloudFront OAC only
- CloudFront distribution with 3 origins + path behaviors:
  - `/*` → site bucket (CachingOptimized)
  - `/gallery-images/gallery.json` → gallery bucket (CachingDisabled)
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
- [ ] Set `<title>` and `<meta name="description">` per page/component using Angular's
      `Title` and `Meta` services (each route sets its own values on load)
- [ ] Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`) for link sharing
- [ ] Ensure heading hierarchy is correct: one `<h1>` per page, logical `<h2>`/`<h3>` order
- [ ] Add descriptive `alt` text to all images
- [x] Create `robots.txt` in Angular's `public/` folder (disallows /admin)
- [ ] Create `sitemap.xml` listing all routes; update `lastmod` date in `deploy.sh` on each deploy
- [ ] Add `<link rel="canonical">` per page to prevent duplicate URL indexing
- [ ] Evaluate Angular pre-rendering (`ng build` with `prerender` option) so crawlers receive
      real HTML instead of a blank JS shell — enable if straightforward, document if deferred
- [ ] Verify Core Web Vitals: lazy-load the Google Maps iframe (`loading="lazy"`),
      self-host or defer non-critical fonts, minimize render-blocking resources

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

- [ ] Home page background image (real photo)
- [x] Business address on the site (service area, contact page, footer)
- [ ] Enhanced footer (further improvements)
    *   logo, address, phone, email, fb
    *   information (terms, privacy, cookies)
    *   about us, contact us\*, faq, tips(and links)
    *   license
- [ ] Menu additions: About Us, Contact Us, FAQ, Tips/Links, Coupons
    *   https://www.chicago.gov/city/en/sites/guide-to-building-permits/home/instructions/EPP/PLUMB.html
- [x] Contact form (Turnstile + honeypot + Lambda + SES)
- [ ] Online chat integration - more complex
- [ ] Pagination for admin gallery and reviews lists
- [ ] Session persistence (ctrl+shift+r loses login — store tokens in sessionStorage)
- [x] Google Maps: update to real business coordinates
- [ ] Google Business Profile link on map/address

---

-   footer like in https://firstchicagoplumbing.com/
-   !!!list of areas!!!

## Notes

- Goals 1 and 2 are complete.
- Goals 3 and 5 can be done in any order (both operate on Angular components).
- `terraform.tfvars` is gitignored — never commit real AWS account details.
- For a new deployment: copy `terraform.tfvars.example`, delete `import.tf`, run `bootstrap.sh`.
