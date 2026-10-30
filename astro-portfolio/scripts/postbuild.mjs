/**
 * Post-build: rewrite absolute URLs in dist/*.html to relative URLs.
 *
 * Astro produces absolute paths (/_astro/foo.css, /scripts/site.js, /about/). Relative ones keep the
 * build portable (any base path, any static server, assets even over file://). Page links point at
 * the page's *directory* URL, never at index.html, so the address bar always shows a clean URL
 * (/about/, not /about/index.html).
 *
 * Rewrites:
 *   /_astro/foo.css          → {rel}/_astro/foo.css
 *   /scripts/site.js         → {rel}/scripts/site.js
 *   /about, /about/#x        → {rel}/about/, {rel}/about/#x   (every dist/<route>/index.html)
 *   /, /#x                   → {rel}/, {rel}/#x
 *   /404.html                → {rel}/404.html
 *   url(/art/x.png)          → url({rel}/art/x.png)       (inline <style>, e.g. the wall tile)
 * where {rel} is the path from the HTML file's directory back to dist/ ("." or "..").
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

// Routes that map to dist/<route>/index.html (Astro's default `directory` format), found on disk so
// a new page never needs registering here.
const DIR_ROUTES = readdirSync(root).filter((d) => {
    try {
        return statSync(join(root, d, 'index.html')).isFile();
    } catch {
        return false;
    }
});

let changed = 0;
for (const file of walk(root)) {
    if (!file.endsWith('.html')) continue;
    // GitHub Pages serves 404.html at whatever path was asked for (/no/such/page), so relative URLs
    // there would resolve under that path. It keeps Astro's root-absolute ones.
    if (file === join(root, '404.html')) continue;
    const fileDir = dirname(file);
    let rel = relative(fileDir, root).split(sep).join('/');
    if (!rel) rel = '.';

    const before = readFileSync(file, 'utf-8');
    let html = before;

    // 1. Directory routes → their directory URL, keeping any #hash (before the catch-all below)
    for (const r of DIR_ROUTES) {
        html = html.replace(new RegExp(`href="/${r}/?(#[^"]*)?"`, 'g'), `href="${rel}/${r}/$1"`);
    }

    // 2. Root link "/" (or "/#x") → the site root
    html = html.replace(/href="\/(#[^"]*)?"/g, `href="${rel}/$1"`);

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

    // 6. srcset lists (responsive images): every URL in the list, in attributes and in island props.
    html = html.replace(
        /(srcset|srcSet)="([^"]*)"/g,
        (_m, attr, list) => `${attr}="${list.replace(/(^|,\s*)\/(?!\/)/g, `$1${rel}/`)}"`,
    );
    html = html.replace(/(,\s*)(\/(?!\/)_astro\/)/g, `$1${rel}$2`);

    // 7. url(/...) in inline styles (the wall tile, AnsiWall.astro).
    html = html.replace(/url\((['"]?)\/(?!\/)/g, `url($1${rel}/`);

    if (html !== before) {
        writeFileSync(file, html);
        changed++;
    }
}

console.log(`Postbuild: relativized paths in ${changed} HTML file(s).`);
