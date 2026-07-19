-- ══════════════════════════════════════════════════════════════════
-- Adds real view tracking — previously nothing ever recorded that an
-- ad was viewed, which is why Total Views showed 0 everywhere.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════

-- One row per user-viewed-this-ad event. Powers the vendor-facing
-- "who viewed my ad" detail screen (name/location/phone/time table).
create table ad_views (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid references campaigns(id) on delete cascade,
  viewer_mobile      text,
  viewer_first_name  text,
  viewer_last_name   text,
  viewer_location    text,             -- reverse-geocoded label, display only
  viewer_lat         double precision,
  viewer_lng         double precision,
  viewed_at          timestamptz default now()
);

create index idx_ad_views_campaign on ad_views(campaign_id);

-- The JS client can't safely do "views = views + 1" as a plain update
-- (two simultaneous viewers could overwrite each other's increment).
-- This function does the increment atomically inside the database.
create or replace function increment_campaign_views(p_campaign_id uuid)
returns void
language sql
as $$
  update campaigns set views = coalesce(views, 0) + 1 where id = p_campaign_id;
$$;

-- ══════════════════════════════════════════════════════════════════
-- ⚠️ Same standing tradeoff as every other table so far: RLS is left
-- OFF here too, consistent with the rest of the app until real
-- vendor/user authentication exists. This table does store viewer
-- phone numbers and approximate location — low sensitivity today
-- since it's masked before ever being shown on screen (see the new
-- ad-viewers.html page), but worth tightening alongside everything
-- else once real auth is in place.
-- ══════════════════════════════════════════════════════════════════
