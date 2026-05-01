/**
 * Generates sitemap.xml and robots.txt into public/ using the domain
 * from environment.ts. Run before Angular build.
 */
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../src/environments/environment.ts'), 'utf8');
const domainMatch = envFile.match(/domain:\s*'([^']+)'/);
if (!domainMatch) {
  console.error('Could not find domain in environment.ts');
  process.exit(1);
}
const domain = domainMatch[1];
const baseUrl = `https://${domain}`;
const publicDir = path.join(__dirname, '../public');

const routes = [
  '/',
  '/about',
  '/residential',
  '/commercial',
  '/construction/residential',
  '/construction/commercial',
  '/gallery',
  '/reviews',
  '/faq',
  '/contact',
  '/terms',
  '/privacy',
  '/cookies',
];

// sitemap.xml
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url><loc>${baseUrl}${r === '/' ? '' : r}</loc></url>`).join('\n')}
</urlset>
`);

// robots.txt
fs.writeFileSync(path.join(publicDir, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${baseUrl}/sitemap.xml
`);

console.log(`SEO files generated for ${domain} (${routes.length} routes)`);
