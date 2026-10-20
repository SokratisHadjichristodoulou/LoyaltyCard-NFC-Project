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
- Supabase (database and auth, added in `feat/database-auth`)
- Host-agnostic: deploys to Vercel or Cloudflare (via `@opennextjs/cloudflare`)

## Run locally

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # fill in values when a step needs them
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build   # production build
npm start       # serve the production build
npm run lint    # typecheck
```

## Preview card states

Until the database is connected, all card data comes from
`src/lib/mock-data.ts`. Set `ACTIVE_SCENARIO` to one of the states below, or
add `?state=<name>` to any URL (e.g. `/coupon?state=used`). The dashed
"Preview" bar at the bottom of each page switches between them too.

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
default is the browser language, falling back to Greek; an explicit choice is
saved in the `cp_lang` cookie. All text lives in `src/i18n/el.json` and
`src/i18n/en.json`. Greek is the reference: a key missing from `en.json`
fails the typecheck.

## Brand

- Logo: `public/logo.png` (currently a placeholder; replace with the real logo,
  square, at least 256×256).
- Colors: tokens at the top of `src/styles/globals.css`. Re-derive them from
  the real logo when it is added; components only use these tokens.
- Type: Piazzolla (headings) and Commissioner (text), both with Greek support.

## Mocked for now

| Mocked                                       | Replaced in               |
| -------------------------------------------- | ------------------------- |
| Card, customer and coupon data (`mock-data.ts`) | `feat/database-auth`   |
| Customer identity (always "Μαρία")          | `feat/database-auth`      |
| "Stamp just added" on page open             | `feat/tag-verification`   |
| Placeholder, non-scannable QR               | `feat/customer-coupon`    |
| Coupon status set by hand                   | `feat/staff-scanner`      |
| Fixed goal and expiry rules                 | `feat/admin-dashboard`    |
| Preview bar and `?state=` override          | removed with the mock data |

## Project structure

```
public/                 logo.png, robots.txt (disallow all)
references/             design screenshots (not deployed)
src/
  app/
    page.tsx            customer card
    coupon/             free-coffee coupon
    how-it-works/       how the card works
    tap/                opened by the NFC tag, verifies and stamps
    staff/              coupon scanner (protected)
    admin/              dashboard (protected)
    api/                stamp, redeem, export
  components/
  lib/
    supabase/           Supabase clients
    nfc/                tag signing and verification
    coupons.ts          coupon rules
    mock-data.ts        mock state for the landing page step (removed later)
  i18n/                 el.json, en.json
  styles/               global styles
supabase/migrations/    database migrations
```

## Branch workflow

`main` is the live version and only receives merged, tested code. Nobody
pushes to `main` directly and nobody force-pushes.

Each step gets its own branch, merged into `main` through a pull request
once it is tested:

| Order | Branch                   | Scope                                              |
| ----- | ------------------------ | -------------------------------------------------- |
| 1     | `feat/landing-page`      | Front end with mock data: card, coupon, how it works, EL/EN |
| 2     | `feat/database-auth`     | Supabase schema, customer accounts and sessions    |
| 3     | `feat/tag-verification`  | Signed NFC tag URLs, `/tap` route, stamp API       |
| 4     | `feat/customer-coupon`   | Coupon issuing, real QR codes, expiry              |
| 5     | `feat/staff-scanner`     | `/staff` scanner and redeem API                    |
| 6     | `feat/admin-dashboard`   | `/admin` stats, customers, tags, export            |

Commit messages use a short prefix: `feat:`, `fix:`, `chore:`, `docs:`,
`refactor:`, `style:`, `test:`.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable                         | Used for                                          |
| -------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | Public URL of the site (tag and QR links)         |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase public (anon) key                        |
| `SUPABASE_SERVICE_ROLE_KEY`      | Server-only Supabase key. Never expose to the browser |
| `NFC_TAG_SECRET`                 | Signs and verifies NFC tag URLs                   |
| `COUPON_SIGNING_SECRET`          | Signs coupon QR payloads                          |
| `STAFF_EMAILS`                   | Comma-separated emails allowed into `/staff`      |
| `ADMIN_EMAILS`                   | Comma-separated emails allowed into `/admin`      |
