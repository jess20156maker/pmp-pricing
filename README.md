# PMP Sales Pricing Console

A small web app at its own URL that reads website pricing from **Master Data Hub → Websites**
and lets the sales team edit it. No Airtable accounts needed — people sign in with
their work email and a six-digit code.

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
   - `SESSION_SECRET` — run `openssl rand -hex 32` and paste the result
   - `ALLOWED_EMAIL_DOMAINS` — e.g. `postmarketpublishing.com`
   - `RESEND_API_KEY` and `MAIL_FROM` — free account at resend.com, verify your
     sending domain. Leave both blank at first: the sign-in code is printed to the
     Vercel function log instead, so you can test before touching DNS.

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
- **Change who can sign in** — `ALLOWED_EMAIL_DOMAINS` / `ALLOWED_EMAILS`. Removing
  someone takes effect on their next request, not when their cookie expires.
- **Restrict to a subset of sites** — set `AIRTABLE_VIEW` to an Airtable view name or ID.

## Testing before email is set up

Set `SETUP_MODE=true` and leave `RESEND_API_KEY` blank. The sign-in code is then shown
on screen instead of being emailed, and the page says so in red. This lets you test the
whole flow — sign in, filter, edit a price, check the audit record in Airtable — before
touching DNS.

While it is on, anyone on the allowlist can sign in as anyone else on it. Set it back to
`false` before sales use the app. It is ignored entirely once `RESEND_API_KEY` is set.

## How sign-in works

- Someone enters their work email. If it's on an allowed domain, a six-digit code is
  emailed to them; if it isn't, the response looks identical, so the page can't be used
  to work out who has access.
- The code is derived from the email and the current ten-minute window using
  `SESSION_SECRET` — it is never stored. That means no database, and it works on
  serverless where each request can hit a different instance.
- After verifying, a signed cookie holds their email for 30 days.
- **`Changed By` is read from that cookie server-side.** The browser never sends a name,
  so nobody can attribute a price change to a colleague.

## Known gaps (deliberate, for now)

- A code is valid for its whole ten-minute window rather than being single-use. Fine
  for a code that only ever reaches the owner's inbox; if you want strict single-use,
  that needs a store (Vercel KV) and stops being free.
- No bulk edit yet.
- The second rate card (the sheet tab with the `New` flag and `DA` column) is not in
  Airtable, so it is not in this app either.
- Best-seller groupings and the customer guidelines block are not in Airtable either.
