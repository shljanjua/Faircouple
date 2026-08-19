# FairCouples

A relationship fairness platform for couples and families. Both partners answer for
themselves — privately, from wherever they are — and the app compares the two sides and
reports whether the effort, respect and loyalty are actually balanced. It also decides
whether a relationship is running on love or on attraction, splits money fairly, plans
trips, and keeps every ticket and booking in one place.

**Built to run on Hostinger shared hosting.** Pure PHP and MySQL. No Node.js, no VPS, no
SSH, no build step, no Composer. You upload files and import one SQL file.

---

## What you actually upload

Only the **`public_html/`** folder. Its contents go into your hosting account's
`public_html`.

```
public_html/          ← upload the CONTENTS of this folder
├── index.php             front controller — every page routes through here
├── .htaccess             routing, HTTPS, security headers
├── file.php              serves private uploads after checking session + couple
├── cron.php              the scheduled jobs
├── webhook-stripe.php    Stripe events
├── webhook-paypal.php    PayPal events
├── assets/               CSS, JS, icons
├── storage/uploads/      uploaded tickets and photos (must be writable)
└── app/
    ├── config.php        THE ONLY FILE YOU EDIT
    ├── core/             database, auth, storage, mail, payments, SEO
    ├── domain/           fairness scoring, love-vs-attraction, itineraries
    ├── pages/            one file per URL
    └── views/            layouts and partials
```

> **Ignore `src/`, `package.json`, `next.config.mjs`, `node_modules/` and the other
> Next.js files in this repository.** They are from an earlier version and are not used
> by the running site. Do not upload them. Nothing outside `public_html/` and
> `database/` is needed to run FairCouples.

---

## Install — about fifteen minutes

### 1. Create the database

hPanel → **Databases → MySQL Databases**. Create a database and a user, and note the
password — it is the only thing you cannot look up again later.

The app ships pointed at database `u237845628_Faircouple` with user
`u237845628_Faircouple`. If yours are named differently, that is fine; you will set them
in step 3.

### 2. Import the schema and content

hPanel → **Databases → phpMyAdmin** → select your database → **Import** → choose
`database/mysql/faircouples-mysql.sql` → **Import**.

That one file creates all 65 tables and fills them with everything the site needs to
work on day one:

| | |
|---|---|
| 10 fairness areas, 30 behaviours | the full checklist, with each area's "Fair Rule" |
| 30 emotions | for the daily check-ins |
| 4 plans, 27 prices | across USD, GBP, EUR, CAD and AUD |
| 45 countries, 54 destinations, 33 attractions | the travel catalogue and itinerary source |
| 14 packing checklists | flights, honeymoon, ski, beach, road trip and more |
| 8 legal pages, 6 blog posts, 14 FAQs, 6 testimonials | real content, editable in the admin panel |
| 10 email templates, 65 settings | signup confirmation, invites, resets, receipts |

The import is safe to run twice — re-importing updates the seed rows instead of
duplicating them. It works on both MySQL 8 and MariaDB.

### 3. Edit `app/config.php`

This is the only file you touch. In hPanel → **Files → File Manager**, open
`public_html/app/config.php` and set four things:

```php
'db' => [
    'name'     => 'u237845628_Faircouple',   // your database name
    'user'     => 'u237845628_Faircouple',   // your database user
    'password' => 'the password from step 1',
],

'site_url' => 'https://your-domain.com',     // no trailing slash

'app_key'     => 'sixty or more random characters',
'cron_secret' => 'another random string',
```

Leave `'host' => 'localhost'` alone — that is correct on Hostinger.

### 4. Open your site

Visit your domain. If anything is missing, you get a **setup page** that checks each
requirement in turn — PHP version, the MySQL connection, whether the tables imported,
whether the upload folder is writable — and tells you which one failed. It never prints
your password. Once every check passes, the setup page disappears on its own.

### 5. Create your admin account

Sign up through the site normally, then in phpMyAdmin → **SQL**:

```sql
UPDATE profiles SET role = 'superadmin' WHERE email = 'you@your-domain.com';
```

Sign out and back in. **Admin panel** now appears in your account menu.

> Prefer not to use the signup form? `database/mysql/create-admin.sql` creates a
> superadmin directly — edit the email and paste a bcrypt hash of your password, then
> run it in phpMyAdmin.

> **If a page shows an "Unknown column" error** (e.g. `disabled_at`), an earlier import
> was partial and the schema is out of date. Run `database/mysql/reset.sql` to drop every
> table, re-import `faircouples-mysql.sql`, and you are back to a clean, correct schema.
> `reset.sql` deletes all data, so only use it on a fresh install.

### 6. Set up the cron job

hPanel → **Advanced → Cron Jobs**. Add one job, every 15 minutes:

```
curl -s "https://your-domain.com/cron.php?key=YOUR_CRON_SECRET&job=all" > /dev/null
```

Use the same `cron_secret` you set in step 3. This sends the weekly fairness reports,
expires stale invitations and subscriptions, and clears out old sessions.

---

## Then finish it from the admin panel

Everything below is configured at `/admin` — no file editing, no redeploy.

| Screen | What you set |
|---|---|
| **Settings → Brand** | Site name, tagline, description, company details, social profiles |
| **Settings → Currency** | Default currency, which currencies you sell in, tax, trial length |
| **Settings → Accounts** | Open or close signups, require email confirmation |
| **Settings → Analytics** | GA4, Tag Manager, Meta Pixel, Google Ads, AdSense, Clarity, Hotjar, TikTok, Pinterest, LinkedIn, cookie banner |
| **Settings → Features** | Feature flags and maintenance mode |
| **Settings → Security** | Change your admin password; see your active sessions |
| **Email & SMTP** | Your mailbox, all 10 templates, a connection test and a real test send |
| **Payments** | Stripe and PayPal keys, live/test mode, manual bank transfer |
| **Plans & pricing** | Create plans, set every per-feature limit, price them per currency |
| **Coupons** | Percentage or fixed discounts, with expiry and redemption caps |
| **Users / Relationship spaces** | Add, disable or delete any member; remove either partner from a space |
| **Blog / Pages** | Posts and legal pages, each with full SEO fields |
| **FAQ & testimonials** | Feeds the accordion and the FAQPage / Review structured data |
| **Destinations** | The travel catalogue the itinerary generator reads |
| **SEO & redirects** | Per-URL titles and meta, verification tokens, 301s |
| **Inbox & subscribers** | Contact messages with replies, newsletter list, CSV export |
| **Audit log** | Every administrative change, with who and from where |

### Email

Hostinger gives you mailboxes with your plan. hPanel → **Emails → Email Accounts →
Connect Devices** shows your host, port and credentials. Put them into **Admin → Email &
SMTP**, press **Verify connection**, then **Send test**. Until this is done, signup
confirmations, partner invitations and password resets cannot be sent — the admin panel
shows a warning saying so, and every attempt is recorded in the delivery log with the
reason it failed.

### Payments

Register these two webhook URLs so subscriptions activate automatically:

| Provider | URL |
|---|---|
| Stripe → Developers → Webhooks | `https://your-domain.com/webhook-stripe.php` |
| PayPal → Apps → Webhooks | `https://your-domain.com/webhook-paypal.php` |

Both signatures are verified and both handlers are idempotent, so a replayed or repeated
delivery cannot double-charge or double-activate.

---

## What the product does

**The fairness report.** Ten areas, thirty behaviours. Each partner scores their own
effort and their read of their partner's, plus respect, loyalty and satisfaction. The
report gives a balance index, a weighted overall score, a per-area breakdown marked
balanced or tilted, and a plain-language verdict that names who is carrying more. Each
partner can see the other's scores — that is the point — while notes stay private to
whoever wrote them. Every area shows its Fair Rule.

**Love or attraction.** Twenty questions across two axes. Attraction is measured in peaks
(intensity, novelty, jealousy, the highs and lows); love in averages (consistency,
repair after conflict, mutual effort, concrete plans). The result separates
`love_with_spark`, `love`, `infatuation`, `attraction_led`, `balanced` and `early`, and
gives guidance for the one you got. It works without an account, so it can bring people
in from search.

**Compatibility.** Eight dimensions, scored by each partner independently, reported with
the biggest gap called out.

**Money.** Shared budgets, expenses split by share or by income, settlements, gifts and
wishlists. Currency follows the account's country — USD, GBP, EUR, CAD or AUD — and is
also offered on the signup page.

**Travel.** Trips, a day-by-day itinerary generator across three paces, packing lists
from 14 templates, and a document vault for flight, hotel and attraction tickets.
Uploads are stored outside the web root and served only through `file.php` after the
session and couple membership are checked; the real file type is sniffed from content,
never trusted from the browser.

**Private messaging.** Between the two partners only, with photo sharing and emoji, and
new messages arriving without a page refresh.

**One subscription covers both.** When either partner subscribes, both get the full plan.

---

## SEO

- Titles, meta descriptions, canonical URLs and Open Graph on every page, all overridable
  per URL from the admin panel
- 10 JSON-LD schema types: Organization, WebSite, BreadcrumbList, FAQPage, BlogPosting,
  Product, SoftwareApplication, TouristDestination, HowTo and Review
- A sitemap index plus three child sitemaps, updating themselves as you add content
- `robots.txt` generated from your settings, with a one-switch "block all search engines"
  for before launch
- Verification tokens for Google, Bing, Pinterest and Yandex
- 301/302 redirects with hit counts, so you can change a URL without losing its rankings

Submit `https://your-domain.com/sitemap.xml` to Google Search Console and Bing Webmaster
Tools once you are live.

---

## Security

- Passwords hashed with bcrypt at cost 12; sign-in does a constant-time comparison even
  for an unknown address, so it cannot be used to discover who has an account
- Sessions are backed by a database row, so access can be revoked instantly — and is,
  the moment an account is disabled, suspended or deleted
- CSRF token checked on every POST, centrally, before any page code runs
- Every database query is a prepared statement
- MySQL has no row-level security, so every couple-scoped query filters on `couple_id`
  in application code and every mutation checks ownership first
- Uploads live outside the document root behind `Require all denied`, and are reachable
  only through the membership-checked streamer
- Stored content is escaped before the Markdown renderer runs, so a saved page or post
  cannot inject a script
- Payment keys and the SMTP password are write-only: the panel tells you whether one is
  set, never what it is. Your database credentials stay in `app/config.php`, which is
  404ed by `.htaccess` and is deliberately the one thing the admin panel cannot edit
- Analytics and advertising tags wait for consent. Google tags load under Consent Mode v2
  with every storage type denied; the other pixels are not loaded at all until the visitor
  accepts

---

## Requirements

PHP 8.1 or newer with `pdo_mysql`, `curl`, `openssl`, `mbstring` and `fileinfo` — all
standard on Hostinger — and MySQL 8 or MariaDB 10.4+. Nothing else. No Composer, no npm,
no build.

## Troubleshooting

**The setup page keeps showing.** One of its checks is failing; the page names which.
Most often the database password has a typo, or the SQL was imported into a different
database than the one in `app/config.php`.

**Uploads fail.** Set `public_html/storage/uploads` to permission 755 in File Manager.

**No emails arrive.** Admin → Email & SMTP → **Verify connection**. The delivery log at
the bottom of that page records the reason for every failure.

**A page 404s that should not.** Confirm `.htaccess` uploaded — File Manager hides
dotfiles until you enable **Show hidden files**.

**Subscriptions do not activate after payment.** The webhook URL is missing or the signing
secret is wrong. Admin → Payments lists recent deliveries and the error for each.
