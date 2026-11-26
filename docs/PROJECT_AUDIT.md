# UDAAN 2026 — Project Engineering Audit

**Repository:** `C:\Users\sujal\udaan-site`  
**Target:** Bhagalpur College of Engineering (BCE), Sabour — UDAAN 2026 (27–30 November 2026)  
**Hosting Target:** Cloudflare Pages Free  
**Audit Date:** 2026-11-26  

---

## 1. Audit Scope & Invoked Capabilities

This audit inspected the static HTML pages, CSS/JS assets, React/TypeScript islands, build configuration, Cloudflare Pages Function, Supabase SQL migration, Git history, dependencies, security posture, SEO/accessibility metadata, and 5-viewport Playwright browser behavior.

**Skills consulted:**
- `/ponytail-audit`
- `/ponytail-review`
- `/ponytail-debt`
- `/andrej-karpathy-skills` / `/karpathy-guidelines`
- `/browser-qa`
- `/api-security-testing`
- `/error-handling`

**Note on verification scope:** All build, TypeScript, static security, and Playwright browser checks were executed locally against `http://localhost:5500`. Live Supabase persistence (`POST /api/registrations` against a real Supabase project) and Cloudflare Pages deployment were **not** executed because `.dev.vars` credentials, `wrangler`, and a live Supabase project are not yet configured.

---

## 2. Ponytail Audit & Review Findings

### 2.1 `/ponytail-debt` Ledger
- `components/ui/coverflow-carousel.tsx:142` — `// ponytail: exponential ease-out, not a spring. Swap in a spring only if the settle needs overshoot.` (`1` marker, has explicit upgrade trigger).

### 2.2 `/ponytail-audit` & `/ponytail-review` Findings
1. **`native:` / `delete:` Unlisted `framer-motion` import vs installed `motion` (`components/ui/multistep-form.tsx:4`)**
   - `multistep-form.tsx` imported from `"framer-motion"` (unlisted in `package.json`, only present via local `node_modules` hoisting), while `package.json` already declared `"motion": "^14.14.0"` (used by `doodle-crew-footer.tsx`).
   - **Fixed:** Switched `components/ui/multistep-form.tsx` to `import { motion, AnimatePresence } from "motion/react"` and rebuilt `Scripts/registration-form.bundle.js`.
2. **`delete:` Unused dependencies in `package.json` (`clsx`, `tailwind-merge`)**
   - `lib/utils.ts` uses a zero-dependency `cn(...)` helper and is preserved as-is; `0` files in `src/`, `components/`, `lib/`, or `functions/` imported `clsx` or `tailwind-merge`.
   - **Fixed:** Removed `clsx` and `tailwind-merge` from `package.json`.
3. **`shrink:` Trailing whitespace in `index.html:2`**
   - **Fixed:** Removed trailing space on `<html lang="en">` so `git diff --check` passes cleanly.
4. **Informational (deferred — do not alter without separate approval):**
   - Legacy commented-out blocks in `Scripts/contacts.js`, `Scripts/gallery.js`, `Scripts/index.js`, and `index.html:133` (`<!-- <div class="navBut" id="sponsors">SPONSORS</div> -->`).
   - `Templates/sponsors.html` is currently marked deleted (`D Templates/sponsors.html`) in the working tree; no active page links to it.

---

## 3. Ranked Findings

| Severity | Finding | Location | Status |
|---|---|---|---|
| **High** | Live Supabase persistence not yet verified locally via `wrangler` (table created with `events jsonb NOT NULL`; migration updated to match) | `functions/api/registrations.ts`, `supabase/migrations/001_create_event_registrations.sql` | **Migration aligned; live Wrangler test pending `.dev.vars`** |
| **High** | `DoodleCrewFooter` was only mounted on `index.html`, missing from the 5 inner `Templates/*.html` pages | `src/footer-entry.tsx`, `Templates/*.html` | **Fixed** (mounted on all 6 pages with dynamic `../` / `./` path prefix) |
| **High** | Intro loader video replayed on inner pages (`cookie.trim()` bug + `readyState === 4` trap + missing `path=/`) | `Scripts/loader.js`, `Scripts/loaderIndex.js` | **Fixed** (`sessionStorage` + `prefers-reduced-motion` + video error/timeout fallback) |
| **Medium** | Developers page `320px` mobile navbar clipped `DEVELOPERS` and the right edge of the orange `(↗)` CTA circle | `src/developers.css`, `Scripts/developers-hero.bundle.css` | **Fixed** (verified across 10 viewports `320×568`–`1440×900`) |
| **High** | `framer-motion` was imported in `multistep-form.tsx` without being listed in `package.json` | `components/ui/multistep-form.tsx:4` | **Fixed** (switched to `motion/react`) |
| **Medium** | Mobile horizontal overflow (`+2px`) on `index.html` at `390×844` and `360×800` due to `transform: translate(0.6rem, 0.8rem)` on `.right` | `Styles/responsive.css` | **Fixed** (changed to `translateY(0.8rem)`) |
| **Medium** | Production-domain SEO items remain `[TODO]` until final domain is confirmed (`canonical`, `og:url`, absolute `og:image`, `sitemap.xml`) | All 6 HTML pages, `robots.txt` | **Pending domain** |
| **Low** | Unused `clsx` and `tailwind-merge` entries in `package.json` | `package.json` | **Fixed** (removed) |
| **Low** | Trailing whitespace on `index.html:2` | `index.html:2` | **Fixed** |
| **Info** | `README.md` previously referenced upstream `BOSM-main` / `dvm-bitspilani` | `README.md` | **Fixed** (rewritten for UDAAN 2026) |

---

## 4. Security Observations

- **Secrets scan:** Clean. No `SUPABASE_SECRET_KEY`, `service_role`, or `sb_secret_` tokens appear in any HTML, React, or generated `Scripts/*.bundle.*` file. `.gitignore` protects `.dev.vars`, `.env`, `.env.*`, `.wrangler/`, and `.playwright-mcp/`.
- **Database RLS:** `supabase/migrations/001_create_event_registrations.sql` enables RLS on `public.event_registrations` with **no** `anon` or `authenticated` `SELECT`, `INSERT`, `UPDATE`, or `DELETE` policies. Only the server-side Cloudflare Pages Function (`POST /api/registrations`) writes via `SUPABASE_SECRET_KEY`.
- **API hardening:** `functions/api/registrations.ts` enforces `application/json`, `16 KB` max payload, UUID `submission_id` idempotency, honeypot (`website`), authoritative event/department/year allowlists, phone normalization (`+91` and international), team-name validation for team entries, and required consent.
- **Dependencies:** `npm audit --omit=dev` reported **0 vulnerabilities**.
- **DOM XSS check:** No `eval()`, `document.write()`, or `dangerouslySetInnerHTML`. `Scripts/contacts.js` and `Scripts/index.js` use `innerHTML` only with static strings.

---

## 5. Performance, SEO & Accessibility Observations

- **Bundle sizes (`Scripts/*.bundle.*`):**
  - `gallery-carousel.bundle.js` (`297.4kb`) / `.css` (`1.9kb`)
  - `events-carousel.bundle.js` (`228.5kb`) / `.css` (`15.2kb`)
  - `footer.bundle.js` (`263.3kb`)
  - `developers-hero.bundle.js` (`399.3kb`) / `.css` (`18.1kb`)
  - `registration-form.bundle.js` (`533.6kb`) / `.css` (`29.1kb`)
- **Playwright 6-page × 5-viewport check (`1440×900`, `1280×800`, `768×1024`, `390×844`, `360×800`):**
  - Broken images: `0` across all 6 pages.
  - Console errors: `0` across all 6 pages.
  - Horizontal overflow: `0` across all 6 pages and all 5 viewports after fixing `Styles/responsive.css`.
  - CLS (`PerformanceObserver` buffered `layout-shift` per page load, desktop `1440×900`, Playwright measurement — not Lighthouse): `0.0001` on `index.html`, `0.0038` on `Templates/developers.html`, `0` on `director.html`, `registration.html`, `gallery.html`, `ignition.html`.
- **SEO & Accessibility:** Unique `<title>`, `lang="en"`, meta descriptions, OG/Twitter tags, and `alt` attributes are present across all 6 pages; canonical/absolute OG URLs and `sitemap.xml` await the confirmed production domain.

---

## 6. Dependency Audit (`package.json`)

- **Runtime (`dependencies`):** `@radix-ui/react-checkbox`, `@radix-ui/react-label`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react`, `motion`, `ogl`, `react`, `react-dom`, `sonner` — all actively used.
- **Dev (`devDependencies`):** `@tailwindcss/cli`, `@types/react`, `@types/react-dom`, `esbuild`, `tailwindcss`, `typescript` — all used for bundling/type-checking.

---

## 7. Build & Test Results

- `npm run build:gallery` — **PASSED**
- `npm run build:events` — **PASSED**
- `npm run build:footer` — **PASSED**
- `npm run build:developers` — **PASSED**
- `npm run build:registration` — **PASSED**
- `npx tsc --noEmit` — **PASSED** (exit code `0`)
- `git diff --check` — **PASSED** (no whitespace errors)
- `scratch/test_api_registrations.mjs` (mocked Supabase `fetch`) — **ALL_API_TESTS_PASSED**
- Live Supabase & Wrangler tests — **NOT RUN** (pending `.dev.vars` + `wrangler` + live Supabase migration)
