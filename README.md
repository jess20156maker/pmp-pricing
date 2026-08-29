# PMP Sales Pricing Console

A small web app at its own URL that reads website pricing from **Master Data Hub → Websites**
and lets the sales team request changes to it. No Airtable accounts needed — people
sign in with an email address, and what they can do follows from it.

Customers see prices read-only. Staff can request a change. A named approver
decides, and only then does the price actually move.

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
   - `AIRTABLE_REQUESTS_TABLE` — the Price Change Requests table
   - `APPROVER_EMAILS` — who may approve, comma separated

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
- **Change who can approve** — `APPROVER_EMAILS`. Takes effect immediately.
- **Change who counts as staff** — `STAFF_EMAIL_DOMAINS`. Everyone else is a
  read-only customer.
- **Restrict to a subset of sites** — set `AIRTABLE_VIEW` to an Airtable view name or ID.

## Signing in

There is no sign-in wall. Anyone who opens the link sees the price list
read-only, straight away — customers never meet a login screen. Staff sign in
from **Sign in** in the header, or by clicking any price, which prompts
for a work email and then returns them to the cell they clicked.

## Who can do what

| Signing in as | Role | Can |
|---|---|---|
| not signed in | Customer | View sites and prices. Nothing else. |
| any other domain | Customer | The same |
| `@postmarketpublishing.com` | Sales | View everything, and request a price change |
| ...and listed in `APPROVER_EMAILS` | Approver | Approve or reject requests, and edit directly |

Roles are decided server-side on every request from `STAFF_EMAIL_DOMAINS` and
`APPROVER_EMAILS`, never from anything the browser sends. Removing someone from
`APPROVER_EMAILS` takes effect on their next request, not when their cookie
expires.

`/api/sites` is readable without a session and treats anyone unauthenticated
as a customer. That is deliberate: the email was never verified, so it gated
nothing — it only labelled who made a change. Customers are restricted on the
server, not merely in the UI: `/api/sites` sends them only the website, name,
DR, niche, URL and prices. Site status,
brand, project, agency, VIP and allocation never leave the server.
`/api/price` and `/api/requests` reject them outright.

**`PMP Agency Allocation Sales List` is the sellable inventory.** Customers and
sales only ever receive sites with it ticked; an approver sees every site, so
they can still price something outside the allocation. Sales cannot raise a
request against a site they were not sent, even by supplying its record id.

`Sellable` is deliberately not used as the gate — it is blank on most records,
which showed an empty grid.

## The approval flow

1. Sales click a price and enter a new one. This writes a row to **Price Change
   Requests** with status Pending. The Websites table is untouched.
2. Staff see a banner with the number waiting. An approver opens it and gets
   Approve / Reject on each.
3. On approval the app writes the price, stamps `Date Last Manual Update`, and
   appends to **Pricing Change Log** — exactly what the old direct edit did.
4. The request is then marked Approved with who decided it and when.

The price is applied *before* the request is marked approved. If the write to
Airtable fails, the request stays Pending rather than being marked done with no
price change behind it. Deciding an already-decided request is rejected, so a
double click cannot apply a change twice.

An approver editing a price directly skips the queue — they would only be
approving their own request otherwise.

## Known gaps (deliberate, for now)

- **Email addresses are not verified, and there is no password.** Anyone can type
  an `@postmarketpublishing.com` address and get staff rights, or an approver's
  address and approve their own request. The approval trail records what was
  typed, not who someone is. This is a deliberate trade for zero-friction access;
  if it needs to become real, reinstate the emailed six-digit sign-in code — it is
  in the git history at commit `967615a`, and only the sign-in step would change.
- Approver notification is in-app only. There is no email or Slack alert; an
  approver sees the banner when they open the console.
- No bulk edit yet.
- The second rate card (the sheet tab with the `New` flag and `DA` column) is not in
  Airtable, so it is not in this app either.
- Best-seller groupings and the customer guidelines block are not in Airtable either.
