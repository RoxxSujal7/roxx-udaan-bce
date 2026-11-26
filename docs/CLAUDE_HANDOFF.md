# UDAAN 2026 — Claude Code Handoff

## A. Project Identity

- **Event:** UDAAN 2026 — Annual Sports & Cultural Fest of Bhagalpur College of Engineering (BCE), Sabour, Bhagalpur, Bihar – 813210
- **Event Dates:** 27–30 November 2026
- **Architecture:** Multi-page static HTML/CSS/JS website with isolated React 19 + Tailwind CSS v4 islands bundled via `esbuild` and `@tailwindcss/cli`, plus a Cloudflare Pages Function (`POST /api/registrations`) targeting Supabase PostgreSQL.
- **Target Hosting:** Cloudflare Pages Free (serving from repository root `.`).

---

## B. Repository Architecture

```text
udaan-site/
├── index.html                          # Homepage (About, CoverflowCarousel Events, DoodleCrewFooter)
├── Templates/
│   ├── director.html                   # Principal's Message (Prof. Bimlesh Kumar)
│   ├── registration.html               # 6-step UDAAN 2026 + IGNITION registration form
│   ├── gallery.html                    # FlexCarousel with 35 UDAAN photos
│   ├── developers.html                 # Elias Author Hero page
│   └── ignition.html                   # IGNITION 2026 Esports (COD Mobile, Valorant, Clash Royale)
├── components/ui/
│   ├── coverflow-carousel.tsx          # Homepage Events 3D CoverflowCarousel
│   ├── doodle-crew-footer.tsx          # Interactive sports-doodle footer
│   ├── elias-author-hero.tsx           # Developers page hero
│   ├── multistep-form.tsx              # 6-step UDAAN registration form
│   └── button.tsx, input.tsx, label.tsx, card.tsx, radio-group.tsx, checkbox.tsx, select.tsx, textarea.tsx
├── src/
│   ├── events-entry.tsx, events-coverflow.css
│   ├── footer-entry.tsx
│   ├── gallery-entry.jsx, components/FlexCarousel.jsx, components/FlexCarousel.css
│   ├── developers-entry.tsx, developers.css
│   └── registration-entry.tsx, registration-form.css
├── lib/utils.ts                        # Shared zero-dependency cn() helper (preserve as-is)
├── functions/api/registrations.ts      # Cloudflare Pages Function: POST /api/registrations
├── supabase/migrations/
│   └── 001_create_event_registrations.sql
├── Scripts/                            # Legacy JS + generated *.bundle.js / *.bundle.css
├── Styles/                             # Legacy CSS + loader.css
├── Assets/                             # Logos, Principal photo, gallery/ (35 photos), ignition/
├── _headers                            # Cloudflare Pages security & cache headers
├── robots.txt                          # Crawler directives (sitemap URL pending domain)
├── .dev.vars.example                   # Placeholder env var names for local Wrangler dev
├── .gitignore                          # Ignores .dev.vars, .env*, node_modules/, .wrangler/
├── package.json
└── tsconfig.json
```

---

## C. Completed Work (Verified in Repository)

- **Homepage & About Us:** UDAAN 2026 branding, BCE & DSSTE institutional logos (`Assets/bce-logo.png`, `Assets/dsste-logo.png`), Principal's message preview (`Assets/principal-bimlesh-kumar.jpg`).
- **Events CoverflowCarousel:** 12 UDAAN events rendered in `components/ui/coverflow-carousel.tsx` and bundled to `Scripts/events-carousel.bundle.*`.
- **Interactive Sports-Doodle Footer:** `components/ui/doodle-crew-footer.tsx` with `Assets/Logo.png` crest, `UDAAN 2026` mouse-responsive wordmark, animated sports doodles, and high-contrast `Register Now` button.
- **Gallery FlexCarousel:** `src/components/FlexCarousel.jsx` with 35 supplied photos in `Assets/gallery/`.
- **Developers Elias Hero:** `components/ui/elias-author-hero.tsx` with `Assets/dev-portrait.png`, personal social links, and `Original design by DVM, BITS Pilani.` attribution on `Templates/developers.html`.
- **6-Step Registration Form:** `components/ui/multistep-form.tsx` + 8 shadcn primitives, supporting `+91` & international phone validation, conditional team fields, UDAAN + IGNITION event selection, review & consent, and `POST /api/registrations` submission.
- **Cloudflare Pages Function & Supabase Migration:** `functions/api/registrations.ts` and `supabase/migrations/001_create_event_registrations.sql` (tested locally with mocked `fetch`, **not yet verified against live Supabase**).
- **Phase 4F & 4G:** Performance bundle splits/deferrals and technical SEO metadata (`<title>`, `lang="en"`, OG/Twitter, JSON-LD, `alt` text, `_headers`, `robots.txt`).

---

## D. Outstanding Work

1. **Supabase project setup** (create/select free-tier dev/test project).
2. **Execute database migration** (`supabase/migrations/001_create_event_registrations.sql`) in Supabase SQL Editor.
3. **Configure `.dev.vars` locally** with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (never commit).
4. **Install `wrangler`** (`npm install -D wrangler`) and run `npx wrangler pages dev .`.
5. **Verify real database insertion** & `submission_id` duplicate idempotency via `POST /api/registrations`.
6. **Configure Cloudflare Pages production secrets** (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`).
7. **Cloudflare Pages deployment verification** (after explicit user approval).
8. **Confirm final production domain**, then complete:
   - Canonical URLs (`<link rel="canonical">`)
   - `og:url` & absolute `og:image`
   - `sitemap.xml` & `robots.txt` `Sitemap:` line
   - Review `_headers` caching/security rules for production.
9. **Review Ponytail debt & cleanup:**
   - `components/ui/coverflow-carousel.tsx:142` (`ponytail:` ease-out comment).
   - `Templates/sponsors.html` deletion was confirmed intentional (`index.html` sponsors nav item commented out; no active links).

---

## E. Technical Decisions

- **Static HTML + Isolated React:** Existing HTML pages and `.loader`/`.ham-grid` scripts are preserved; React mounts only into dedicated containers (`#events-carousel-root`, `#footer-root`, `#gallery-root`, `#elias-root`, `#registration-form-root`).
- **Tailwind v4 without Preflight:** CSS entrypoints import `tailwindcss/theme.css` and `tailwindcss/utilities.css` (skipping Preflight) so legacy `Styles/*.css` layouts are not broken.
- **Shared `lib/utils.ts`:** Kept zero-dependency `cn(...)` helper; `clsx` and `tailwind-merge` were removed as unused.
- **Animation library:** Standardized on `motion` (`motion/react`) across `doodle-crew-footer.tsx`, `FlexCarousel`, and `multistep-form.tsx`.
- **Supabase Security:** RLS enabled with zero public policies; all writes go through `functions/api/registrations.ts` using server-side `SUPABASE_SECRET_KEY`.

---

## F. Commands & Verification

```bash
# Build all React/Tailwind bundles
npm run build:gallery
npm run build:events
npm run build:footer
npm run build:developers
npm run build:registration

# TypeScript & Git hygiene
npx tsc --noEmit
git diff --check

# Local Cloudflare Pages dev (requires wrangler + .dev.vars)
npx wrangler pages dev .
```

---

## G. Next Execution Priorities

1. Confirm GitHub target repo (`RoxxSujal7`) and Git author/email, then resolve the single-author vs preserved-history release decision.
2. Complete Gate 3: apply Supabase SQL migration, configure `.dev.vars`, install `wrangler`, and verify real database persistence.
3. Fix `index.html` mobile horizontal overflow (`390×844`, `360×800`) and reduce CLS on `index.html` and `Templates/developers.html`.
4. Add production domain canonicals, `og:url`, absolute `og:image`, and `sitemap.xml`, then deploy to Cloudflare Pages when approved.

---

## H. Instructions to Claude

- Read this handoff and `docs/PROJECT_AUDIT.md` before editing.
- Preserve all completed integrations (CoverflowCarousel, FlexCarousel, Elias Hero, DoodleCrewFooter, 6-step Registration Form, Principal/BCE/DSSTE branding).
- Do not redesign or rewrite working components.
- Never assume live Supabase persistence is complete until a real database write is verified in Gate 3.
- Never expose `.dev.vars`, `SUPABASE_SECRET_KEY`, or personal registration data in code, logs, or commits.
- Respect approval gates before production deployment or destructive Git actions.
