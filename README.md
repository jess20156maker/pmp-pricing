# PMP Sales Pricing Console

A small web app at its own URL that reads website pricing from **Master Data Hub → Websites**
and lets the sales team edit it. No Airtable accounts needed — people sign in with
their work email and a password the team shares.

Every price change writes a record to **Pricing Change Log** and stamps
`Date Last Manual Update` on the website.

## Deploy (about 15 minutes)

1. **Get an Airtable token.** airtable.com/create/tokens → new personal access token.
   Scopes: `data.records:read`, `data.records:write`. Access: the **Master Data Hub** base only.

2. **Push this folder to a private GitHub repo.**

3. **Import it into Vercel** (vercel.com → Add New → Project → pick the repo).
   Framework preset detects Next.js automatically. Don't deploy yet.

4. **Add the environment variables** from `.env.example` in Vercel → Settings →
   Environment Variables. The ones you must set:
   - `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_WEBSITES_TABLE`
   - `SESSION_SECRET` — run `openssl rand -hex 32` and paste the result
   - `ACCESS_PASSWORD` — the password you give the sales team

5. **Deploy.** You get a `*.vercel.app` URL immediately. To use your own domain,
   Vercel → Settings → Domains → add `pricing.postmarketpublishing.com` and follow
   the DNS instructions.

## Running it locally

```
npm install
cp .env.example .env.local     # then fill in the real values
npm run dev                    # http://localhost:3000
```

## How it works

- The Airtable token lives **only** on the server, in Vercel's environment. It is never
  sent to the browser. All Airtable calls go through `/api/*` routes.
- The whole Websites table is fetched once and held in memory for `CACHE_MINUTES`
  (default 5), so filtering and searching are instant and Airtable's rate limit is
  never a problem. "Refresh" forces a refetch.
- Writes are allowlisted server-side: `app/api/price/route.js` will only ever write a
  field listed in `lib/fields.js → PRICE_FIELDS`. Scripts, attachments and every other
  field on Websites are unreachable from this app, whatever the browser sends.
- Records are never created or deleted. The app only patches existing ones.

## Editing the app

- **Add or remove an editable price field** — `lib/fields.js`, `PRICE_FIELDS`.
- **Change which columns show** — `components/Console.js`.
- **Cut off access** — change `ACCESS_PASSWORD` and redeploy. That is the only lever;
  there is no per-person allowlist.
- **Restrict to a subset of sites** — set `AIRTABLE_VIEW` to an Airtable view name or ID.

## How sign-in works

- Someone enters their work email and the shared team password. The email is checked
  for shape only — it is not a credential, and there is no allowlist. It exists so each
  price change can be attributed in the log.
- `ACCESS_PASSWORD` is the only thing gating access.
- The password is compared in constant time and never stored anywhere but the Vercel
  environment. If `ACCESS_PASSWORD` is unset the app fails closed — nobody gets in.
- After signing in, a signed cookie holds their email for 30 days. No database, so it
  works on serverless where each request can hit a different instance.
- **`Changed By` is read from that cookie server-side.** The browser never sends a name,
  so nobody can attribute a price change to a colleague.

## Known gaps (deliberate, for now)

- **Anyone with the password can sign in, using any email address.** There is no
  allowlist and the email is not verified — it only labels changes in the log. Everyone
  shares one password, so change it by hand when somebody leaves. If you later want
  per-person sign-in, the emailed six-digit code version is in the git history at
  commit `967615a`.
- No bulk edit yet.
- The second rate card (the sheet tab with the `New` flag and `DA` column) is not in
  Airtable, so it is not in this app either.
- Best-seller groupings and the customer guidelines block are not in Airtable either.
