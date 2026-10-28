# Coffee Pause Cyprus · Stamp card

A digital stamp card for Coffee Pause Cyprus.

Customers get one stamp per coffee. The barista taps an NFC tag against the
customer's phone, which opens this site and adds a stamp. At 10 stamps the
customer receives a free-coffee coupon with a QR code that staff scan to check
and redeem it.

The site runs on a hidden subdomain of the cafe's domain and is not linked
from the main website. Search engines are blocked by `public/robots.txt`, a
`noindex` meta tag on every page and an `X-Robots-Tag` response header.

## Tech

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase: Postgres with Row Level Security, and Auth (email magic link)
- Hosted on Cloudflare Workers (via `@opennextjs/cloudflare`); the code stays host-agnostic, see Deploying

## Run locally

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values (see below)
npm run dev                  # http://localhost:3000
```

To look at the screens without a database, use the mock data instead:

```bash
MOCK_DATA=1 npm run dev
```

To try stamping and coupons on your own Supabase project before the NFC tags
arrive, sign in and use the test button under the card:

```bash
DEV_STAMPS=1 npm run dev
```

The 3-minute cooldown still applies. For quick testing, lower it with
`update public.cafes set stamp_cooldown_seconds = 0;` and set it back to 180
afterwards.

Other scripts:

```bash
npm run build     # production build
npm start         # serve the production build
npm run lint      # typecheck
npm test          # unit tests (NFC crypto, waiting-tap cookie, migration list)
npm run db:check  # is the Supabase project up to date with the code?
npm run cf:preview # the Cloudflare Workers build, locally (see Deploying)
npm run test:db   # migrations + database tests on a throwaway Postgres (see below)
```

## Supabase setup

Do this once per Supabase project.

### 1. Keys

In the Supabase dashboard, **Project Settings → API**, copy into `.env.local`:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never commit it)

### 2. Run the migrations and the seed

The migrations live in `supabase/migrations/` and run in filename order. Each
one is re-runnable: running it again changes nothing.

With the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --include-seed
```

If the CLI asks for a config file first, run `npx supabase init`; it adds
`supabase/config.toml` and leaves the migrations alone.

Or without the CLI: open **SQL Editor** in the dashboard and run, in order,
each file in `supabase/migrations/`, then `supabase/seed.sql`.

The seed creates the cafe **Coffee Pause Cyprus** (`coffee-pause-cyprus`) with
the default rules: 10 stamps per free coffee, coupons valid for 90 days and a
180-second cooldown between stamps. It contains no customer data.

### 3. Auth settings

In **Authentication → URL Configuration**:

- **Site URL**: the production URL, e.g. `https://card.example.com`
- **Redirect URLs**: add `http://localhost:3000/**` and `https://card.example.com/**`

### 3b. Sign-in emails (Greek and English)

Supabase sends two emails: **Confirm signup** to a new customer and **Magic
Link** to a returning one. Replace both in **Authentication → Emails**:

| Template       | Subject                                                | Body (paste the whole file)            |
| -------------- | ------------------------------------------------------ | -------------------------------------- |
| Confirm signup | `Coffee Pause · Άνοιξε την κάρτα σου / Open your card` | `supabase/templates/confirmation.html` |
| Magic Link     | `Coffee Pause · Σύνδεση / Sign in`                     | `supabase/templates/magic-link.html`   |

Each email is in the customer's language (Greek unless they chose English,
which the site saves for them). Its button links to
`/auth/callback?next=…&token_hash=…&type=email`, so it works on any device and
returns the customer to where they were, including a waiting NFC stamp. For
that, the site's address must be in the Redirect URLs above. The logo is
loaded from `<Site URL>/logo.png`, so the Site URL must be the live address.

Supabase's built-in email sender only allows a few emails per hour; set up a
custom SMTP provider under **Authentication → Emails** before going live.

### 4. Make yourself admin

Sign in once on the site with your email, then run this in the SQL Editor
(replace the email):

```sql
update public.profiles
set role = 'admin', cafe_id = (select id from public.cafes where slug = 'coffee-pause-cyprus')
where id = (select id from auth.users where email = 'you@example.com');
```

Use `role = 'staff'` for baristas. To demote, set `role = 'customer', cafe_id = null`.
Roles can only be changed like this, by the database owner: the app, the
service role and signups can never grant `staff` or `admin`.

## Database

| Table      | What it holds                                                          |
| ---------- | ---------------------------------------------------------------------- |
| `cafes`    | Name, slug and rules (`stamps_required`, `coupon_valid_days`, `stamp_cooldown_seconds`) |
| `profiles` | One per auth user: `role`, `display_name`, `preferred_language`; `cafe_id` for staff and admins. Created automatically at signup |
| `tags`     | NFC tags: `label`, unique `tag_uid`, optional `staff_id`, `active`, `last_counter`. No keys stored |
| `cards`    | One per customer per cafe, with `stamp_count`                          |
| `stamps`   | Audit log of every stamp given                                         |
| `coupons`  | Free-coffee coupons: unguessable `code` (e.g. `CP-7K4Q-29XM-HD3P-WR8N`), `status`, expiry, who redeemed it |

Every table has a `cafe_id` (on `profiles` it is empty for customers), so more
cafes can be added later without a redesign.

### Who can do what (Row Level Security)

RLS is on for every table.

- **Customers** read only their own profile, card, stamps and coupons, and can
  change only their own display name and language.
- **Customers never write** cards, stamps or coupons. The server does those
  writes with the service role.
- **Staff** can look up one coupon by its exact code
  (`find_coupon_for_staff`), for their own cafe only. They cannot list
  coupons. Redeeming happens in a server route that checks their role.
- **Admins** read everything that belongs to their cafe.
- **Signed-out visitors** can read cafe info only.

### Stamps and coupons

All stamping goes through one database function, `record_stamp`, which only
the server (service role) can call. In one transaction it:

1. creates the customer's card if needed,
2. refuses the stamp if the last one was less than `stamp_cooldown_seconds`
   ago (and says how long to wait),
3. logs the stamp in `stamps`,
4. at `stamps_required`, issues a coupon valid for `coupon_valid_days` and
   starts the card again.

The coupon page shows a real QR code. It opens `/staff?code=<code>`, where
staff check and redeem it. The code itself is the secret (16 random
characters), so the QR needs no extra signing.

### Redeeming (staff)

`/staff` is the scanner. Staff can:

- scan the customer's QR with the phone's own camera app: the link opens
  `/staff?code=…` (after signing in, if needed, with the code kept);
- or tap **Open the camera** on `/staff` to scan in the page;
- or type the code.

The page shows whether the coupon is valid, used (and when) or expired. **Redeem
free coffee** posts to `/api/redeem`, which only accepts requests from this
site, checks the user is staff or admin, and calls `redeem_coupon`. That
database function checks the role again, finds coupons only from the staff
member's own cafe, and locks the coupon row, so a coupon is redeemed at most
once even if two baristas press at the same moment.

### NFC taps (NTAG 424 DNA)

The barista taps an NTAG 424 DNA tag on the customer's phone. Every tap the
tag writes a fresh, signed URL:

```
https://card.example.com/tap?e=<encrypted UID + tap counter>&c=<signature>
```

`/tap` decrypts `e` and checks `c` with that tag's own key (NXP's "Secure
Unique NFC" scheme, AN12196), then `consume_tag_tap` accepts the tap only if
its counter is higher than the last one seen. A copied or replayed URL, a
tampered one, an unregistered tag or a deactivated tag is refused with a
clear message in Greek or English. A good tap then goes through `record_stamp`,
which also refuses a second stamp for the same tap.

If the customer isn't signed in, the verified tap waits in a signed,
httpOnly cookie for 15 minutes while they sign in, then becomes their stamp
(`/tap/complete`). If the sign-in link is opened on another device, the
customer is asked for a new tap.

**Keys.** Nothing secret is stored in the database. Every key is derived from
`NFC_TAG_SECRET`: key 1 (decrypts `e`) is shared by all tags, key 2 (checks
`c`) and keys 0, 3, 4 are unique per tag. Changing `NFC_TAG_SECRET` means
reprogramming every tag. The crypto is tested against NXP's published example
and the RFC 4493 vectors (`npm test`).

**Setting up a tag**

1. Put `NFC_TAG_SECRET` (`openssl rand -hex 32`) and the live `NEXT_PUBLIC_SITE_URL`
   in `.env.local`, and the same `NFC_TAG_SECRET` in the host's environment.
2. Read the tag's 7-byte UID with an NFC app (e.g. NXP TagInfo) and add the tag
   in **Admin → NFC tags**.
3. Print its settings: `npm run nfc:keys -- <UID>`. This shows the five keys,
   the URL to write and the SDM offsets.
4. Program the tag with an NTAG 424 tool (e.g. NXP TagXplorer with a USB reader,
   or an Android app that supports NTAG 424 SDM): write the NDEF URL, enable SDM
   with the printed settings, then change keys 1–4 and key 0 last. The exact
   screens depend on the tool.
5. Tap it with a phone: you should land on your card with a new stamp. Tap
   again within 3 minutes: you should see the cooldown message.

Keep the `nfc:keys` output private: anyone with a tag's key 2 could make fake
taps for that tag. If a tag is lost, deactivate it in the admin.

**Simple tags (until there is a USB reader).** Setting up a secure tag needs
a tool that can load keys; a phone app like NFC Tools can't. Meanwhile any tag
can be a simple tag: in **Admin → NFC tags**, press **Use a simple link** and
write the link shown (`https://card.…/t/<token>`) onto the tag with NFC Tools
(Write → Add a record → URL). A tap gives a stamp like any other, with the
cafe's usual wait between stamps. The link never changes, so it could be saved
and opened away from the cafe: use simple tags only until the reader arrives.
If a link leaks, press **Switch to secure** and then **Use a simple link**
again: the old link stops working, and the tag needs the new one written. Once
the tag is programmed as a secure tag, **Switch to secure** is all that's
needed. (`record_simple_stamp`, a one-per-day variant, stays in the database
unused.)

**Testing without a tag.** `npm run nfc:url -- <UID> <counter>` prints a tap URL
exactly as a programmed tag would (the UID must be registered in the admin).
Use a higher counter for each test tap.

### Admin dashboard

`/admin` is for admins only (see "Make yourself admin"). It has four sections:

- **Overview**: customers, stamps today and over 7 days, coupons redeemed out of
  issued, a 30-day stamps-per-day chart (hover a bar for the number, or open the
  table under it) and the latest activity.
- **Customers**: every customer with a card, with search, current and lifetime
  stamps, active and used coupons, and last visit. Export customers or the last
  90 days of stamps as CSV (opens in Excel, Greek included).
- **NFC tags**: add a tag by name and UID (colons and lower case are cleaned
  up), and deactivate one that gets lost. The NFC step uses these tags.
- **Settings**: stamps for a free coffee, how long coupons last, and the wait
  between stamps. Changes apply to the next stamps and new coupons.

Reports come from database functions (`admin_stats`, `admin_customers`,
`admin_activity`, `admin_stamp_log`) that return only the caller's own cafe
and only to admins. Tag and settings changes are server actions that check
the admin role and then write with the service role, limited to that cafe.

### Database tests

`supabase/tests/rls.test.sql` proves the access rules: it signs in as
different customers, staff and admins and checks what each can read and
write. `supabase/tests/stamps.test.sql` proves the stamping rules: cooldown,
coupon at 10, the card starting again, and that only the server can stamp.
`supabase/tests/taps.test.sql` proves tap counters and one stamp per tap.
`supabase/tests/delete-account.test.sql` proves deleting an account removes all
of the customer's data. `supabase/tests/migrations.test.sql` proves the
migration record, including that a skipped migration is not recorded.
`supabase/tests/redeem.test.sql` proves redeeming: only real staff of the
same cafe, once only, never an expired coupon. `supabase/tests/admin.test.sql`
proves the admin reports: right numbers for the admin's cafe, and nothing for
staff, customers, signed-out visitors or admins of other cafes.
`npm run test:db` runs every migration twice (to prove they are
re-runnable), then the seed and the tests, on a throwaway database. It runs in
CI on every pull request.

To run it locally you need `psql` and a Postgres you can throw away (never the
Supabase project):

```bash
docker run -d --name cp-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
```

`supabase/tests/supabase-stub.sql` stands in for the parts of Supabase a plain
Postgres doesn't have (the API roles and `auth.uid()`). It is only for tests.

## Sign-in

- `/login`: email form. Supabase emails a magic link; there are no passwords.
- `/login/check-email`: "check your email" screen, with a box for the 6-digit
  code from the email. Typing the code signs in on the page the customer is
  already on (where the tag opened), even if their email app would open the
  link in a browser of its own (e.g. Gmail). The email templates show the code
  (`{{ .Token }}`), so paste the updated templates into Supabase after a change.
- `/auth/callback`: where the link lands. It signs the customer in and
  returns them to the page they were trying to open.
- `/logout`: confirms, then signs out.

On first visit the customer's card row is created, and `/` shows the real card
from the database. All of these screens are in Greek and English, including
the errors.

`src/proxy.ts` keeps the session fresh and guards the protected areas:

| Path      | Who may open it | Signed out         | Wrong role                 |
| --------- | --------------- | ------------------ | -------------------------- |
| `/staff`  | staff, admin    | redirect to login (keeps `?code=`) | "not allowed" page (403) |
| `/admin`  | admin           | redirect to login  | "not allowed" page (403)   |

Both areas check the role again on the server.

## Privacy and accounts

- `/privacy`: the privacy notice in Greek and English. It covers what is
  kept, why (GDPR legal bases), the cookies (only essential ones, so no consent
  banner), who sees the data, how long it is kept, and the customer's rights,
  including the Cyprus data protection commissioner.
  **Before launch, fill in the business's legal name, address and contact email
  in `src/lib/cafe-info.ts`.** Until then the page shows "[to be completed]".
  Have the text checked by someone who knows your obligations; it describes
  what the app does, but it is not legal advice.
- `/account` (signed in): set or change your name (used in the greeting),
  download everything kept about you as JSON (`/api/account/export`), and
  delete your account. Deleting removes the sign-in account, and with it the
  profile, card, stamps and coupons (proved in
  `supabase/tests/delete-account.test.sql`). Staff and admin accounts are
  removed by the owner instead (demote with SQL, then they can delete).

## Preview card states (mock data)

With `MOCK_DATA=1 npm run dev`, card data comes from `src/lib/mock-data.ts`
instead of the database. It only works on the dev server and is ignored in
production builds. Set `ACTIVE_SCENARIO` there, add `?state=<name>` to a URL
(e.g. `/coupon?state=used`), or use the dashed "Preview" bar at the bottom of
each page.

| State      | What you see                              |
| ---------- | ----------------------------------------- |
| `new`      | Empty card, 0/10                          |
| `progress` | 4/10, the newest stamp animates in        |
| `almost`   | 9/10                                      |
| `complete` | 10/10, celebration, valid coupon          |
| `used`     | Fresh card (1/10), coupon marked as used  |
| `expired`  | 2/10, coupon marked as expired            |

## Languages

Greek and English, switched with the EL / EN toggle in the header. The
default is the browser language, falling back to Greek. A choice is saved in
the `cp_lang` cookie and, when signed in, on the profile. All text lives in
`src/i18n/el.json` and `src/i18n/en.json`. Greek is the reference: a key
missing from `en.json` fails the typecheck.

## Brand

- Logo: `public/logo.png`, the real Coffee Pause logo: 512×512, round, with
  transparent corners (it is also the browser icon and the logo in the emails).
- Colors: taken from the logo (deep reddish-brown `#3a1609` and warm gold
  `#d6a24e` on cream). Tokens live at the top of `src/styles/globals.css`;
  components only use these tokens.
- Type: Piazzolla (headings) and Commissioner (text), both with Greek support.

## Still mocked or missing

| What                                              | Comes in                  |
| ------------------------------------------------- | ------------------------- |
| Programming and testing real NTAG 424 tags on iPhone and Android | when the tags arrive |
| Mock data and preview bar (dev only, `MOCK_DATA=1`) | removed in a later step |

## Project structure

```
public/                 logo.png, robots.txt (disallow all)
references/             design screenshots (not deployed)
wrangler.jsonc          Cloudflare Workers config
open-next.config.ts     Cloudflare adapter config
scripts/test-db.sh      migrations + database tests on a throwaway Postgres
scripts/nfc-keys.ts     prints one tag's keys and SDM settings (npm run nfc:keys)
scripts/nfc-tap-url.ts  makes a test tap URL (npm run nfc:url)
scripts/db-check.ts     checks the database has every migration (npm run db:check)
src/
  proxy.ts              session refresh, /staff and /admin protection
  app/
    page.tsx            customer card
    coupon/             free-coffee coupon
    how-it-works/       how the card works
    login/              magic-link sign-in and "check your email"
    auth/callback/      where the magic link lands
    logout/             sign out
    privacy/            privacy notice
    account/            name, download my data, delete account
    api/account/export/ "download my data" (JSON)
    api/health/         200 when the database is reachable and up to date
    not-allowed/        shown for the wrong role
    tap/                opened by the NFC tag: verifies and stamps; complete/ after sign-in; problem/
    staff/              coupon scanner and redeem (protected)
    admin/              dashboard: overview, customers, tags, settings (protected)
    api/redeem/         redeem a coupon (staff only)
    api/export/         CSV export (admins only)
  components/           (staff/: QR scanner, redeem button; admin/: nav, tiles, chart, forms)
  lib/
    supabase/           clients (user, service role) and database types
    auth.ts             current user, profile, role checks
    cafe-info.ts        legal details for the privacy page (fill in before launch)
    admin.ts            data for the admin pages
    card-data.ts        loads the customer's card (database or mock)
    nfc/                NTAG 424 SUN verification, key derivation, waiting-tap cookie
    coupons.ts          coupon QR code
    coupon-code.ts      reading a code from a scan or typed input
    stamping.ts         adds a stamp through record_stamp
    mock-data.ts        dev-only preview states
  i18n/                 el.json, en.json
  styles/               global styles
supabase/
  migrations/           schema and RLS, in order
  seed.sql              the cafe and its rules
  templates/            sign-in emails (Greek and English) to paste into Supabase
  tests/                RLS and stamping tests, helpers, plain-Postgres stand-in
```

## Deploying

The site is hosted on **Cloudflare Workers** (via `@opennextjs/cloudflare`):
the free plan allows commercial use. Live at
`https://loyaltycard.coffeepause.app`. Each merge to `main` deploys
automatically through GitHub Actions (`.github/workflows/deploy.yml`).

One caveat: the adapter marks Next.js "proxy" (our `src/proxy.ts`) as
experimental on Workers. Every flow passed in Cloudflare's local runtime
(`npm run cf:preview`); after the first deploy, run the checks below on the
live site too.

### Before the first deploy

1. Do the **Supabase setup** above, including the email templates, and run
   `npm run db:check`.
2. Choose the subdomain, e.g. `card.coffeepause.com.cy`. The domain's DNS
   must be on Cloudflare (free): Cloudflare dashboard → **Add a domain**, then
   change the nameservers at your registrar to the two Cloudflare shows.
3. Have these values ready: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL` (`https://card.coffeepause.com.cy`), `NFC_TAG_SECRET`,
   and `CAFE_SLUG` if not the default. Don't set `MOCK_DATA` or `DEV_STAMPS`.

### Automatic deploys (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main` (and by hand from
**Actions → Deploy → Run workflow**): typecheck, unit tests, then
`npm run cf:deploy` to the Worker `coffee-pause-card` (must match `name` in
`wrangler.jsonc`). Pull requests never deploy.

The site URL, Supabase URL and Cloudflare account ID are in the workflow. In
GitHub, **Settings → Secrets and variables → Actions → New repository
secret**, add:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token from the "Edit Cloudflare
  Workers" template, limited to this account and the `coffeepause.app` zone
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the Supabase `anon` key

On the Worker in Cloudflare (set once, kept by every deploy):

- **Settings → Variables and Secrets**: `SUPABASE_SERVICE_ROLE_KEY`,
  `NFC_TAG_SECRET` (and `CAFE_SLUG`, if used), each as type **Secret**.
  Plain-text variables set here would be replaced by `wrangler.jsonc` on the
  next deploy.
- **Settings → Domains & Routes**: the custom domain
  `loyaltycard.coffeepause.app`.

From then on, merging a pull request into `main` is a release.

Deploying by hand instead (needs Node 22 and the values in `.env.local`):
`npx wrangler login`, `npx wrangler secret put <NAME>` for each secret, then
`npm run cf:deploy`.

To try the Workers build locally first, put the same values in `.dev.vars`
(git-ignored) and run `npm run cf:preview` (http://localhost:8787). CI builds
the Workers bundle on every pull request.

The code itself isn't tied to Cloudflare: importing the repo on Vercel works
too (env vars in its settings), but its free Hobby plan is non-commercial
only.

### After the first deploy

1. Supabase → Authentication → URL Configuration: **Site URL** = the live
   address, and add `https://card.…/**` to **Redirect URLs**.
2. Open `https://card.…/api/health`: it must say `{"status":"ok"}`. Point an
   uptime monitor at it.
3. Check `https://card.…/robots.txt` says `Disallow: /`.
4. Sign in with your own email, make yourself admin, open `/admin`.
5. When the NFC tags arrive, program one and tap it with an iPhone and an
   Android phone.

Every response carries `noindex` and security headers (no framing, no MIME
sniffing, strict referrer, camera allowed only for the staff scanner, HTTPS
only).

## Releasing a change

The code and the Supabase project change separately. Merging into `main`
deploys straight away, so do these in order, steps 1 and 2 before merging:

1. **Database first**: if the pull request adds files to `supabase/migrations/`,
   run `npx supabase db push` (old migrations are skipped, new ones run), then
   `npm run db:check`; it must say "Database is up to date".
2. **Settings**: add any new environment variables the pull request lists
   (`.env.local` locally, and on the Worker in Cloudflare).
3. **Then merge**: the Deploy workflow deploys the new `main` (watch it under
   **Actions**).

New code against an old database fails (e.g. stamping or the admin pages).
Each pull request ends with an "After merge" list of exactly these steps.

The app also checks this itself. The database records each migration that has
run (`private.applied_migrations`), and the code knows which ones it needs
(`src/lib/migrations.ts`):

- `npm run db:check` says what is missing (exit code 1) or that all is well.
- `GET /api/health` returns 200 when the database is reachable and up to date,
  503 with the missing migrations otherwise. Point an uptime monitor at it.
- Every admin page shows a red warning while migrations are missing.

**Writing a new migration:** add it to `EXPECTED_MIGRATIONS` in
`src/lib/migrations.ts`, and end the file with
`insert into private.applied_migrations (version) values ('<version>') on conflict do nothing;`.
`npm test` fails if either is forgotten.

## Branch workflow

`main` is the live version and only receives merged, tested code. Nobody
pushes to `main` directly and nobody force-pushes.

Each step gets its own branch, merged into `main` through a pull request
once it is tested:

| Order | Branch                   | Scope                                              |
| ----- | ------------------------ | -------------------------------------------------- |
| 1     | `feat/landing-page`      | Front end with mock data: card, coupon, how it works, EL/EN |
| 2     | `feat/database-auth`     | Supabase schema, RLS, magic-link sign-in, protected areas |
| 3     | `feat/tag-verification`  | NTAG 424 tap verification, `/tap`, tag tools       |
| 4     | `feat/customer-coupon`   | Stamping rules, coupon issuing, real QR codes      |
| 5     | `feat/staff-scanner`     | `/staff` scanner and redeem API                    |
| 6     | `feat/admin-dashboard`   | `/admin` stats, customers, tags, export            |

Every pull request runs CI (`.github/workflows/ci.yml`): typecheck, unit
tests, production build, the Cloudflare Workers build, and the database
migrations and tests. Merge only when
it is green.

Commit messages use a short prefix: `feat:`, `fix:`, `chore:`, `docs:`,
`refactor:`, `style:`, `test:`.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable                         | Used for                                          |
| -------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | Public URL of the site, used in sign-in links. Optional locally |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon / publishable key                   |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service_role / secret key. Server only, never exposed to the browser |
| `CAFE_SLUG`                      | Which cafe this site serves. Defaults to `coffee-pause-cyprus` |
| `MOCK_DATA`                      | `1` to preview mock card states on the dev server |
| `DEV_STAMPS`                     | `1` to show the "Add a test stamp" button on the dev server |
| `NFC_TAG_SECRET`                 | Every NFC tag key is derived from it. Server only; `openssl rand -hex 32` |
| `TEST_DATABASE_URL`              | Throwaway Postgres for `npm run test:db` (not used by the app) |

`NEXT_PUBLIC_*` values are built into the app, so set them before
`npm run build`.
