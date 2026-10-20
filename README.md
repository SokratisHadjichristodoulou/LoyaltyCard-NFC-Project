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
- Host-agnostic: deploys to Vercel or Cloudflare (via `@opennextjs/cloudflare`)

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

In **Authentication → Emails → Magic Link**, change the link in the template so
it also works when the email is opened on a different device or browser:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

The default template also works, but only in the same browser that asked for
the link. Supabase's built-in email sender only allows a few emails per hour;
set up a custom SMTP provider under **Authentication → Emails** before going
live.

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

### Database tests

`supabase/tests/rls.test.sql` proves the access rules: it signs in as
different customers, staff and admins and checks what each can read and
write. `supabase/tests/stamps.test.sql` proves the stamping rules: cooldown,
coupon at 10, the card starting again, and that only the server can stamp.
`supabase/tests/redeem.test.sql` proves redeeming: only real staff of the
same cafe, once only, never an expired coupon.
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
- `/login/check-email`: "check your email" screen.
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

Both pages check the role again on the server. `/admin` is a placeholder for now.

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

- Logo: `public/logo.png` (currently a placeholder; replace with the real logo,
  square, at least 256×256).
- Colors: taken from the logo (deep reddish-brown `#3a1609` and warm gold
  `#d6a24e` on cream). Tokens live at the top of `src/styles/globals.css`;
  components only use these tokens.
- Type: Piazzolla (headings) and Commissioner (text), both with Greek support.

## Still mocked or missing

| What                                              | Comes in                  |
| ------------------------------------------------- | ------------------------- |
| NFC tap verification: stamps come from the dev-only test button for now | `feat/tag-verification` |
| Admin dashboard and export (`/admin` is a placeholder) | `feat/admin-dashboard` |
| Customer display name: no screen to set it yet, so the greeting has no name | later step |
| Custom SMTP for sign-in emails                    | before launch             |
| Real logo file                                    | when provided             |
| Mock data and preview bar (dev only, `MOCK_DATA=1`) | removed in a later step |

## Project structure

```
public/                 logo.png, robots.txt (disallow all)
references/             design screenshots (not deployed)
scripts/test-db.sh      migrations + RLS tests on a throwaway Postgres
src/
  proxy.ts              session refresh, /staff and /admin protection
  app/
    page.tsx            customer card
    coupon/             free-coffee coupon
    how-it-works/       how the card works
    login/              magic-link sign-in and "check your email"
    auth/callback/      where the magic link lands
    logout/             sign out
    not-allowed/        shown for the wrong role
    tap/                opened by the NFC tag, verifies and stamps (later)
    staff/              coupon scanner and redeem (protected)
    admin/              dashboard (protected, placeholder)
    api/redeem/         redeem a coupon (staff only)
    api/                stamp, export (later)
  components/           (staff/: QR scanner, redeem button)
  lib/
    supabase/           clients (user, service role) and database types
    auth.ts             current user, profile, role checks
    card-data.ts        loads the customer's card (database or mock)
    nfc/                tag signing and verification (later)
    coupons.ts          coupon QR code
    coupon-code.ts      reading a code from a scan or typed input
    stamping.ts         adds a stamp through record_stamp
    mock-data.ts        dev-only preview states
  i18n/                 el.json, en.json
  styles/               global styles
supabase/
  migrations/           schema and RLS, in order
  seed.sql              the cafe and its rules
  tests/                RLS and stamping tests, helpers, plain-Postgres stand-in
```

## Branch workflow

`main` is the live version and only receives merged, tested code. Nobody
pushes to `main` directly and nobody force-pushes.

Each step gets its own branch, merged into `main` through a pull request
once it is tested:

| Order | Branch                   | Scope                                              |
| ----- | ------------------------ | -------------------------------------------------- |
| 1     | `feat/landing-page`      | Front end with mock data: card, coupon, how it works, EL/EN |
| 2     | `feat/database-auth`     | Supabase schema, RLS, magic-link sign-in, protected areas |
| 3     | `feat/tag-verification`  | Signed NFC tag URLs, `/tap` route, stamp API       |
| 4     | `feat/customer-coupon`   | Stamping rules, coupon issuing, real QR codes      |
| 5     | `feat/staff-scanner`     | `/staff` scanner and redeem API                    |
| 6     | `feat/admin-dashboard`   | `/admin` stats, customers, tags, export            |

Every pull request runs CI (`.github/workflows/ci.yml`): typecheck,
production build, and the database migrations and RLS tests. Merge only when
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
| `NFC_TAG_SECRET`                 | Signs and verifies NFC tag URLs (later step)      |
| `TEST_DATABASE_URL`              | Throwaway Postgres for `npm run test:db` (not used by the app) |

`NEXT_PUBLIC_*` values are built into the app, so set them before
`npm run build`.
