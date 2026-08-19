-- ============================================================================
-- FairCouples — RESET (drops every table)
--
-- Use this ONLY when you want to wipe the database and re-import
-- faircouples-mysql.sql from a clean slate — for example if an earlier import
-- was partial and the schema no longer matches the app (a tell-tale sign is an
-- "Unknown column" error such as: Unknown column 'disabled_at' in 'users').
--
-- ⚠️  THIS DELETES ALL DATA IN THESE TABLES. Only run it on a fresh install or
--     when you genuinely want to start over.
--
-- HOW TO USE
--   1. hPanel -> Databases -> phpMyAdmin -> select your database.
--   2. SQL tab -> paste this whole file -> Go.
--   3. Import tab -> choose faircouples-mysql.sql -> Go (recreates everything).
--   4. Re-run create-admin.sql (or your admin INSERT) to make an administrator.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  usage_counters, exchange_rates, feature_flags, newsletter_subscribers,
  contact_messages, audit_logs, notifications, email_logs, email_templates,
  payment_gateways, site_settings, testimonials, faqs, redirects, seo_meta,
  pages, blog_posts, blog_categories, packing_items, packing_lists,
  itinerary_items, itinerary_days, itineraries, trips, attractions,
  destinations, countries, wishlist_items, gifts, settlements, expense_shares,
  expenses, budget_categories, budgets, incomes, travel_documents, media_assets,
  messages, conversations, checklist_items, checklists, checklist_templates,
  compatibility_scores, assessments, daily_checkins, emotion_logs, emotion_types,
  fairness_reports, fairness_criteria_responses, fairness_entries,
  fairness_criteria, fairness_categories, webhook_events, coupons, payments,
  subscriptions, plan_prices, plans, couple_invitations, couple_members,
  couples, profiles, auth_tokens, sessions, users;

SET FOREIGN_KEY_CHECKS = 1;
