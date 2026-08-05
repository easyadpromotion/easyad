-- ══════════════════════════════════════════════════════════════════
-- Adds vendor_name to `campaigns` — the Vendor Name column on the
-- admin's per-state report (state_detail.html) has always shown "—"
-- because nothing ever wrote a name anywhere Supabase can see. There
-- is no `vendors` table at all (vendor auth is still localStorage-only,
-- per vendor-login.html/vendor-register.html), and the three ad-posting
-- pages (post_video_ad.html, post_frame_ad.html, post_survey_ad.html)
-- only ever sent vendor_mobile on the campaigns row, never a name.
--
-- This column is populated going forward by those three pages, which
-- now read the vendor's own name out of their local vendorProfile_*
-- record at the moment they post an ad. Vendor Contact needed no
-- migration — it now falls back to the existing vendor_mobile column
-- (see getVendorContact() in state_detail.html).
--
-- Existing campaigns won't backfill (same limitation as the user
-- profile migration): there's no name to recover for ads already
-- posted, only for new ones from here on.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════

alter table campaigns
  add column if not exists vendor_name text;
