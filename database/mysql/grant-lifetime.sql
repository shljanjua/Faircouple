-- ============================================================================
-- FairCouples — grant a Lifetime full-access plan to one account
--
-- Gives the chosen email a permanent, top-tier (Lifetime) subscription with no
-- renewal and no expiry, so the dashboard shows "Lifetime plan" and every
-- feature and limit is unlocked. Nothing is charged — this is a manual grant.
--
-- WHO NEEDS THIS: any account you want on full access without paying (your own
-- superadmin, a co-founder, a lifetime supporter). Superadmins already get full
-- access automatically in code, but running this also makes their plan badge
-- read "Lifetime" from the subscriptions table.
--
-- HOW TO USE: replace the email below (appears once) with the target address,
-- then run the whole file. It is safe to re-run — it updates the same row.
-- ============================================================================

SET @grant_email = 'you@your-domain.com';   -- <-- EDIT THIS

INSERT INTO subscriptions
  (id, user_id, plan_id, provider, provider_subscription_id, status,
   currency, billing_interval, amount_cents, seats,
   current_period_start, current_period_end, notes)
SELECT
  UUID(),
  pr.id,
  pl.id,
  'manual',
  CONCAT('manual-lifetime-', pr.id),
  'active',
  COALESCE(pr.currency, 'USD'),
  'lifetime',
  0,
  2,
  UTC_TIMESTAMP(),
  NULL,                       -- NULL = never expires
  'Manual lifetime grant'
FROM profiles pr
JOIN plans pl ON pl.slug = 'lifetime'
WHERE pr.email = @grant_email
ON DUPLICATE KEY UPDATE
  plan_id              = VALUES(plan_id),
  status               = 'active',
  billing_interval     = 'lifetime',
  amount_cents         = 0,
  current_period_start = VALUES(current_period_start),
  current_period_end   = NULL,
  cancel_at_period_end = 0,
  canceled_at          = NULL,
  ended_at             = NULL,
  notes                = 'Manual lifetime grant';

-- Confirm it landed:
SELECT pr.email, pl.name AS plan, s.status, s.billing_interval, s.current_period_end
  FROM subscriptions s
  JOIN profiles pr ON pr.id = s.user_id
  JOIN plans pl    ON pl.id = s.plan_id
 WHERE pr.email = @grant_email;
