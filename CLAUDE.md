# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Easy Ad Promotion" (EAP) is an Indian pay-to-view advertising platform: users watch video/banner/survey ads to earn money, vendors post and pay for ad campaigns, and admins approve campaigns and manage users/payouts.

This is a **flat collection of self-contained static HTML files** — there is no framework, no build step, and no server-side code in this repo. Each `.html` file is a full mobile-app "screen" (styled as a phone-frame mockup) with its own inline `<style>` and `<script>` blocks. Navigation between screens is plain `<a href="other.html">` / `window.location.href` — there is no client-side router or component framework.

A `package.json` and Capacitor config were added on top of this to package the same HTML pages as a native Android/iOS app — see `MOBILE_APP.md`. It does not change how the pages themselves work; `npm run build` just copies them into `www/` for the native shell to load.

## Running the app

There is nothing to build or install. Either open an HTML file directly in a browser, or serve the directory statically, e.g.:

```bash
npx serve .
```

There is no lint, test, or CI setup in this repo — verification is manual, in-browser.

## Architecture

**Backend**: There is no backend code here. All data persistence goes straight from browser JS to a hosted **Supabase** project (Postgres + PostgREST), via the `@supabase/supabase-js` CDN script. The Supabase URL/publishable key are hardcoded and duplicated identically across ~25+ pages (e.g. `active-ads.html`, `admin_dashboard.html`, `user_login.html`) rather than centralized — changing the Supabase project means editing every page. Row Level Security is intentionally **off** repo-wide (see `add_view_tracking.sql`), pending real auth.

Known tables (inferred from `.from(...)` calls, no schema file besides `add_view_tracking.sql`): `users`, `campaigns`, `ad_views`, `user_ad_history`, `survey_questions`, `survey_options`, `survey_responses`. `add_view_tracking.sql` is the only migration artifact — it's applied manually via the Supabase SQL editor, not through any migration tool.

**Auth is custom per role, not Supabase Auth, and inconsistent across roles**:
- **Users** (`user_login.html`): OTP via the 2Factor.in SMS API (API key hardcoded client-side), then looks up the `users` table by mobile number. Session is just `localStorage.setItem("activeUser", mobileNumber)` — no tokens.
- **Vendors** (`vendor-login.html`): still purely `localStorage`-based (`vendorProfile_<mobile>` keys) — not yet migrated to Supabase, unlike user auth.
- **Admins** (`admin_login.html`): a hardcoded default password stored in `localStorage`, trivially bypassable via devtools. Treat admin pages as effectively unauthenticated from a security standpoint.

**Mid-migration state**: the app is transitioning page-by-page from localStorage-only prototype data to Supabase-backed persistence. Some pages are fully on Supabase; others still use localStorage as the source of truth or as a cache/fallback. Pages that have been migrated typically have a comment explaining the change (e.g. `active-ads.html`: "Supabase-backed getAds() — replaces localStorage('vendorCampaigns')"). Don't assume uniform data flow across pages — check each page's own script for how it actually reads/writes state.

**i18n**: `i18n.js` (shared, loaded via `<script src="i18n.js">`) is a hand-rolled localization engine covering English plus India's 22 scheduled languages. Static text uses `data-i18n="key"` attributes resolved against a `DICT` object; dynamic/user-generated text (e.g. vendor-typed ad titles) goes through `translateDynamic()`, which calls the MyMemory translation API and caches results in `localStorage`, falling back to English on failure. Language choice persists in `localStorage["eap_lang"]`. **`index.html` duplicates this entire system inline** instead of using `i18n.js` — if you change the i18n system, `index.html` needs to be updated separately to stay in sync.

**Maps**: location targeting uses the Google Maps JS API. API keys are hardcoded per-page, and **at least 3 different keys** are used across different files/groups of pages (plain `<script>` keys in some files vs. a `window.MAPS_CONFIG = { API_KEY, MAP_ID }` object in the `post_*_ad.html` pages) — check which pattern a given page uses before touching its map integration.

**Rendering**: no component framework — data from Supabase is rendered via direct DOM string concatenation (`innerHTML +=` patterns), e.g. in `admin_users.html`, `active-ads.html`.

## Things to watch for when editing

- Secrets (Supabase key, 2Factor.in SMS key, Google Maps keys, admin password) are hardcoded client-side throughout, not via env vars — there is no `.env` mechanism in this repo currently.
- File naming mixes `kebab-case` and `snake_case` inconsistently, and there are near-duplicate files from what look like leftover forks (e.g. `activity-history.html` and `activity_history.html` both exist) — check which one is actually linked from other pages before editing either.
- Since Supabase bootstrap code, Maps keys, and i18n are all copy-pasted per file rather than shared, a change intended to be "global" (e.g. rotating a key, fixing an i18n bug) usually needs to be applied across every page that duplicates that code, not just one file.
