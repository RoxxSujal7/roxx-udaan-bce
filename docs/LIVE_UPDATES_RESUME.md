# UDAAN 2026 — Live Updates & WhatsApp Bridge Resume Report

**Date:** 2026-11-27  
**Repository:** `C:\Users\sujal\udaan-site`  
**Current Branch:** `live-updates` (branched from `main`, **uncommitted** local changes)  
**Production Branch (`main`):** Clean and untouched (`b848d62` merged `admin-dashboard` + menu/contact updates)

---

## 1. Current Verified State

- `npx tsc --noEmit` → **Exit 0** (0 errors).
- `supabase/migrations/002_live_updates.sql` → **Already executed in Supabase**:
  - `GET /rest/v1/matches?select=id&limit=1` with `SUPABASE_PUBLISHABLE_KEY` → `200 []`
  - `GET /rest/v1/announcements?select=id&limit=1` with `SUPABASE_PUBLISHABLE_KEY` → `200 []`
- `lib/public-config.ts` → Updated with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- **Important:** `Scripts/live-board.bundle.js`, `Scripts/live-strip.bundle.js`, `Scripts/live-alerts.bundle.js`, and `Scripts/admin.bundle.js` were built **before** `SUPABASE_PUBLISHABLE_KEY` was added to `lib/public-config.ts` and **must be rebuilt** before testing or committing.

---

## 2. Files Already Created / Modified on `live-updates`

### Database & Config
- `supabase/migrations/002_live_updates.sql` — `matches` & `announcements` tables, RLS (`SELECT` public only), `touch_updated_at` trigger, `supabase_realtime` publication.
- `lib/public-config.ts` — public `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- `package.json`, `package-lock.json` — added `@supabase/supabase-js`, `@radix-ui/react-tabs`, `@radix-ui/react-scroll-area`, and `build:live`, `build:live-strip`, `build:live-alerts` scripts.
- `tsconfig.json` — added new `lib/`, `components/ui/`, `src/`, `functions/api/admin/` files to `include`.
- `_headers` — added `Cache-Control: no-cache` for `/Templates/live*`.

### Server Helpers & Admin Write APIs
- `lib/server/admin-auth.ts` — shared constant-time SHA-256 `ADMIN_PASSWORD` check (`requireAdminAuth`, `adminJsonResponse`).
- `lib/server/supabase-rest.ts` — shared `getSupabaseConfig`, `supabaseFetch`.
- `functions/api/admin/registrations.ts` — refactored to use `lib/server/` helpers.
- `functions/api/admin/matches.ts` — `POST` (single or bulk up to 100), `PATCH ?id=`, `DELETE ?id=`.
- `functions/api/admin/announcements.ts` — `POST`, `PATCH ?id=`, `DELETE ?id=`.

### Admin Live Control & Live Feed
- `components/ui/app-1-utils/live-control.tsx` — announcement composer, active announcements list, match cards grouped by day (27–30 Nov), Add/Edit/Score/Finish/Bulk-Add Sheets.
- `components/ui/app-1-utils/app-1-sidebar.tsx`, `components/ui/app-1.tsx`, `src/admin-entry.tsx`, `src/admin.css` — wired `Live control` section (`#live`).
- `components/ui/changelog-timeline.tsx` — adapted for `Live feed` (`live` / `result` / `notice` categories, IST `HH:MM`, day separators, touch hint, 4 s Realtime highlight).

### Public Live Page, Strip & Site-Wide Alerts
- `src/live/types.ts` — `Match`, `Announcement` (already includes optional `source` and `posted_by` for WhatsApp), `LiveConnectionState`.
- `src/live/client.ts` — singleton `window.__udaanLive`, `useLiveData()`, visibility-aware Realtime + 60 s REST fallback + backoff, `buildFeed()` (match-only).
- `src/live/use-after-loader.ts` — waits for `.loader` to hide before showing strip/alerts.
- `src/live/live-board.tsx`, `src/live-entry.tsx`, `src/live-board.css`, `Templates/live.html`.
- `src/live/live-strip.tsx`, `src/live-strip-entry.tsx`, `src/live-strip.css` — homepage `LIVE NOW` fixed pill.
- `src/live/live-alerts.tsx`, `src/live-alerts-entry.tsx`, `src/live-alerts.css` — site-wide banners & queued match toasts.
- `index.html`, `Templates/director.html`, `Templates/registration.html`, `Templates/gallery.html`, `Templates/ignition.html`, `Templates/developers.html` — added `LIVE` link in `.ham-links` and `live-alerts.bundle.*` tags (`index.html` also has `#live-strip-root`).

---

## 3. Unfinished Work (Resume Checklist)

### Step A — Complete `live-updates` Branch
1. **Part 4C (`NotificationsBlock` inbox):**
   - Create `components/ui/tabs.tsx` (`@radix-ui/react-tabs`) and `components/ui/scroll-area.tsx` (`@radix-ui/react-scroll-area`, with `data-slot="scroll-area-viewport"`).
   - Create `components/ui/notifications-block.tsx` with kinds `urgent | important | info | live | result | whatsapp`, Lucide icons, tabs `All | Unread | Important`, persistent `udaan_read_notifications` (`localStorage`, max 200 IDs), `Mark All Read`, and urgent scroll-to-top + dot pulse.
   - Add `@utility scroll-fade-y` and scoped `[data-slot="notifications-block"]` base styles to `src/live-board.css`.
   - Mount `NotificationsBlock` in `src/live/live-board.tsx` (desktop right column above `Live feed`; mobile directly after `Live now`).
   - Update `src/live/live-alerts.tsx` to display the unread notification count badge on `LIVE` nav links across all pages.
2. **Navigation & Event Constants Cleanup:**
   - Add `LIVE` link to `src/developers-entry.tsx` (Elias navbar on `Templates/developers.html`) — do **not** add `LIVE` to `.scrollNav` on `index.html`.
   - Have `components/ui/multistep-form.tsx` import `UDAAN_SPORTS_AND_CULTURAL_EVENTS`, `IGNITION_ESPORTS_EVENTS`, `ALL_ALLOWED_EVENTS` from `lib/events.ts` instead of duplicating them.
3. **Rebuild All Bundles:**
   - Run `npx tsc --noEmit` and every `npm run build:*` script (`gallery`, `events`, `footer`, `developers`, `registration`, `admin`, `live`, `live-strip`, `live-alerts`).
   - Verify generated `Scripts/*.bundle.js` contains `sb_publishable_FTpcUxkGG8rOa0U5QzLHsQ_zgT9fyuP`.
   - Run `git diff --check`.
4. **Part 8 Verification (on `live-updates`):**
   - `npx wrangler pages dev . --compatibility-date=2026-05-03` with `.dev.vars`:
     - Admin API checks (`/api/admin/matches`, `/api/admin/announcements`): `401`, `200`, `400`, `405`.
     - Supabase REST RLS `curl` checks with publishable key: `SELECT` on `matches`/`announcements` succeeds; writes fail; `SELECT` on `event_registrations` blocked.
   - Two-context Playwright tests: Realtime sync (< 3 s) for strip, board, `Live feed`, `NotificationsBlock`, unread nav badge, banner post/remove; WebSocket-blocked 60 s fallback test; `360×800`, `390×844`, `1440×900` overflow + CLS (`<= 0.01`) + screenshots.
   - Do **not** delete live production registration records; document any test match/announcement IDs created if not cleaned up.
   - Commit and push `live-updates` (do not merge to `main` without approval).

### Step B — `whatsapp-bridge` Branch (After `live-updates` Is Verified)
- Branch `whatsapp-bridge` from `live-updates`.
- Add `supabase/migrations/003_whatsapp_bridge.sql` (`source`, `posted_by`, `wa_message_id`).
- Add `functions/api/whatsapp/webhook.ts` (Meta GET verify, HMAC-SHA256 POST verification, allowlist, command parser, 10-min stale guard, idempotent insert, free mark-as-read via `waitUntil`, zero replies).
- Update `live-alerts.tsx`, `notifications-block.tsx`, `live-control.tsx` (Admin/WhatsApp source badges + collapsible `"Post from WhatsApp"` card with `PUBLIC_WHATSAPP_NUMBER_DISPLAY`).
- Run `node --test` parser/signature unit tests + `wrangler` + Playwright verification, commit and push `whatsapp-bridge`.

### Step C — Production Readiness Audit (`PRODUCTION_READINESS_AUDIT.md`) *(if still desired)*
- Run final read-only audit after `live-updates` / `whatsapp-bridge` are finalized.

---

## 4. Quick Resume Commands

```powershell
cd C:\Users\sujal\udaan-site
git status -s
npx tsc --noEmit
```
