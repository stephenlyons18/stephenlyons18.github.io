/**
 * Post-build: rewrite absolute URLs in dist/*.html to relative URLs.
 *
 * Astro produces absolute paths (/_astro/foo.css, /scripts/site.js, /about)
 * which require an HTTP server with dist as docroot. By relativizing them,
 * the same dist/ also works when opened directly via file:// (e.g. double-
 * click dist/index.html), without breaking real HTTP hosting.
 *
 * Rewrites:
 *   /_astro/foo.css        → ./{rel}/_astro/foo.css
 *   /scripts/site.js       → ./{rel}/scripts/site.js
 *   /about, /about/        → ./{rel}/about/index.html
 *   /                      → ./{rel}/index.html
 *   /404.html              → ./{rel}/404.html
 * where {rel} is computed relative to the HTML file's directory.
 *
 * Leaves untouched: protocol URLs (https://...), protocol-relative (//...),
 * hashes (#...), and data: URIs.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const root = 'dist';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Routes that map to dist/<route>/index.html (Astro default `directory` format)
const DIR_ROUTES = ['about', 'projects', 'contact'];

let changed = 0;
for (const file of walk(root)) {
  if (!file.endsWith('.html')) continue;
  const fileDir = dirname(file);
  let rel = relative(fileDir, root).split(sep).join('/');
  if (!rel) rel = '.';

  const before = readFileSync(file, 'utf-8');
  let html = before;

  // 1. Directory routes → /index.html (must run before the catch-all below)
  for (const r of DIR_ROUTES) {
    html = html.replace(
      new RegExp(`(href|src)="/${r}/?"`, 'g'),
      `$1="${rel}/${r}/index.html"`,
    );
  }

  // 2. Root link "/" → /index.html
  html = html.replace(/(href|src)="\/"/g, `$1="${rel}/index.html"`);

  // 3. All other absolute internal paths (_astro/, scripts/, 404.html, etc.)
  //    Skip protocol-relative (//...) URLs.
  html = html.replace(/(href|src)="\/(?!\/)([^"]*)"/g, `$1="${rel}/$2"`);

  // 4. Astro island loader attributes (component-url, renderer-url, before-hydration-url).
  //    These are used by the <astro-island> custom element to dynamically import
  //    React/framework bundles. Without this fix the island never hydrates when
  //    the HTML is opened via file://.
  html = html.replace(
    /(component-url|renderer-url|before-hydration-url)="\/(?!\/)([^"]*)"/g,
    `$1="${rel}/$2"`,
  );

  // 5. Absolute paths embedded in the HTML-entity-encoded `props` JSON that
  //    Astro serialises onto <astro-island> elements (e.g. image src values).
  //    They appear as  &quot;/images/...&quot;  inside the attribute value.
  html = html.replace(/(&quot;)(\/(?!\/)(?:images|_astro)\/[^&"]*)/g, `$1${rel}$2`);

  if (html !== before) {
    writeFileSync(file, html);
    changed++;
  }
}

console.log(`Postbuild: relativized paths in ${changed} HTML file(s).`);
