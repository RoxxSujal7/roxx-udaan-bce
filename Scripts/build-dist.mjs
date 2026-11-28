import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import sharp from "sharp";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const ESM_OUT = path.join(ROOT, "Scripts", "esm");

const esbuildBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "esbuild.cmd" : "esbuild",
);
const twBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss",
);

function run(bin, args) {
  execFileSync(bin, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function copyDir(src, dest, skipFiles = new Set()) {
  ensureDir(dest);
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipFiles.has(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d, skipFiles);
    else fs.copyFileSync(s, d);
  }
}

console.log("[build] Cleaning dist/ and Scripts/esm/...");
fs.rmSync(DIST, { recursive: true, force: true });
fs.rmSync(ESM_OUT, { recursive: true, force: true });
ensureDir(DIST);
ensureDir(ESM_OUT);

// 1. Build Tailwind CSS bundles
console.log("[build] Building CSS bundles...");
const CSS_BUILDS = [
  ["src/events-coverflow.css", "Scripts/events-carousel.bundle.css"],
  ["src/developers.css", "Scripts/developers-hero.bundle.css"],
  ["src/registration-form.css", "Scripts/registration-form.bundle.css"],
  ["src/admin.css", "Scripts/admin.bundle.css"],
  ["src/archive.css", "Scripts/archive.bundle.css"],
  ["src/live-board.css", "Scripts/live-board.bundle.css"],
  ["src/live-strip.css", "Scripts/live-strip.bundle.css"],
  ["src/live-alerts.css", "Scripts/live-alerts.bundle.css"],
];
for (const [inp, out] of CSS_BUILDS) {
  run(twBin, ["-i", inp, "-o", out, "--minify"]);
}

// 2. Build public React islands with ESM code-splitting (shared React chunk)
console.log("[build] Building ESM split bundles...");
const ESM_ENTRIES = [
  "src/events-entry.tsx",
  "src/footer-entry.tsx",
  "src/gallery-entry.jsx",
  "src/developers-entry.tsx",
  "src/registration-entry.tsx",
  "src/torchbearers-entry.tsx",
  "src/archive-entry.tsx",
  "src/live-entry.tsx",
  "src/live-strip-entry.tsx",
  "src/live-alerts-entry.tsx",
];
await esbuild.build({
  entryPoints: ESM_ENTRIES,
  bundle: true,
  minify: true,
  splitting: true,
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outdir: ESM_OUT,
});

// 3. Build standalone admin bundle + Vercel API routes
console.log("[build] Building admin bundle and Vercel API...");
await esbuild.build({
  entryPoints: ["src/admin-entry.tsx"],
  bundle: true,
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "Scripts/admin.bundle.js",
});
run(process.execPath, ["Scripts/build-api.mjs"]);

// 4. Optimize Assets/ into dist/Assets/
console.log("[build] Optimizing Assets/ into dist/Assets/...");
const imgInfo = new Map();
const RASTER_RE = /\.(jpe?g|png|webp)$/i;
const SKIP_VARIANT_RE = /-(480|960|1600)\.(avif|webp)$/i;
const RESPONSIVE_WIDTHS = [480, 960, 1600];

const assetFiles = walk(path.join(ROOT, "Assets"));
async function processAsset(abs) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const outAbs = path.join(DIST, rel);
  ensureDir(path.dirname(outAbs));

  if (!RASTER_RE.test(rel) || SKIP_VARIANT_RE.test(rel) || rel.startsWith("Assets/archive/")) {
    fs.copyFileSync(abs, outAbs);
    return;
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(rel).toLowerCase();
  const baseNoExt = outAbs.slice(0, -ext.length);
  const isGallery = rel.startsWith("Assets/gallery/");
  const maxW = isGallery ? 720 : 1600;

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    fs.copyFileSync(abs, outAbs);
    return;
  }

  const origW = meta.width || 0;
  const origH = meta.height || 0;
  const targetW = origW > maxW ? maxW : origW;

  const pipeline = sharp(buf).rotate();
  if (origW > maxW) pipeline.resize({ width: maxW, withoutEnlargement: true });

  if (ext === ".png") {
    await pipeline.png({ compressionLevel: 9, palette: true, quality: 82 }).toFile(outAbs);
  } else if (ext === ".webp") {
    await pipeline.webp({ quality: isGallery ? 68 : 75 }).toFile(outAbs);
  } else {
    await pipeline.jpeg({ quality: 78, mozjpeg: true }).toFile(outAbs);
  }

  const widths = [];
  if (!isGallery) {
    for (const w of RESPONSIVE_WIDTHS) {
      if (w > maxW) continue;
      if (origW >= w) {
        widths.push(w);
        await sharp(buf)
          .rotate()
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(`${baseNoExt}-${w}.webp`);
      }
    }
  }
  if (!fs.existsSync(`${baseNoExt}.webp`)) {
    await sharp(buf)
      .rotate()
      .resize({ width: targetW || undefined, withoutEnlargement: true })
      .webp({ quality: isGallery ? 68 : 75 })
      .toFile(`${baseNoExt}.webp`);
  }

  imgInfo.set(rel, { w: origW, h: origH, widths });
}

const CONCURRENCY = 6;
for (let i = 0; i < assetFiles.length; i += CONCURRENCY) {
  await Promise.all(assetFiles.slice(i, i + CONCURRENCY).map(processAsset));
}

// 5. Copy Styles/, Scripts/, robots.txt into dist/
console.log("[build] Copying Styles/ and Scripts/ into dist/...");
copyDir(path.join(ROOT, "Styles"), path.join(DIST, "Styles"));
copyDir(
  path.join(ROOT, "Scripts"),
  path.join(DIST, "Scripts"),
  new Set(["build-api.mjs", "build-dist.mjs"]),
);
if (fs.existsSync(path.join(ROOT, "robots.txt"))) {
  fs.copyFileSync(path.join(ROOT, "robots.txt"), path.join(DIST, "robots.txt"));
}

// Build content hash map for dist/Assets, dist/Scripts, dist/Styles
const hashCache = new Map();
function getAssetHash(relPosix) {
  if (hashCache.has(relPosix)) return hashCache.get(relPosix);
  const clean = relPosix.split("?")[0].replace(/^\//, "");
  const abs = path.join(DIST, clean);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return null;
  const h = crypto
    .createHash("sha256")
    .update(fs.readFileSync(abs))
    .digest("hex")
    .slice(0, 8);
  hashCache.set(relPosix, h);
  return h;
}

function appendVersion(urlPath, baseDirRel) {
  if (!urlPath || /^(https?:|data:|mailto:|tel:|#)/i.test(urlPath)) return urlPath;
  const [noQuery, query] = urlPath.split("?");
  if (query && query.includes("v=")) return urlPath;
  const resolved = noQuery.startsWith("/")
    ? noQuery.slice(1)
    : path.posix.normalize(path.posix.join(baseDirRel, noQuery));
  const h = getAssetHash(resolved);
  if (!h) return urlPath;
  return `${noQuery}?v=${h}`;
}

// Bundle-to-ESM mapping
const BUNDLE_TO_ESM = {
  "events-carousel.bundle.js": "esm/events-entry.js",
  "footer.bundle.js": "esm/footer-entry.js",
  "gallery-carousel.bundle.js": "esm/gallery-entry.js",
  "developers-hero.bundle.js": "esm/developers-entry.js",
  "registration-form.bundle.js": "esm/registration-entry.js",
  "torchbearers.bundle.js": "esm/torchbearers-entry.js",
  "archive.bundle.js": "esm/archive-entry.js",
  "live-board.bundle.js": "esm/live-entry.js",
  "live-strip.bundle.js": "esm/live-strip-entry.js",
  "live-alerts.bundle.js": "esm/live-alerts-entry.js",
};

const LAZY_ISLANDS = {
  "esm/footer-entry.js": "udaan-footer-root",
  "esm/events-entry.js": "events-carousel-root",
};

function transformHtml(htmlPath, outHtmlPath, baseDirRel) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const isHome = baseDirRel === ".";

  // Convert public island <script defer src=".../*.bundle.js"></script> to ESM (or IntersectionObserver lazy loader)
  html = html.replace(
    /<script\s+defer\s+src="([^"]*Scripts\/([a-z0-9-]+\.bundle\.js))"\s*><\/script>/gi,
    (full, fullSrc, fileName) => {
      const esmRel = BUNDLE_TO_ESM[fileName];
      if (!esmRel) return full;
      const esmSrc = fullSrc.replace(fileName, esmRel);
      const versioned = appendVersion(esmSrc, baseDirRel);
      const targetId = LAZY_ISLANDS[esmRel];
      if (targetId) {
        return `<script>(function(){var s=0;function l(){if(s)return;s=1;var m=document.createElement("script");m.type="module";m.src=${JSON.stringify(versioned)};document.head.appendChild(m);}function init(){var el=document.getElementById(${JSON.stringify(targetId)});if(!el||!("IntersectionObserver"in window)){l();return;}var o=new IntersectionObserver(function(e){if(e.some(function(x){return x.isIntersecting;})){o.disconnect();l();}},{rootMargin:"250px"});o.observe(el);}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}})();</script>`;
      }
      return `<script type="module" src="${versioned}"></script>`;
    },
  );

  // Make Google Fonts non-render-blocking
  html = html.replace(
    /<link\s+href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"\s+rel="stylesheet"\s*\/?>/gi,
    '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'" /><noscript><link rel="stylesheet" href="$1" /></noscript>',
  );

  // Make below-the-fold CSS non-render-blocking on index.html
  if (isHome) {
    html = html.replace(
      /<link\s+(?:href="([^"]*(?:director|about|contact|events|events-carousel\.bundle)\.css)"\s+rel="stylesheet"|rel="stylesheet"\s+href="([^"]*(?:director|about|contact|events|events-carousel\.bundle)\.css)")\s*\/?>/gi,
      (full, h1, h2) => {
        const href = h1 || h2;
        return `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'" /><noscript><link rel="stylesheet" href="${href}" /></noscript>`;
      },
    );
  }

  // Enhance <img> tags with lazy loading, decoding="async", width/height, and responsive WebP srcset (no <picture> wrapper so CSS > img selectors stay intact)
  html = html.replace(/<img\b([^>]*?)src="([^"]+)"([^>]*?)>/gi, (full, pre, src, post) => {
    if (/^(https?:|data:)/i.test(src)) return full;
    const cleanSrc = src.split("?")[0];
    const resolved = cleanSrc.startsWith("/")
      ? cleanSrc.slice(1)
      : path.posix.normalize(path.posix.join(baseDirRel, cleanSrc));
    const info = imgInfo.get(decodeURIComponent(resolved));

    const ext = path.extname(cleanSrc);
    const baseSrc = cleanSrc.slice(0, -ext.length);
    const webpMain = info ? appendVersion(`${baseSrc}.webp`, baseDirRel) : appendVersion(cleanSrc, baseDirRel);

    let attrs = `${pre}src="${webpMain}"${post}`;
    const isHero =
      isHome &&
      (/id="bosm"/.test(attrs) ||
        /id="bosmr"/.test(attrs) ||
        /class="[^"]*\b(phoneBgMain|bgMain|player|light)\b/.test(attrs) ||
        /Assets\/Logo\.png/.test(cleanSrc));

    if (!isHero && !/\bloading=/.test(attrs)) {
      attrs += ' loading="lazy"';
    }
    if (isHero && !/\bfetchpriority=/.test(attrs) && /phoneBgMain|bgMain|bosm/.test(attrs)) {
      attrs += ' fetchpriority="high"';
    }
    if (!/\bdecoding=/.test(attrs)) {
      attrs += ' decoding="async"';
    }
    if (info && info.w && info.h && !/\bwidth=/.test(attrs) && !/\bheight=/.test(attrs)) {
      attrs += ` width="${info.w}" height="${info.h}"`;
    }
    if (info && info.widths.length && !/\bsrcset=/.test(attrs)) {
      const webpSet = info.widths
        .map((w) => `${appendVersion(`${baseSrc}-${w}.webp`, baseDirRel)} ${w}w`)
        .join(", ");
      attrs += ` srcset="${webpSet}" sizes="(max-width: 768px) 100vw, 50vw"`;
    }

    return `<img${attrs}>`;
  });

  // Version CSS / JS / favicon / video / poster references
  html = html.replace(
    /\b(href|src|poster)="([^"]*(?:Assets|Scripts|Styles)\/[^"]+)"/gi,
    (full, attr, val) => `${attr}="${appendVersion(val, baseDirRel)}"`,
  );

  // Preload LCP images for home (mobile hero) and torchbearers (top portrait)
  if (isHome) {
    const phoneBg = appendVersion("Assets/phoneMainBg.webp", baseDirRel);
    html = html.replace(
      "</head>",
      `  <link rel="preload" as="image" href="${phoneBg}" media="(max-width: 768px)" fetchpriority="high" />\n</head>`,
    );
  } else if (path.basename(htmlPath) === "torchbearers.html") {
    html = html.replace(
      "</head>",
      `  <link rel="preload" as="image" href="/Assets/presidents/2026-akash-deep.jpg" fetchpriority="high" />\n</head>`,
    );
  }

  ensureDir(path.dirname(outHtmlPath));
  fs.writeFileSync(outHtmlPath, html, "utf8");
}

console.log("[build] Transforming HTML into dist/...");
transformHtml(path.join(ROOT, "index.html"), path.join(DIST, "index.html"), ".");
ensureDir(path.join(DIST, "Templates"));
for (const ent of fs.readdirSync(path.join(ROOT, "Templates"))) {
  if (!ent.endsWith(".html")) continue;
  transformHtml(
    path.join(ROOT, "Templates", ent),
    path.join(DIST, "Templates", ent),
    "Templates",
  );
}

// 6. Version asset URLs inside dist/Styles/*.css
for (const cssFile of walk(path.join(DIST, "Styles"))) {
  if (!cssFile.endsWith(".css")) continue;
  let css = fs.readFileSync(cssFile, "utf8");
  css = css.replace(/url\((['"]?)([^)'"]*Assets\/[^)'"]+)\1\)/gi, (full, q, val) => {
    return `url(${q}${appendVersion(val, "Styles")}${q})`;
  });
  fs.writeFileSync(cssFile, css, "utf8");
}

// 7. Write dist/_headers with 1-year immutable caching for static assets and must-revalidate for HTML
const headersContent = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/Templates/*
  Cache-Control: public, max-age=0, must-revalidate

/Assets/*
  Cache-Control: public, max-age=31536000, immutable

/Scripts/*
  Cache-Control: public, max-age=31536000, immutable

/Styles/*
  Cache-Control: public, max-age=31536000, immutable

/Templates/admin*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/Templates/live*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-cache

/api/admin/*
  Cache-Control: no-store
`;
fs.writeFileSync(path.join(DIST, "_headers"), headersContent, "utf8");

const distBytes = walk(DIST).reduce((s, f) => s + fs.statSync(f).size, 0);
const distAssetBytes = walk(path.join(DIST, "Assets")).reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(
  `[build] Done! dist/ total: ${(distBytes / 1048576).toFixed(2)} MB (dist/Assets: ${(distAssetBytes / 1048576).toFixed(2)} MB)`,
);
