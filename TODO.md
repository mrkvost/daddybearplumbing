# Daddy Bear Plumbing — Project TODO

Goals are listed in recommended execution order.
Work through them one at a time. Each goal has acceptance criteria that define "done."

---

## GOAL 0 — Links page
e.g.:
https://www.chicago.gov/city/en/sites/guide-to-building-permits/home/instructions/EPP/PLUMB.html


## GOAL 1 — Rewrite site as an Angular application

**Why:** The current `index.html` is a single static file. Angular gives us reusable
components, a proper build pipeline, and a foundation for adding pages later.

**Decisions:**
- Angular 18+ with **standalone components** (no NgModules — simpler, modern default)
- Tailwind CSS integrated via **npm + PostCSS** (not CDN — builds only the CSS you use)
- `FooterComponent` and `NavbarComponent` live in the root `AppComponent` layout so they
  appear on every page automatically — subpage components only render their own content
- Subpage routing uses path-based URLs: `/gallery`, `/reviews`, etc.
- Every file gets concise comments explaining Angular concepts for a newcomer
- When done, move `index.html` to `old/index.html` (preserve, do not delete)

**Sub-tasks:**
- [ ] Scaffold new Angular project with Angular CLI (`ng new`)
- [ ] Install and configure Tailwind CSS via PostCSS
- [ ] Replicate `tailwind.config` (colors, fonts, borderRadius) from current `index.html`
- [ ] Create `NavbarComponent` — sticky header with hamburger menu toggle
- [ ] Create `HeroComponent` — headline, subtext, badge
- [ ] Create `TrustStatsComponent` — hours bar + years experience
- [ ] Create `ServicesGridComponent` — 4-card services grid
- [ ] Create `ServiceAreaComponent` — embedded Google Maps `<iframe>` pointing to business
      location (replace the static image); keep the location list alongside the map
- [ ] Create `FooterComponent` — copyright footer
- [ ] Wire `NavbarComponent` and `FooterComponent` into `AppComponent` layout shell so
      they render on every page without being repeated in each subpage component
- [ ] Set up Angular Router with `/` home route + stub routes for `/gallery` and `/reviews`
      (each stub renders a placeholder "coming soon" component)
- [ ] Verify dark mode class strategy works with Tailwind
- [ ] Move original `index.html` to `old/index.html` once Angular output replaces it

**Acceptance criteria:**
- `ng build` produces a `dist/` folder with no errors
- Opening the built output in a browser looks identical to the current site
- Navigating to `/gallery` and `/reviews` shows a placeholder page with nav + footer intact
- Mobile menu toggle works without errors in browser console
- Google Maps iframe loads and shows the correct location

---

## GOAL 2 — Terraform: AWS infrastructure ✅ COMPLETE

**Status:** Infrastructure is live and managed by Terraform.

**What was built:**
- S3 bucket (private, OAC access from CloudFront)
- CloudFront distribution (HTTPS, SPA error pages, CachingOptimized)
- ACM certificate (wildcard, DNS validation)
- Route53 hosted zone + A/AAAA alias records
- Cognito User Pool + Identity Pool (admin authentication)
- Lambda function (auto-regenerates gallery.json on S3 upload/delete)
- S3 CORS configuration (browser-based uploads)
- Remote state in S3 + DynamoDB lock table
- All resources parameterized via `terraform.tfvars`

**Files:**
```
infrastructure/
  bootstrap.sh           # Creates state bucket + lock table (one-time)
  main.tf                # All AWS resource definitions
  variables.tf           # Input variables (domain, bucket_name, project, region)
  outputs.tf             # Cognito IDs, CloudFront domain, S3 bucket
  import.tf              # Import blocks for pre-existing resources
  terraform.tfvars       # Actual values (gitignored)
  terraform.tfvars.example
  lambda/
    gallery_manifest.py  # Regenerates gallery.json on S3 events
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
- [ ] Create `robots.txt` in Angular's `public/` folder (allow all crawlers, point to sitemap)
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

**How to use Lighthouse for SEO auditing:**

Lighthouse is built into Chrome DevTools and also available as a CLI tool. Use it to
measure SEO, performance, accessibility, and best practices in one report.

*In Chrome (no install needed):*
1. Open the deployed site in Chrome
2. Open DevTools (`F12` or right-click → Inspect)
3. Click the **Lighthouse** tab
4. Select categories: **Performance**, **Accessibility**, **Best Practices**, **SEO**
5. Set device to **Mobile** (Google indexes mobile-first)
6. Click **Analyze page load** — wait ~30 seconds
7. Review each failing audit; each one has a linked explanation and fix

*As a CLI (useful for scripting and CI later):*
```bash
npm install -g lighthouse
lighthouse https://kvaking.com --output html --output-path ./lighthouse-report.html --view
```

*What to target for this site:*
- SEO score: **≥ 90** (failing audits directly hurt rankings)
- Performance score: **≥ 80** on mobile (Core Web Vitals affect local pack ranking)
- Key SEO audits to pass: document has a `<title>`, meta description present, links have
  descriptive text, image `alt` attributes present, `robots.txt` valid, structured data valid
- Use **PageSpeed Insights** (pagespeed.web.dev) as a second check — it uses real-world
  Chrome data on top of Lighthouse and shows your CrUX field data once traffic builds

**Acceptance criteria:**
- Google's Rich Results Test shows a valid `LocalBusiness` schema with no errors
- Lighthouse SEO score ≥ 90 on mobile
- Site is indexed in Google Search Console with no coverage errors
- Mobile usability report in Search Console shows no issues

---

## GOAL 4 — Update README.md

**Why:** A new contributor (or future you) should be able to clone the repo and be
productive without asking questions.

**Sub-tasks:**
- [ ] Prerequisites section (Node version, Angular CLI version, AWS CLI, Terraform version)
- [ ] Local development: `git clone` → `npm install` → `ng serve`
- [ ] Build: `ng build` — what the output is, where it goes
- [ ] Infrastructure first-time setup: run `bootstrap.sh`, copy `config.yml.example` to
      `config.yml`, fill values, `terraform init`, import hosted zone, `terraform apply`
- [ ] Deploy: how to run `deploy.sh`, required AWS credentials/profile, what it does step by step
- [ ] SEO: link to GOAL 3 external checklist; how to run Lighthouse locally
- [ ] Project structure overview (which folder does what, what each Terraform file is for)

**Acceptance criteria:**
- A developer with no prior context can set up and run the project locally using only the README
- Every command mentioned in the README works as documented

---

## GOAL 5 — Tests

**Why:** Catch regressions when components are changed. Keep tests minimal and focused.

**Decisions:**
- **Unit tests**: Jasmine + Angular TestBed (built into Angular CLI, no extra setup)
- **End-to-end tests**: Playwright (modern, fast, free, works headless in CI)

**Sub-tasks (unit tests — one spec file per component):**
- [ ] `NavbarComponent` — renders logo text, call button has correct phone number,
      hamburger click toggles menu visibility
- [ ] `HeroComponent` — renders headline and subtext
- [ ] `TrustStatsComponent` — renders correct hours strings and years of experience
- [ ] `ServicesGridComponent` — renders all 4 service card titles
- [ ] `ServiceAreaComponent` — Google Maps `<iframe>` is present in the DOM;
      renders all 6 location names
- [ ] `FooterComponent` — renders copyright text

**Sub-tasks (E2E tests with Playwright):**
- [ ] Install and configure Playwright (`npm init playwright`)
- [ ] Test: homepage loads and `<h1>` contains expected text
- [ ] Test: mobile menu is hidden by default, visible after hamburger click
- [ ] Test: call button `href` is a `tel:` link with the correct number
- [ ] Test: all 4 service cards are visible on desktop viewport
- [ ] Test: navigating to `/gallery` shows the placeholder page with nav and footer present
- [ ] Test: navigating to `/reviews` shows the placeholder page with nav and footer present

**Acceptance criteria:**
- `ng test --watch=false` exits with 0 failures
- `npx playwright test` exits with 0 failures against `ng serve` or the built `dist/`

---

## Notes

- Goals 1 and 2 are **independent** — they can be started in either order.
- Goals 3 and 5 depend on Goal 1 being complete (they operate on Angular components).
- Goal 4 is written last (documents what was actually built).
- `config.yml` is gitignored — never commit real AWS account details or domain names.
- The `kvaking.com` placeholder must be replaced in `config.yml` before Goal 2 runs against production.
