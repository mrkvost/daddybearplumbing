# SEO Rendering Strategy Research

**Date:** 2026-05-03
**Context:** Daddy Bear Plumbing — Angular 21 SPA hosted on S3 + CloudFront. Evaluating
options for making page content (especially footer NAP — Name, Address, Phone) visible
to non-JS crawlers without committing to a full server-side rendering stack.

---

## Why this matters

The site is a single-page application. Every route serves the same `index.html` shell;
real content (h1, h2, footer, service cards, etc.) is rendered client-side once the JS
bundle loads. That content is invisible to any crawler that does not execute JavaScript.

For a local plumbing business, the cost of that invisibility is:

- **Local pack ranking** — citation signals (NAP consistency across the web + on every
  page of your own site) account for roughly 7–13% of local pack ranking weight.
  Currently those NAP signals are JS-rendered, so they're partially or fully invisible
  to non-JS crawlers.
- **Bing visibility** — Bingbot has only limited JS rendering. Critically, ~92% of
  ChatGPT queries source from Bing's index, so SPA-only content has compounded AI-search
  invisibility.
- **Social previews** — Facebook, LinkedIn, X (Twitter) crawlers do not execute JS.
  OG tags and shared-link previews on SPA-only sites only work if the OG metadata is in
  the initial HTML response.
- **Google's render queue** — Googlebot does execute JS, but pages requiring JS rendering
  go into a secondary queue that can take days to weeks for low-authority sites. A new
  plumbing site is low-authority initially.

---

## Crawler landscape (2026)

| Crawler                            | Executes JS?   | Notes                                                                                                 |
| ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| Googlebot                          | Yes (deferred) | Two-wave indexing — initial HTML first, JS rendering can be days/weeks behind for low-authority sites |
| Bingbot                            | Limited        | Doesn't support all modern frameworks; complex SPAs are often under-indexed                           |
| Facebook (`facebookexternalhit`)   | **No**         | Reads only initial HTML for OG previews                                                               |
| LinkedIn (`LinkedInBot`)           | **No**         | Reads only initial HTML                                                                               |
| X / Twitter (`Twitterbot`)         | **No**         | Reads only initial HTML                                                                               |
| Yelp / Angi / HomeAdvisor / etc.   | Mostly **no**  | Citation directories typically scrape static HTML                                                     |
| ChatGPT / Perplexity / AI crawlers | Mostly **no**  | Many pull from Bing's index, compounding the issue                                                    |


---

## Approaches compared

| #   | Approach                                                 | What it is                                                                                                         | Crawler visibility (Google / Bing / Social)           | Build/deploy effort                                                | Maintenance                                                          | Hosting                                     | Risk                                                                        | Verdict for this codebase                                                             |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A   | **Pure CSR (current)**                                   | SPA, footer rendered by JS                                                                                         | ! partial / X / X                                     | None                                                               | None                                                                 | S3 + CF (current)                           | Low                                                                         | Status quo — limits local SEO + AI visibility                                         |
| B   | **Hand-write static footer in `index.html`**             | Copy footer HTML into `index.html`, remove `<app-footer>`                                                          | Y / Y / ! footer only                                 | Tiny (one file)                                                    | **Drift risk** — two places to update                                | S3 + CF                                     | Low                                                                         | Quick win but maintenance hazard                                                      |
| C   | **Build-script-generated static footer in `index.html`** | Node script reads `footer.component.html` + `environment.ts`, transforms to static HTML, injects into `index.html` | Y / Y / ! footer only                                 | ~50 LOC script + plug into existing `scripts/generate-seo.js` flow | Low — single source of truth                                         | S3 + CF                                     | Low                                                                         | **Pragmatic stepping stone** for NAP visibility                                       |
| D   | **Angular App Shell (`ng generate app-shell`)**          | Official Angular pattern — minimal static shell baked into `index.html` at build time                              | Y / Y / ! shell only                                  | Medium — CLI sets up most of it; one-time config                   | Low (Angular tooling owns it)                                        | S3 + CF                                     | Medium — needs Node at build, app-shell route conventions                   | Angular-native version of (C); slightly more ceremony                                 |
| E   | **Angular pre-rendering / SSG (`outputMode: 'static'`)** | Render every route to its own static `.html` at build time                                                         | Y / Y / Y all page content visible                    | Medium — `@angular/ssr` package, route discovery, prerender config | Medium — data-driven routes (gallery/reviews) need defaults strategy | S3 + CF (no server needed)                  | Medium — admin edits won't appear until rebuild                             | **Best SEO outcome**; pairs naturally with the planned "admin-triggered rebuild" item |
| F   | **Angular SSR (live)**                                   | Node server renders each request fresh                                                                             | Y / Y / Y                                             | High — needs Node runtime, deploy pipeline rework                  | High (server to operate)                                             | Lambda / EC2 / Vercel — **not** plain S3    | Higher (server downtime affects all users)                                  | Overkill — too much infra change for marginal gain over E                             |
| G   | **Dynamic rendering (Prerender.io / Rendertron)**        | Detect crawler UA → serve pre-rendered HTML; humans get SPA                                                        | Y / Y / Y                                             | Low (SaaS) or medium (self-host)                                   | Low (SaaS)                                                           | S3 + CF + CloudFront Function / Lambda@Edge | Low–medium — Google deprecated this as a long-term rec but still functional | Reasonable fallback if E proves problematic                                           |
| H   | **Hybrid: App Shell (D) + selective prerender (E)**      | Static shell on every route + prerendered HTML for static-content routes; CSR for gallery/reviews                  | Y / Y / Y on prerendered routes; shell-only on others | Medium-high                                                        | Medium                                                               | S3 + CF                                     | Medium                                                                      | Probably ideal long-term but biggest scope                                            |

---

## Other notes from the research

- **`display: none` is not auto-penalized**, but Google has confirmed CSS-hidden content
  is "discounted" in ranking signals. So don't try to hide a duplicate footer with
  `display:none` — bake one or the other, not both.
- **Hydration mismatches** are a real risk if hand-written static HTML disagrees with
  what Angular renders client-side. Angular has `ngSkipHydration` to opt out per
  component when needed.
- **Angular 19+ `outputMode: 'static'` is S3-compatible** — produces pure static HTML
  files, no Node runtime. Compatible with the existing CloudFront setup.

---

## Recommended path for this codebase

Given:

- Static S3 + CloudFront hosting (no Node runtime)
- Most public routes already have hardcoded fallback defaults that match production
  content (`/about`, `/residential`, `/commercial`, `/construction/*`, `/faq`, `/terms`,
  `/privacy`, `/cookies`)
- Only `/gallery`, `/reviews`, and `/admin/*` are genuinely dynamic
- The existing `scripts/generate-seo.js` shows the project is comfortable with
  build-time codegen
- "Admin-triggered AWS rebuild" is already on the future-work TODO

**Stepwise path:**

1. **First, small (~1 day):** Approach **C** — build-script-generated static footer/NAP
   block injected into `index.html`. Single source of truth via the script. Immediate
   SEO win for the most critical thing (NAP visibility on every page) without committing
   to a full pre-rendering setup. Keeps S3 hosting unchanged.

2. **Second, when ready (~2–3 days):** Approach **E** — `outputMode: 'static'`
   pre-rendering for the static-content public routes. Compatible with S3, no server
   needed. Pairs naturally with the admin-triggered rebuild TODO — when admin edits
   Residential cards, trigger rebuild → fresh prerendered HTML.

3. **Skip:** Full SSR (F) — too much infra change for the marginal gain over E. Dynamic
   rendering (G) is a reasonable fallback if pre-rendering proves problematic, but
   shouldn't be the first choice.

---

## Sources

- [Reimagining Single-Page Applications With Progressive Enhancement — Smashing Magazine](https://www.smashingmagazine.com/2015/12/reimagining-single-page-applications-progressive-enhancement/)
- [Angular App Shell — Boost Application Startup Performance (Angular University)](https://blog.angular-university.io/angular-app-shell/)
- [Build-time prerendering — Angular official docs](https://angular.dev/guide/prerendering)
- [Server-side and hybrid-rendering — Angular official docs](https://angular.dev/guide/ssr)
- [Hydration — Angular official docs](https://angular.dev/guide/hydration)
- [JavaScript Rendering and AI Crawlers: Can LLMs Read Your SPA? (2026) — Passionfruit](https://www.getpassionfruit.com/blog/javascript-rendering-and-ai-crawlers-can-llms-read-your-spa)
- [JavaScript SEO in 2026: What Google actually handles vs what still bites you](https://www.rewatikhare.com/post/javascript-seo-in-2026-what-google-actually-handles-vs-what-still-bites-you)
- [Is Bing Really Rendering & Indexing JavaScript? — Screaming Frog](https://www.screamingfrog.co.uk/blog/bing-javascript/)
- [bingbot Series: JavaScript, Dynamic Rendering, and Cloaking — Bing Webmaster Blog](https://blogs.bing.com/webmaster/october-2018/bingbot-Series-JavaScript,-Dynamic-Rendering,-and-Cloaking-Oh-My)
- [Open Graph, Facebook and client side rendering — whatabout.dev](https://whatabout.dev/open-graph-facebook-and-client-side-rendering/)
- [Hidden Content and SEO in 2026: What Google Allows vs. What Gets You Penalized — Pepper](https://www.pepper.inc/blog/hidden-content-and-its-impact-on-seo/)
- [NAP in Local SEO — Saveda](https://www.saveda.com/seo/nap-name-address-phone-number-the-foundation-of-local-seo/)
- [How to Build Local Business Citations Correctly in 2026 — Citation Building Group](https://citationbuildinggroup.com/build-local-business-citations/)
- [Local Pack Rankings: Top Factors That Actually Move the Needle — LeadsuiteNow](https://leadsuitenow.com/blog/local-pack-ranking-factors)
- [Updated: Guide for Server-Side Rendering (SSR) in Angular — ANGULARarchitects](https://www.angulararchitects.io/blog/guide-for-ssr/)
- [Local SEO for Plumbers — ALM Corp](https://almcorp.com/blog/local-seo-for-plumbers-ultimate-guide-updated-nov-2025/)
- [How to Optimize SPAs for SEO — Prerender.io](https://prerender.io/blog/how-to-optimize-single-page-applications-spas-for-crawling-and-indexing/)
- [A simple (but effective) SPA SEO checklist — MindK](https://www.mindk.com/blog/optimizing-single-page-applications/)
- [Rendering strategies — Angular official docs](https://angular.dev/guide/routing/rendering-strategies)
