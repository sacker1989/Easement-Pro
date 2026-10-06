# SafeHomeValue

**A tool to maximize your value and increase your home safety.**

SafeHomeValue is a free proptech analysis tool for homeowners. Enter an
address and get a plain-language report on the easements affecting the
property — what they restrict, who maintains what, and how they bear on the
home's value and safety. No accounts, no email, no payment.

Live: **https://www.safehomevalue.com**

## The two pillars

1. **Homeowner value.** Most homeowners don't know what easements exist on
   their property. The tool surfaces them and explains their valuation impact
   in plain language — including the IRWA-grounded valuation engine wired into
   the report.
2. **Home safety.** Neglected utility-easement maintenance is a real disaster
   risk (the Eaton and Palisades fires are the motivating examples). The
   report includes wildfire and flood vulnerability sections tied to the
   easement types on the parcel, plus who is responsible for maintaining what.

Everything is educational information only — not a survey, not an appraisal,
not legal advice. See `/privacy` on the live site.

## Tech stack

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Vercel** hosting with GitHub auto-deploy; Vercel Analytics
- **Vitest** — 1100+ tests; `npm run typecheck` for `tsc --noEmit`
- No database, no auth, no accounts — reports are generated in the moment

## Repo map

| Path | What lives there |
|---|---|
| `src/app/` | Routes: `/` (address intake), `/report`, `/privacy`, `/learn` |
| `src/lib/easements/` | Easement type taxonomy, restriction data, maintenance-responsibility records |
| `src/lib/valuation/` | IRWA valuation engine and jurisdiction confidence bridge |
| `src/lib/proximity/` | Flood-zone and fire-severity lookups |
| `src/lib/parcel-lookup/` | Parcel resolution and county dispatch |
| `docs/` | Specs and runbooks (historical; the product vision in this README is current) |

## Dev commands

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # production build
```

Pushes to `master` auto-deploy to production via the Vercel GitHub
integration. See `RELEASE_CHECKLIST.md` (when present on a release branch)
for the pre- and post-deploy gates.
