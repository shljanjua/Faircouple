# FairCouples

**Enterprise subscription SaaS for relationship fairness, emotions, budgeting and travel planning.**

FairCouples measures what actually breaks relationships: imbalance. Each partner logs their own
entries — privately, from anywhere in the world — and the platform compares the two sides, showing
where effort, respect and loyalty are drifting apart. Around that sits everything a couple needs
day to day: emotions, private messaging, fair money splitting, gifts, and full honeymoon/travel
planning with an itinerary generator and a ticket vault.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth,
Storage, Realtime)**, with **Stripe and PayPal** billing in five currencies and a complete admin
panel.

---

## Contents

1. [What is included](#what-is-included)
2. [Quick start](#quick-start)
3. [Database setup](#database-setup-supabase)
4. [Environment variables](#environment-variables)
5. [Admin panel](#admin-panel)
6. [Payments](#payments-stripe--paypal)
7. [Email / SMTP](#email--smtp)
8. [SEO](#seo)
9. [Deployment](#deployment)
10. [Scheduled jobs](#scheduled-jobs)
11. [Hostinger MySQL](#hostinger-mysql)
12. [Project structure](#project-structure)
13. [Security model](#security-model)

---

## What is included

### The fairness engine
- **Ten areas**, thirty specific behaviours, each with a *fair rule*:
  emotional connection · communication · respect & boundaries · trust & loyalty ·
  financial fairness · time & attention · conflict management · affection & care ·
  growth & future alignment · deal breakers.
- Both partners score **themselves and each other**, independently, every week.
- **Balance index (0–100)** for whether effort is even, plus a weighted overall score.
- **Perception gaps** — where what you said about yourself differs from what your partner said
  about you. That gap is usually the real argument.
- 12-week trend line, risk levels (healthy / watch / strained / critical), narrative insights,
  and a weekly report emailed to both partners.
- Works for any two-person relationship: partners, spouses, **a mother and son**, siblings,
  friends. Each member gets their own role label and their own entries.

### Emotions
- 30 emotions across positive / neutral / difficult, each with intensity 1–10.
- Scope: about **me**, about **my partner**, or about **the relationship**.
- Trigger and “what I need right now” fields, private mode, partner acknowledgement,
  30-day mood chart comparing both partners.

### Compatibility
- **Love vs Attraction assessment** (20 questions, public and free) — separates consistency from
  intensity and tells you which one your data actually describes.
- Eight-dimension compatibility radar, scored by both partners and compared.

### Together
- Real-time **private messaging** with photos, 40 smileys, 6 reactions and read receipts.
- Shared **photo gallery** with signed, expiring URLs.
- **Gift planner** with surprise mode (hidden from the recipient until given) and wishlists.
- 15 **checklist templates**: weekly fairness ritual, conflict repair, monthly money talk,
  date-night rotation, plus packing lists for every climate.

### Money
- Budgets (household, per-trip, event, gift) and expenses in five currencies.
- **Equal or income-proportional splitting**, automatic “who owes whom”, one-tap settle up.
- Category breakdown charts.

### Travel
- 45 countries and 50+ destination guides with real daily costs, best months, honeymoon scores
  and attractions.
- **Itinerary generator** — day-by-day plans from the destination's attractions, matched to pace
  (relaxed / balanced / packed) and interests.
- **Ticket vault** — flight tickets, hotel confirmations, trains, car rental, attraction passes,
  insurance, visas and passports. Uploaded straight to private storage, reachable by both partners.
- Climate-specific packing lists with items assigned per partner.

### Business layer
- 4 plans (Starter free · Essential · Premium · Lifetime), pricing in **USD, GBP, EUR, CAD, AUD**.
- Currency is chosen at signup from the user's country and can be changed until they subscribe.
- **One subscription covers both partners.**
- Stripe (cards, Apple Pay, Google Pay) and PayPal, with verified webhooks and idempotency.
- Plan limits enforced server-side on every write.

### Admin panel (`/admin`)
Dashboard · Users · Relationship spaces · Plans & pricing · Subscriptions · Payments & gateways ·
Coupons · Blog · Legal pages · FAQ & testimonials · Destinations · SEO & redirects · Email & SMTP ·
Inbox & subscribers · Settings & integrations · Audit log.

---

## Quick start

```bash
git clone https://github.com/shljanjua/faircouple.git
cd faircouple
npm install
cp .env.example .env.local     # then fill in the Supabase values
npm run dev                    # http://localhost:3000
```

Scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (next/core-web-vitals) |

---

## Database setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run these files **in order** — paste the contents of each and press Run:

   | Order | File | What it creates |
   | --- | --- | --- |
   | 1 | `supabase/migrations/0001_schema.sql` | 50+ tables, functions, triggers, indexes |
   | 2 | `supabase/migrations/0002_rls.sql` | Row Level Security on every table |
   | 3 | `supabase/migrations/0003_seed.sql` | Fairness framework, emotions, plans & prices, 45 countries, 50+ destinations, attractions, 15 checklist templates, blog posts, legal pages, FAQs, email templates, settings |
   | 4 | `supabase/migrations/0004_storage.sql` | Storage buckets + object policies |
   | 5 | `supabase/migrations/0005_admin_bootstrap.sql` | Promotes your account to superadmin — **edit the email first**, and run it after you have signed up |

3. **Authentication → URL Configuration**
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`, `http://localhost:3000/auth/callback`
4. **Authentication → Providers → Email**: enable “Confirm email”.
5. Copy the project URL and both API keys into your environment.

> The app never queries with the service-role key from the browser. Every user-facing query runs
> under RLS with the anon key.

---

## Environment variables

Copy `.env.example` to `.env.local` (and set the same values in your host):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonicals, sitemap, OG tags, checkout redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public key, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only: webhooks, admin actions. Never expose it |
| `STRIPE_SECRET_KEY` | optional | Can be set in Admin → Payments instead |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | optional | " |
| `STRIPE_WEBHOOK_SECRET` | optional | " |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` | optional | " |
| `PAYPAL_ENV` | optional | `sandbox` or `live` |
| `CRON_SECRET` | optional | Protects `/api/cron` |

Gateway credentials stored in the admin panel take priority over environment variables, so you can
rotate keys without a redeploy.

---

## Admin panel

1. Sign up through the app with the email you want as admin.
2. Edit the email in `supabase/migrations/0005_admin_bootstrap.sql` and run it.
3. Visit `/admin`.

The dashboard opens with a **setup checklist** that tells you exactly what is still unconfigured
(no payment gateway, no SMTP, no analytics, maintenance mode left on).

Everything below is editable without touching code:

- **Users** — role, status, suspension reason, manual plan grants, one-time support sign-in links,
  deletion.
- **Relationship spaces** — see both members, and remove either one (for example when one partner
  subscribed and asks for the other to be removed). Removal is immediate and audited.
- **Plans & pricing** — create packages, edit feature lists, edit the limits JSON, and publish
  prices per currency and interval with optional Stripe/PayPal IDs.
- **Payments** — enable/disable gateways, switch test/live, paste keys (secrets are write-only and
  never sent back to the browser), review every transaction and every webhook delivery.
- **Content** — blog with full on-page SEO fields, legal pages, FAQ (feeds the FAQPage schema),
  testimonials.
- **SEO** — per-route metadata, redirects, and a summary of the technical SEO that is already live.
- **Email** — SMTP credentials, all 10 transactional templates, test sends, delivery log.
- **Settings** — brand, currencies, GA4, GTM, Meta Pixel, Google Ads, AdSense, Clarity, Hotjar,
  TikTok, Pinterest, LinkedIn, cookie banner, social profiles, tax and maintenance mode.
- **Audit log** — every admin action with actor, IP and user agent.

---

## Payments (Stripe & PayPal)

### Stripe
1. Admin → Payments → Stripe: paste the publishable key, secret key and webhook secret; set the
   mode; enable it.
2. In Stripe → Developers → Webhooks, add `https://your-domain.com/api/webhooks/stripe` and
   subscribe to:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`.
3. Prices are created on the fly from your plan pricing, or you can paste existing Stripe price IDs
   per currency in Admin → Plans.

### PayPal
1. Create a REST app at developer.paypal.com.
2. Admin → Payments → PayPal: paste the client ID, secret and webhook ID.
3. Add the webhook `https://your-domain.com/api/webhooks/paypal`.

Signatures are verified for both providers, every event is stored in `webhook_events`, and repeat
deliveries are ignored idempotently.

---

## Email / SMTP

Admin → Email. For Hostinger mailboxes:

| Field | Value |
| --- | --- |
| Host | `smtp.hostinger.com` |
| Port | `465` (SSL on) or `587` (SSL off) |
| Username | the full mailbox address |
| From | the same mailbox |

Use **Verify connection** and **Send test email** before going live. Templates: welcome/verify,
partner invite, password reset, subscription activated, payment failed, weekly fairness report,
partner entry, trip reminder, removed from a couple, contact auto-reply.

---

## SEO

Already implemented, no plugin required:

- Per-page `<title>`, meta description, keywords, canonical, OpenGraph and Twitter cards.
- **JSON-LD**: Organization, WebSite (+ SearchAction), SoftwareApplication with AggregateOffer and
  AggregateRating, BreadcrumbList, FAQPage, HowTo, BlogPosting, TouristDestination, Product,
  ItemList.
- `sitemap.xml` generated from the database — static routes, blog posts, destinations, countries and
  CMS pages, with priorities and change frequencies.
- `robots.txt` with per-crawler rules; `/admin`, `/dashboard` and `/api` are blocked.
- Dynamic OG images at `/og` (1200×630).
- Search Console, Bing, Yandex and Pinterest verification tokens from the admin panel.
- Admin-managed 301/302 redirects.
- An emergency site-wide no-index switch.
- Semantic HTML, skip link, ARIA labelling, `text-wrap: balance`, responsive images with lazy
  loading, and `next/font` self-hosting.

Content is written around real search intent: honeymoon destination guides with costs, country
guides, packing checklists, the fairness framework, and the Love vs Attraction test.

---

## Deployment

### Vercel (recommended)
1. Import the GitHub repository.
2. Add the environment variables.
3. Add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — pushes to `main`
   then deploy automatically via `.github/workflows/deploy.yml`.

### Hostinger VPS / any Node host
```bash
npm ci
npm run build
npm start          # respects $PORT, defaults to 3000
```
Put Nginx in front for TLS, and keep the process alive with PM2:
```bash
pm2 start "npm start" --name faircouples
pm2 save
```

> Hostinger's *shared* hosting cannot run Next.js server rendering (it is PHP-only). Use a
> Hostinger VPS, or host the app on Vercel and keep your domain and mailboxes at Hostinger.

CI runs typecheck, lint and build on every push (`.github/workflows/ci.yml`).

---

## Scheduled jobs

`GET /api/cron?job=all` with `Authorization: Bearer $CRON_SECRET` runs:

- `trip-reminders` — emails both partners 14, 7 and 1 days before departure
- `weekly-reports` — Monday fairness report to both partners
- `expire-invites` — marks stale invitations expired

`.github/workflows/cron.yml` calls it daily at 08:00 UTC and weekly on Mondays. Vercel Cron or a
Hostinger cron job calling the same URL works identically.

---

## Hostinger MySQL

The application runs on Supabase (PostgreSQL). If you also want the schema in Hostinger's MySQL —
for reporting, a replica, or a future migration — `database/mysql/faircouples-mysql.sql` is a
complete MySQL 8.0 translation with the fairness framework, plans and pricing seeded.

Import it through **hPanel → Databases → phpMyAdmin → Import**. Note that MySQL has no Row Level
Security, so any application built on it must scope every query by `couple_id` / `user_id` itself.

---

## Project structure

```
src/
├── app/
│   ├── (marketing)/       Public site: home, features, fairness, destinations,
│   │                      countries, blog, checklists, pricing, FAQ, contact,
│   │                      CMS pages (legal, about)
│   ├── (auth)/            Sign in, sign up, forgot/reset password, verify email
│   ├── (app)/             Dashboard: fairness, emotions, check-in, compatibility,
│   │                      checklists, messages, gallery, gifts, budget, travel,
│   │                      documents, partner, billing, settings, checkout
│   ├── admin/             Full admin panel
│   ├── api/               Checkout, webhooks, contact, newsletter, cron
│   ├── actions/           Server actions (couple, fairness, entries, money,
│   │                      travel, vault, account, billing, admin)
│   ├── auth/callback/     Supabase redirect handler
│   ├── og/                Dynamic OpenGraph image
│   ├── sitemap.ts robots.ts
├── components/            ui/ · marketing/ · app/ · admin/ · analytics · providers
├── lib/                   supabase/ · auth · fairness · assessment · itinerary ·
│                          payments · email · settings · seo · currency · plans · utils
└── types/
supabase/migrations/       0001 schema · 0002 RLS · 0003 seed · 0004 storage · 0005 admin
database/mysql/            MySQL 8.0 translation for Hostinger
.github/workflows/         ci · deploy · cron
```

---

## Security model

- **Row Level Security on every table.** A couple's data is reachable only by its two members and
  by platform admins. Private entries are visible only to their author, and still count in that
  author's own trends.
- **Storage isolation** — private files live under `<couple_id>/<user_id>/…` and are served through
  short-lived signed URLs. A storage policy checks membership on every read and write.
- **Service-role key is server-only** and used exclusively by webhooks and verified admin actions.
- **Webhooks verify signatures** (Stripe signing secret, PayPal verify-webhook-signature) and are
  idempotent.
- **Payment details never touch our servers** — Stripe and PayPal hold them.
- **Secrets are write-only in the admin UI**: the panel reports whether a credential exists, never
  its value.
- **Audit log** records every admin action with actor, IP and user agent.
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy) are set in `next.config.mjs`.
- GDPR: self-service data export and account deletion in Settings → Privacy.

---

## Disclaimer

FairCouples provides self-reported measurement and educational content. It is not therapy,
counselling, or medical, legal or financial advice. If you are experiencing abuse, contact your
local emergency service or a domestic abuse helpline.
