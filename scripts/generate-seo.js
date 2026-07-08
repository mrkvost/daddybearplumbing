/**
 * Pre-build script. Runs before `ng build`.
 *
 * What it does:
 *  1. Writes `public/sitemap.xml` and `public/robots.txt` (SEO basics).
 *  2. Fetches the latest `meta.json` and `locations.json` from S3 (via the public
 *     CloudFront URL) so the build bakes in the current values:
 *       - Writes `src/environments/site-data.ts` (consumed by Angular components
 *         at compile time — no runtime fetch needed for these values).
 *       - Substitutes the `og:image` and `twitter:image` URLs in `src/index.html`
 *         so non-JS crawlers (Facebook, LinkedIn, X) see the real image.
 *
 * If the S3 fetch fails, the build is aborted. Run admin → upload hero / OG
 * images and locations at least once before the first build.
 */

const fs = require('fs');
const path = require('path');

// Env-aware globals lookup — if TARGET_ENV points at a per-env globals file
// (e.g. src/app/globals.daddybear.ts), read that; else fall back to the
// default globals.ts. The env-specific file is what Angular's fileReplacements
// will swap in at build time, so pre-build SEO must match.
const targetEnv = process.env.TARGET_ENV || '';
const envGlobalsPath = targetEnv
  ? path.join(__dirname, `../src/app/globals.${targetEnv}.ts`)
  : null;
const globalsPath = envGlobalsPath && fs.existsSync(envGlobalsPath)
  ? envGlobalsPath
  : path.join(__dirname, '../src/app/globals.ts');

console.log(`Reading business config from ${path.relative(path.join(__dirname, '..'), globalsPath)} (TARGET_ENV=${targetEnv || '(unset)'})`);

const globalsFile = fs.readFileSync(globalsPath, 'utf8');
const domainMatch = globalsFile.match(/domain:\s*'([^']+)'/);
if (!domainMatch) {
  console.error(`Could not find domain in ${globalsPath}`);
  process.exit(1);
}
const domain = domainMatch[1];
const baseUrl = `https://${domain}`;
const publicDir = path.join(__dirname, '../public');
const srcDir = path.join(__dirname, '../src');

const routes = [
  '/',
  '/about',
  '/residential',
  '/commercial',
  '/construction/interior',
  '/construction/exterior',
  '/gallery',
  '/reviews',
  '/faq',
  '/contact',
  '/terms',
  '/privacy',
  '/cookies',
];

// ---------- sitemap.xml + robots.txt ----------

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url><loc>${baseUrl}${r === '/' ? '' : r}</loc></url>`).join('\n')}
</urlset>
`);

fs.writeFileSync(path.join(publicDir, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${baseUrl}/sitemap.xml
`);

// ---------- fetch live data ----------

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Network error fetching ${url}: ${e.message}`);
  }
  if (!res.ok) {
    throw new Error(`Fetch ${url} returned HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Invalid JSON at ${url}: ${e.message}`);
  }
}

const META_URL = `${baseUrl}/gallery-images/meta.json`;
const LOCATIONS_URL = `${baseUrl}/gallery-images/locations.json`;

async function main() {
  console.log(`Fetching site data from ${baseUrl}...`);
  let meta, locations;
  try {
    [meta, locations] = await Promise.all([fetchJson(META_URL), fetchJson(LOCATIONS_URL)]);
  } catch (e) {
    console.error(`Build aborted: ${e.message}`);
    console.error('Ensure meta.json and locations.json exist on S3 — upload at least one hero/OG image and set locations via the admin UI before running the build.');
    process.exit(1);
  }

  if (!Array.isArray(locations) || locations.length === 0) {
    console.error('Build aborted: locations.json is empty or not an array');
    process.exit(1);
  }

  const heroImage  = meta.hero  ? `/gallery-images/meta/${meta.hero}`  : '/hero.jpg';
  const ogFilename = meta.og    ? `/gallery-images/meta/${meta.og}`    : '/og-placeholder.jpg';
  const ogImage    = `${baseUrl}${ogFilename}`;

  // ---------- write site-data.ts ----------

  const siteDataPath = path.join(srcDir, 'environments/site-data.ts');
  const siteDataBody = `// AUTO-GENERATED at build time by scripts/generate-seo.js.
// Do not edit by hand. Re-run docker_build.sh to refresh.

export interface SiteData {
  heroImage: string;
  ogImage: string;
  locations: string[];
}

export const SITE_DATA: SiteData = {
  heroImage: ${JSON.stringify(heroImage)},
  ogImage: ${JSON.stringify(ogImage)},
  locations: ${JSON.stringify(locations, null, 2).replace(/^/gm, '  ').trimStart()},
};
`;
  fs.writeFileSync(siteDataPath, siteDataBody);
  console.log(`Wrote ${siteDataPath}`);

  // ---------- substitute OG image in src/index.html ----------

  const indexPath = path.join(srcDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Idempotent: match any existing URL inside og:image / twitter:image content="...".
  const ogTagRegex = /(<meta\s+property="og:image"\s+content=")[^"]*(")/;
  const twitterTagRegex = /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/;

  if (!ogTagRegex.test(html) || !twitterTagRegex.test(html)) {
    console.error('Build aborted: could not find og:image or twitter:image meta tags in src/index.html');
    process.exit(1);
  }

  html = html.replace(ogTagRegex, `$1${ogImage}$2`);
  html = html.replace(twitterTagRegex, `$1${ogImage}$2`);
  fs.writeFileSync(indexPath, html);
  console.log(`Updated og:image / twitter:image in src/index.html → ${ogImage}`);

  console.log(`SEO files generated for ${domain} (${routes.length} routes)`);
}

main();
