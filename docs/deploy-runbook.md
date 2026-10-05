# Deploy runbook — free tier, California

**Status as of 2026-10-05: clear to deploy.** Verified against a real production
build and server, not inferred. See "What was actually tested" at the bottom.

This repository has no hosting configuration and no deploy credentials in it,
deliberately — nothing here can push to a live host on its own. The steps below
are what a person with access runs.

---

## 1. What you are deploying

The free analysis. A homeowner enters an address and an easement type and gets:

- the county parcel record, where one matches
- what is restricted on the easement area, and what is usually fine
- **who is responsible for what** — maintenance, repair, restoration after work
- **how long it lasts**, where they can tell us what their document says
- **what should be on record and often isn't**, led by the exposure that runs
  against them
- a rough order-of-magnitude range, with its arithmetic shown and its method's
  own rejection stated
- what a good appraiser or attorney produces, so they can judge a quote

No account, no payment surface, nothing sent on anyone's behalf.

## 2. Environment

Required: **none.** The free tier runs with no configuration at all.

| Variable | Set it when | Effect if unset |
|---|---|---|
| `AUDIT_LOG_PATH` | before the letter surfaces are relied on | `/advocacy` and `/inquiry` load and then refuse to produce their document, with an explanation. `/report` is unaffected. |
| `ENABLE_OPERATOR_PAGES` | **never on a public host** | `/readiness` returns 404. This is the correct state. |
| `STRIPE_SECRET_KEY` | not while free | unused; commerce is disabled in code, not by config |

### `AUDIT_LOG_PATH` on a serverless host

A file path is **not sufficient** on Vercel, Lambda or Cloud Run. The filesystem
is ephemeral: writes succeed, nothing errors, and every record is gone at the
next cold start. Replace the adapter in `src/lib/compliance/audit-store.ts` with
a database-backed one — the `AuditStore` interface exists so that is a drop-in.

Leaving it unset on serverless is **safe**: the store is marked non-durable and
the artefact surfaces refuse rather than silently losing records.

### `ENABLE_OPERATOR_PAGES`

Must equal exactly `1` to open. `/readiness` publishes server filesystem paths,
every open compliance gap in full, and every accepted-risk rationale — including
that Track 1 operates without a counsel opinion, in the product's own words.
Read that information by running the test suite instead.

## 3. Deploy

```bash
npm ci && npm run build && npm start
```

Any host that runs a Next.js 14 app server works. For Vercel specifically, see
the Vercel section below — it has two serverless-specific caveats.

**Do not run `npm run build` while a dev server is running** — the build writes
into `.next` and corrupts the dev server's chunks. Stop it first.

## 4. Post-deploy smoke test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/readiness
```

Expect `200` and **`404`** respectively. A `200` on `/readiness` means
`ENABLE_OPERATOR_PAGES` is set and the deploy is publishing the compliance gap
registry — unset it immediately.

Then load a report and confirm the sections are present:

```
/report?submitted=1&street=100+Main+St&city=Los+Angeles&state=CA&zip=90049&easementType=sewer&legalCharacter=appurtenant
```

## 5. What is open, and why none of it blocks

| Item | Why it ships |
|---|---|
| Disclaimer is `placeholder-v2` | Substance is right — not an attorney, not legal advice, homeowner is author and sender. Counsel sign-off is a precondition for taking money, not for operating free. |
| CA rule set unreviewed | By design now. Document observations run; doctrine questions return an advisory — the general rule plus the question for an attorney, never a determination. |
| `CA-TRACK1-UNREVIEWED` | Track 1 runs on a dated, recorded risk acceptance. The gate consults the review, finds none, and is overridden by a named decision rather than by nobody checking. |
| Screening bands uncited | Accepted on the record. Output is a range with its arithmetic beside it and four easement types refused outright. |

A §6125 opinion closes the first three at once. Nothing waits on it.

## 6. What was actually tested

Against `next build` + `next start`, NODE_ENV=production, nothing configured:

| Route | Result |
|---|---|
| `/` | 200 |
| `/report` (full params) | 200 — all six sections render, advisory present, **no server paths in the HTML** |
| `/analyze` | 200 |
| `/readiness` | **404** — gate holds at runtime |
| `/inquiry` | 200, document withheld with the audit explanation |
| `/checkout` | 200, free-mode message |

1039 tests across 72 files, `tsc` clean, build clean.

---

# Vercel

`vercel.json` sets the framework and security headers. Next.js App Router needs
no build configuration beyond that.

```bash
vercel link        # once, to connect the repo to a project
vercel --prod      # deploy
```

Or connect the GitHub repo in the Vercel dashboard and let pushes to `master`
deploy themselves.

## Environment variables to set in Vercel

**None.** Set nothing and the free tier works correctly. Every variable that
exists defaults to the right behaviour on Vercel — one of them must stay unset,
and the site origin derives itself from Vercel's own environment.

### `SITE_URL` — leave it unset unless you add a custom domain

Vercel injects `VERCEL_PROJECT_PRODUCTION_URL`, and the app builds the origin
from it, so canonical metadata and `robots.txt`'s `Sitemap:` line are correct
with nothing configured. Set `SITE_URL` only when a custom domain should be the
canonical one; a trailing slash is stripped for you.

It is deliberately **not** `NEXT_PUBLIC_SITE_URL`. That prefix inlines the value
at build time, so setting it on a live project does nothing until a redeploy —
silently. `robots.txt` and `sitemap.xml` are `force-dynamic`, so the value is
read per request and takes effect immediately.

The app uses the PRODUCTION url rather than `VERCEL_URL`: the latter is unique
per deployment, so every preview would publish a sitemap advertising itself as
the authoritative copy of the site.

### `AUDIT_LOG_PATH` — leave it unset on Vercel

Vercel's filesystem is ephemeral. A file path here would mean writes succeed,
nothing errors, and every audit record is lost at the next cold start — a
silent total loss of exactly the records that exist to stay answerable.

Unset, the store is marked non-durable, `/advocacy` and `/inquiry` load and then
refuse to produce their document with an explanation, and `/report` is
unaffected. That is the correct state for a Vercel deploy of the free tier.

To turn the letter surfaces on later, replace the adapter in
`src/lib/compliance/audit-store.ts` with a database-backed one — Vercel Postgres,
Neon, whatever — and point it at that. The `AuditStore` interface exists so this
is a drop-in. **Do not** set a file path and assume it works.

### `ENABLE_OPERATOR_PAGES` — never set it on the production project

`/readiness` publishes server paths, every open compliance gap and every
accepted-risk rationale. Unset, it returns 404. Verified at runtime in both
states, not merely at build: the page is `force-dynamic` so the gate is
evaluated per request rather than baked in by whichever environment ran the
build.

## Two things that bite on serverless specifically

### 1. Function timeout versus the fetch budget — needs a Pro plan

County lookups run through `resilient-fetch.ts`: three attempts with backoff,
25-second total ceiling, because county ArcGIS services are intermittently slow
and the retries are what make them usable.

`/report` declares `maxDuration = 30` so the function outlives that budget.
**Vercel Hobby caps functions at 10 seconds and ignores the value.** On Hobby, a
slow county lookup is killed mid-retry and the homeowner sees a failure for a
request that would have succeeded.

On Hobby, either upgrade or lower `totalBudgetMs` in `resilient-fetch.ts` to
around 8 seconds and accept that slow counties fail faster.

### 2. The concurrency limiter is per-instance — partly addressed

`resilient-fetch.ts` holds a module-level cache (60s TTL) and a per-host
concurrency limiter (4 concurrent). Both are singletons **within one Node
instance**, so on Vercel the limiter is 4-per-instance rather than 4 globally.
Twenty warm instances can mean up to eighty concurrent requests at LA County.

**What was fixed (2026-10-05): in-flight request coalescing.** Identical
concurrent GETs now share one origin call instead of each making their own. The
cache only ever helped the request *after* one completed; it said nothing about
the ones already in the air, so a burst of users on the same ZIP produced a
burst of identical county requests. Ten simultaneous callers now produce one.

That cuts origin traffic by whatever share of load is duplicate, which for a
free tool whose users cluster on popular ZIP codes is most of it — and it works
across the fan-out, since each instance independently dedupes its own burst.

**What is still true.** A genuine global concurrency cap needs shared state and
is not pretended at. If traffic grows enough that coalescing is not sufficient,
the fix is a shared cache in front of the county calls — Vercel KV, Redis, or
Next's Data Cache — not a smaller per-instance limit, which cannot help.

Watch for it: `f.stats()` reports `{ hits, misses, retries, coalesced }`.
Rising `misses` with flat `coalesced` and `hits` means instances are cold and
each is doing its own work — that is the signal to add the shared cache.

## Post-deploy smoke test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/readiness
```

`200` then **`404`**. A `200` on `/readiness` means `ENABLE_OPERATOR_PAGES` is
set on the project — remove it and redeploy.

---

# Watching it once it is live

Every upstream call writes one JSON line to stdout, which Vercel, Cloud Run and
any container platform already collect and parse into structured fields:



 is one of , , ,
.  is ,  or .

**What to watch.** This product degrades politely at every upstream — a county
lookup that fails falls back to national benchmarks and says so, a FEMA outage
drops the flood panel. That is right for the homeowner and invisible to you. If
San Diego started refusing every query, the product would keep serving plausible
reports built on national averages and nobody would notice for weeks.

So the signal is a **rising  or  rate for one **, not
an error count — there will be no errors.

**No address is ever logged, and that is structural rather than a convention.**
The geocoder is called with the user's address in the URL, so an upstream error
message routinely quotes it.  is a closed union rather than a
string, which means  does not compile. There is no ZIP field
either — county answers every operational question this is for.

 lines come from the error boundary and carry only
Next's digest hash, for correlating with a stack trace in the platform's own
error reporting.
