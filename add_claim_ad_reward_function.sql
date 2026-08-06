-- ══════════════════════════════════════════════════════════════════
-- Wraps "record the claim" + "credit the wallet" into one atomic
-- database transaction, called once instead of two separate network
-- round-trips (insert into user_ad_history, then a separate RPC call
-- to increment_user_wallet).
--
-- Why this matters: with two separate calls, if the history insert
-- succeeds but the wallet-credit call fails (network blip, etc.), the
-- claim code lets the user retry — which inserts a SECOND history row
-- for the same claim while only ever crediting the wallet once. This
-- function makes both writes succeed or fail together, so a retry
-- after a real failure can't create a duplicate-but-uncredited record.
--
-- Replaces the two-call pattern in video-ads.html / frame-ads.html /
-- surveys.html's claim functions. increment_user_wallet (used
-- elsewhere, e.g. withdrawals) is untouched.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════

create or replace function claim_ad_reward(
  p_mobile text,
  p_campaign_id uuid,
  p_ad_name text,
  p_ad_type text,
  p_amount numeric
)
returns numeric
language plpgsql
as $$
declare
  v_new_balance numeric;
begin
  insert into user_ad_history (user_mobile, campaign_id, ad_name, ad_type, amount)
  values (p_mobile, p_campaign_id, p_ad_name, p_ad_type, p_amount);

  update users
  set wallet = coalesce(wallet, 0) + p_amount, updated_at = now()
  where mobile = p_mobile
  returning wallet into v_new_balance;

  if v_new_balance is null then
    raise exception 'No users row for mobile %', p_mobile;
  end if;

  return v_new_balance;
end;
$$;
