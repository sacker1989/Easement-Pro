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

Any host that runs a Next.js 14 app server works. Vercel needs no config file.

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
