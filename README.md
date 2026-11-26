# UDAAN 2026 — Bhagalpur College of Engineering

Official website for **UDAAN 2026**, the annual sports and cultural fest of **Bhagalpur College of Engineering (BCE), Sabour, Bhagalpur, Bihar – 813210**, scheduled for **27–30 November 2026**.

---

## Overview

This repository houses the multi-page static website for UDAAN 2026, combining the existing HTML/CSS/JS pages with isolated React 19 + Tailwind CSS v4 interactive components and a Cloudflare Pages Function backend for event registration.

It serves prospective participants, student coordinators, and campus visitors with event discovery, a 35-photo gallery, institutional messaging, esports information, and a six-step registration workflow.

---

## Pages & Features

| Page | Path | Key Features |
|---|---|---|
| **Home** | `index.html` | Landing hero, About Us with BCE & DSSTE institutional logos, Principal's preview, 3D `CoverflowCarousel` (12 events), interactive `DoodleCrewFooter` |
| **Principal's Message** | `Templates/director.html` | Official message and portrait of Prof. Bimlesh Kumar |
| **Registration** | `Templates/registration.html` | Six-step animated registration form (`OnboardingForm` adaptation) with `+91` / international phone validation, event selection, conditional team details, review, and consent |
| **Gallery** | `Templates/gallery.html` | WebGL-backed `FlexCarousel` showcasing 35 UDAAN photographs |
| **IGNITION Esports** | `Templates/ignition.html` | Esports showcase for `COD Mobile`, `Valorant`, and `Clash Royale` |
| **Developers** | `Templates/developers.html` | `Elias` interactive author hero with developer portrait and social links |

---

## Events & Categories

**UDAAN 2026 — Sports & Cultural (12 events, `Scripts/events.js` / `src/events-entry.tsx`):**
- Cricket
- Football
- Badminton
- Table Tennis
- Volleyball
- Athletics
- Board Games
- Javelin
- Kabaddi
- Tug of War
- Literary
- Cultural

**IGNITION 2026 — Esports (`Templates/ignition.html`):**
- COD Mobile
- Valorant
- Clash Royale

---

## Technology Stack

- **Static Core:** HTML5, CSS3, vanilla JavaScript
- **UI Islands:** React `^19.0.0`, React DOM `^19.0.0`, TypeScript
- **Styling & Primitives:** Tailwind CSS `^4.3.5` (`@tailwindcss/cli`), Radix UI (`checkbox`, `label`, `radio-group`, `select`, `slot`), `class-variance-authority`, `lucide-react`, `sonner`
- **Motion & Graphics:** `motion` (`^14.14.0`), `ogl` (`^1.0.11`)
- **Bundling:** `esbuild` (`^0.25.0`)
- **Edge API & Database:** Cloudflare Pages Functions (`functions/api/registrations.ts`) + Supabase PostgreSQL (`supabase/migrations/001_create_event_registrations.sql`)

---

## Architecture

The site keeps static HTML pages as the outer shell and mounts React bundles into dedicated root elements:

- `#events-carousel-root` → `src/events-entry.tsx` → `Scripts/events-carousel.bundle.{js,css}`
- `#udaan-footer-root` → `src/footer-entry.tsx` → `Scripts/footer.bundle.js`
- `#gallery-carousel-root` → `src/gallery-entry.jsx` → `Scripts/gallery-carousel.bundle.{js,css}`
- `#elias-root` → `src/developers-entry.tsx` → `Scripts/developers-hero.bundle.{js,css}`
- `#registration-form-root` → `src/registration-entry.tsx` → `Scripts/registration-form.bundle.{js,css}`

Tailwind v4 CSS entrypoints import `tailwindcss/theme.css` and `tailwindcss/utilities.css` without Preflight so legacy `Styles/*.css` rules remain intact.

---

## Project Structure

```text
.
├── index.html
├── _headers
├── robots.txt
├── package.json
├── tsconfig.json
├── .dev.vars.example
├── .gitignore
├── Templates/
│   ├── developers.html
│   ├── director.html
│   ├── gallery.html
│   ├── ignition.html
│   └── registration.html
├── components/ui/
│   ├── coverflow-carousel.tsx
│   ├── doodle-crew-footer.tsx
│   ├── elias-author-hero.tsx
│   ├── multistep-form.tsx
│   └── button.tsx, card.tsx, checkbox.tsx, input.tsx, label.tsx, radio-group.tsx, select.tsx, textarea.tsx
├── src/
│   ├── components/FlexCarousel.{jsx,css}
│   ├── developers-entry.tsx, developers.css
│   ├── events-entry.tsx, events-coverflow.css
│   ├── footer-entry.tsx
│   ├── gallery-entry.jsx
│   └── registration-entry.tsx, registration-form.css
├── lib/utils.ts
├── functions/api/registrations.ts
├── supabase/migrations/001_create_event_registrations.sql
├── Scripts/
├── Styles/
├── Assets/
└── docs/
    ├── PROJECT_AUDIT.md
    └── CLAUDE_HANDOFF.md
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Preview static pages locally
python -m http.server 5500
```

Open `http://localhost:5500/index.html` (or `/Templates/registration.html`, etc.).

To run the Cloudflare Pages Function (`POST /api/registrations`) locally, install `wrangler`, copy `.dev.vars.example` to `.dev.vars` with your Supabase project credentials, and run:

```bash
npx wrangler pages dev .
```

---

## Build & Verification

All bundle scripts defined in `package.json`:

```bash
npm run build:gallery
npm run build:events
npm run build:footer
npm run build:developers
npm run build:registration

# TypeScript type-check
npx tsc --noEmit
```

---

## Registration Backend & Database

`POST /api/registrations` is implemented in `functions/api/registrations.ts`:

- Validates `application/json` content type and enforces a `16 KB` payload limit.
- Checks a hidden honeypot field (`website`) and requires explicit accuracy/data-use consent.
- Validates and normalizes `+91` Indian mobile numbers and international numbers.
- Validates selected events against an authoritative allowlist (12 UDAAN events + 3 IGNITION esports titles) and enforces `teamName` for team entries.
- Inserts into `public.event_registrations` (defined in `supabase/migrations/001_create_event_registrations.sql`) with a unique `submission_id` UUID for idempotency.
- Row Level Security (RLS) is enabled with **no** public `SELECT`, `INSERT`, `UPDATE`, or `DELETE` policies; only the server-side function writes rows.

---

## Environment Variables

Configure these server-side variables in `.dev.vars` for local Wrangler development and as encrypted **Secrets** in Cloudflare Pages for deployment:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project REST API base URL |
| `SUPABASE_SECRET_KEY` | Server-side Supabase secret key (`sb_secret_...`) used exclusively inside `functions/api/registrations.ts` |

Never commit `.dev.vars`, `.env` files, or secret keys to Git.

---

## Cloudflare Pages Deployment

- **Build output / root directory:** `.` (static HTML pages and prebuilt `Scripts/*.bundle.*` assets are served directly from the repository root).
- **Functions directory:** `functions/` (automatically exposes `functions/api/registrations.ts` at `/api/registrations`).
- **Headers & Crawlers:** `_headers` configures security headers, static asset caching, and `noindex` on source directories (`/src/*`, `/components/*`, `/lib/*`, `/node_modules/*`); `robots.txt` configures crawler access.

---

## Current Status & Known Limitations

- **Registration backend:** The frontend form, Cloudflare Pages Function, and Supabase SQL migration are implemented and verified locally with mocked API responses. Live database persistence requires creating/selecting a Supabase project, running `supabase/migrations/001_create_event_registrations.sql`, and configuring `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
- **Production domain SEO:** Canonical links, `og:url`, absolute `og:image`, and `sitemap.xml` are pending confirmation of the final production domain.

---

## Credits & Attribution

- **Developers page design:** `Original design by DVM, BITS Pilani.` (credit preserved on `Templates/developers.html`).
- **UDAAN 2026 integration & maintenance:** `RoxxSujal7`.

---

## Maintainer

- **GitHub:** [RoxxSujal7](https://github.com/RoxxSujal7)
- **Repository:** [https://github.com/RoxxSujal7/roxx-udaan-bce](https://github.com/RoxxSujal7/roxx-udaan-bce)
