-- ============================================================================
-- FairCouples — create an administrator directly in the database
--
-- Use this to make a superadmin without going through the signup form (handy
-- for the very first admin). It creates the login row and its profile, marks
-- the email verified, and sets the role to superadmin. Running it again just
-- updates the same account, so it is safe to re-run.
--
-- ⚠️  THIS IS A TEMPLATE. Do the two edits below before running it, and do NOT
--     commit a real password hash back into version control.
--
-- ---------------------------------------------------------------------------
-- EDIT 1 — the email address. Replace admin@example.com in BOTH statements.
--
-- EDIT 2 — the password hash. Generate a bcrypt hash of your chosen password
--          and paste it in place of PASTE_BCRYPT_HASH_HERE.
--
--   • Easiest: sign up through the site with your intended password, then just
--     run an UPDATE to promote yourself instead of this file:
--         UPDATE profiles SET role = 'superadmin' WHERE email = 'you@your-domain.com';
--
--   • Or generate a hash yourself. Any of these produce a bcrypt hash:
--         PHP :  php -r "echo password_hash('YourPassword', PASSWORD_BCRYPT, ['cost'=>12]);"
--         CLI :  htpasswd -bnBC 12 "" 'YourPassword' | tr -d ':\n' | sed 's/^\$2y/\$2y/'
--     A bcrypt hash starts with $2y$ and is 60 characters long.
--
-- NOTE: choose a password that also meets the app's own rule (8+ chars with an
-- upper-case letter, a lower-case letter and a digit) so you can later change
-- it from Admin -> Settings -> Security without being rejected.
--
-- If this errors with "Unknown column 'disabled_at'", your schema is from an
-- older/partial import — run reset.sql and re-import faircouples-mysql.sql
-- first, then run this file.
-- ============================================================================

-- 1) The login row.
INSERT INTO users (id, email, password_hash, email_verified_at)
VALUES (UUID(), 'admin@example.com', 'PASTE_BCRYPT_HASH_HERE', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  password_hash     = VALUES(password_hash),
  email_verified_at = UTC_TIMESTAMP(),
  disabled_at       = NULL;

-- 2) The profile, matched to the login row by email, forced to superadmin.
INSERT INTO profiles (id, email, full_name, role, status, currency, country_code, email_verified_at, onboarded_at)
SELECT id, email, 'Administrator', 'superadmin', 'active', 'USD', 'US', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM users WHERE email = 'admin@example.com'
ON DUPLICATE KEY UPDATE
  role              = 'superadmin',
  status            = 'active',
  email_verified_at = UTC_TIMESTAMP(),
  deleted_at        = NULL;
