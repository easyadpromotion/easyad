-- ══════════════════════════════════════════════════════════════════
-- Adds the profile columns registration.html has been trying to save
-- all along. Confirmed live via the REST API that `users` currently
-- only has: mobile, first_name, last_name, city, lat, lng, wallet,
-- created_at, updated_at — dob/gender/profession/specific_role were
-- never added, so registration.html's upsert (which writes all of
-- first_name, last_name, dob, gender, profession, specific_role, city
-- in one call) has been failing outright on every signup, which is
-- also why first_name/last_name show up null despite city being set
-- (that one's written separately, by home.html's location update).
-- blocked/on_hold are added too — admin_users.html already has
-- Block/Hold buttons wired up to them, just waiting on these columns.
-- registered_at is new: it's set explicitly by registration.html at
-- the moment a user finishes entering their details, separate from
-- created_at (which can predate a completed registration — it's set
-- the first time ensure_user_exists creates a bare mobile+city row,
-- before the user has filled in anything else).
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════

alter table users
  add column if not exists dob date,
  add column if not exists gender text,
  add column if not exists profession text,
  add column if not exists specific_role text,
  add column if not exists blocked boolean default false,
  add column if not exists on_hold boolean default false,
  add column if not exists registered_at timestamptz;

-- ══════════════════════════════════════════════════════════════════
-- ⚠️ Same standing tradeoff as every other table so far: RLS is left
-- OFF here too, consistent with the rest of the app until real
-- vendor/user authentication exists.
-- ══════════════════════════════════════════════════════════════════
