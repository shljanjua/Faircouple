# FairCouples

**Enterprise subscription SaaS for relationship fairness, emotions, budgeting and travel planning.**

FairCouples measures what actually breaks relationships: imbalance. Each partner logs their own
entries — privately, from anywhere in the world — and the platform compares the two sides, showing
where effort, respect and loyalty are drifting apart. Around that sits everything a couple needs
day to day: emotions, private messaging, fair money splitting, gifts, and full honeymoon/travel
planning with an itinerary generator and a ticket vault.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, on a **Hostinger MySQL 8.0**
backend with its own session-cookie authentication and local file storage, plus **Stripe and
PayPal** billing in five currencies and a complete admin panel.

Live at **https://grey-opossum-178268.hostingersite.com** — database `u237845628_Faircouple`.

---

## Contents

1. [What is included](#what-is-included)
2. [Quick start](#quick-start)
3. [Database setup](#database-setup-hostinger-mysql)
4. [Environment variables](#environment-variables)
5. [Admin panel](#admin-panel)
6. [Payments](#payments-stripe--paypal)
7. [Email / SMTP](#email--smtp)
8. [SEO](#seo)
9. [Deployment](#deployment)
10. [Scheduled jobs](#scheduled-jobs)
11. [Storage & files](#storage--files)
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
cp .env.example .env.local     # then fill in the MySQL credentials + AUTH_SECRET
npm run dev                    # http://localhost:3000
```

Import `database/mysql/faircouples-mysql.sql` into your MySQL database before the first run — see
[Database setup](#database-setup-hostinger-mysql).

Scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (next/core-web-vitals) |

---

## Database setup (Hostinger MySQL)

Everything lives in **one file**: `database/mysql/faircouples-mysql.sql`. It contains the complete
MySQL 8.0 schema *and* all reference data, and it is safe to re-import.

1. **hPanel → Databases → MySQL Databases** — confirm the database and user exist:

   | | |
   | --- | --- |
   | Database | `u237845628_Faircouple` |
   | User | `u237845628_Faircouple` |
   | Password | whatever you set in hPanel — it goes in `MYSQL_PASSWORD` |

2. **hPanel → Databases → phpMyAdmin** — open the database, go to **Import**, choose
   `database/mysql/faircouples-mysql.sql`, press **Go**. (Pasting it into the SQL tab works too.)

   What it creates:

   | Section | Contents |
   | --- | --- |
   | Schema | 50+ tables with foreign keys and indexes, plus `sessions` and `auth_tokens` for login |
   | Fairness | The 10 areas, their 30 behaviours and each area's fair rule |
   | Emotions | 30 emotions across positive / neutral / difficult |
   | Billing | 4 plans with their limits, and prices in USD, GBP, EUR, CAD and AUD |
   | Travel | 45 countries, 54 destinations, attractions for the itinerary generator |
   | Checklists | 14 packing, travel and relationship templates |
   | Content | 8 legal and marketing pages, 6 blog posts, 14 FAQs, 6 testimonials |
   | Platform | 65 settings, 10 email templates, SEO metadata, feature flags |

3. Put the same credentials in your environment as `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`,
   `MYSQL_USER` and `MYSQL_PASSWORD`.

4. If the Node server runs **outside** Hostinger, switch on **hPanel → Databases → Remote MySQL**
   for that server's IP address and use the hostname hPanel shows you.

5. Sign up in the app, then run the last statement in the SQL file with your own email to make
   yourself superadmin:
   ```sql
   UPDATE profiles SET role = 'superadmin' WHERE email = 'you@example.com';
   ```

> MySQL has no Row Level Security. Every couple-scoped query in the application is explicitly
> filtered by `couple_id` / `user_id` in `src/lib/auth.ts` and the server actions, and uploads are
> checked for membership before a file is served.

---

## Environment variables

Copy `.env.example` to `.env.local` (and set the same values in your host):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonicals, sitemap, OG tags, checkout redirects |
| `MYSQL_HOST` / `MYSQL_PORT` | yes | `localhost` on Hostinger, or the Remote MySQL hostname |
| `MYSQL_DATABASE` | yes | `u237845628_Faircouple` |
| `MYSQL_USER` | yes | `u237845628_Faircouple` |
| `MYSQL_PASSWORD` | yes | Set in hPanel → Databases |
| `MYSQL_POOL_SIZE` | optional | Default 8 — keep it low on shared MySQL |
| `AUTH_SECRET` | yes | Signs the session cookie. `openssl rand -hex 32` |
| `UPLOAD_DIR` | yes | Absolute path for photos and booking documents |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | optional | Or set them in Admin → Emails |
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
2. In phpMyAdmin, run:
   ```sql
   UPDATE profiles SET role = 'superadmin' WHERE email = 'you@example.com';
   ```
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

> **Read this first.** Hostinger's *shared* hosting — which is what a `*.hostingersite.com`
> temporary domain points at — runs PHP on LiteSpeed and **cannot execute a Next.js server**. There
> is no configuration that makes it work. You need Node 20 somewhere, and there are two supported
> ways to get it while keeping `grey-opossum-178268.hostingersite.com` as the address:
>
> 1. **Hostinger VPS** (the straightforward option). Run the app there and point the domain at it
>    in hPanel.
> 2. **Any other Node host** (Vercel, Render, Fly, a droplet). Point the domain at it with a CNAME,
>    and switch on **hPanel → Databases → Remote MySQL** for that host's IP so the app can still
>    reach `u237845628_Faircouple`.
>
> The database, mailboxes and DNS stay in hPanel either way.

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

Create `UPLOAD_DIR` once and make it writable by the Node process — it holds every photo and
uploaded ticket:
```bash
mkdir -p /home/u237845628/faircouples-uploads
chown -R $USER /home/u237845628/faircouples-uploads
```

### Automated deploys

`.github/workflows/deploy.yml` builds on every push to `main`, then rsyncs the build to your server
and reloads PM2. Add these repository secrets to switch the upload on (without them the workflow
still builds and type-checks, and simply skips the upload):

| Secret | Example |
| --- | --- |
| `SSH_HOST` | `123.45.67.89` |
| `SSH_USER` | `root` |
| `SSH_KEY` | Private key with access to the server |
| `SSH_PORT` | `22` (optional) |
| `SSH_PATH` | `/var/www/faircouples` (optional) |

CI runs typecheck, lint and build on every push (`.github/workflows/ci.yml`).

---

## Scheduled jobs

`GET /api/cron?job=all` with `Authorization: Bearer $CRON_SECRET` runs:

- `trip-reminders` — emails both partners 14, 7 and 1 days before departure
- `weekly-reports` — Monday fairness report to both partners
- `expire-invites` — marks stale invitations expired

- `purge-tokens` — clears expired sessions and one-time auth tokens

`.github/workflows/cron.yml` calls it daily at 08:00 UTC and weekly on Mondays. A Hostinger cron
job calling the same URL works identically:

```
0 8 * * *  curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://grey-opossum-178268.hostingersite.com/api/cron?job=all"
```

---

## Storage & files

Photos, chat images, avatars and uploaded booking documents are written to disk under `UPLOAD_DIR`,
outside the web root, in `<bucket>/<couple_id>/<user_id>/<file>`.

- `POST /api/upload` accepts one file per request. It builds the object path from the **session**,
  never from anything the browser sends, and checks the plan's storage quota before writing.
- `GET /api/files/<bucket>/<path>` streams a file back. For `couple-media` and `documents` it
  first confirms the caller is a live member of the couple whose id is in the path (or a platform
  admin). `avatars`, `blog` and `site` are public.
- Path traversal is rejected in `src/lib/storage.ts`; every resolved path must sit inside the
  upload root.

Back up `UPLOAD_DIR` alongside the database — the rows in `media_assets` and `travel_documents`
point at these files.

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
│   ├── api/               Checkout, webhooks, upload, files, contact,
│   │                      newsletter, cron
│   ├── actions/           Server actions (auth, couple, join, fairness, entries,
│   │                      money, travel, vault, account, assessment, billing, admin)
│   ├── og/                Dynamic OpenGraph image
│   ├── sitemap.ts robots.ts
├── components/            ui/ · marketing/ · app/ · admin/ · analytics · providers
├── lib/                   db · session · auth · storage · queries · fairness ·
│                          assessment · itinerary · payments · email · settings ·
│                          seo · currency · plans · utils
└── types/
database/mysql/            faircouples-mysql.sql — schema + all seed data
.github/workflows/         ci · deploy · cron
```

---

## Security model

- **Every couple-scoped query is filtered by `couple_id` in application code.** MySQL has no Row
  Level Security, so the server actions and `src/lib/auth.ts` carry that responsibility: a couple's
  data is reachable only by its two live members and by platform admins. Private entries are
  visible only to their author, and still count in that author's own trends.
- **Passwords are bcrypt hashes** (12 rounds). Sessions are HS256 JWT cookies (httpOnly, SameSite
  Lax, Secure in production) whose `sid` claim points at a row in `sessions`, so changing a
  password, suspending an account or deleting it revokes every device immediately.
- **One-time tokens are stored as SHA-256 hashes**, so a database leak cannot be replayed as a live
  verification or reset link.
- **Storage isolation** — private files live under `<couple_id>/<user_id>/…` outside the web root
  and are served only through `/api/files`, which checks couple membership on every read.
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
