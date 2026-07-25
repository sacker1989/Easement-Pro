# Easement Pro

**LA County Property Easement & Advocacy Tool — Phase 1 MVP**

Easement Pro helps a property owner understand what easements exist on their
land, how much risk those easements carry, and — where the platform is legally
able to — generate correspondence to act on that information. Phase 1 ships as
an LA County–focused MVP with a nationwide address-intake path, built to
expand state-by-state without a rework of the core gating logic.

---

## How the product is organized

The app is structured around three "tracks," each with a different risk
profile and a different payment status:

| Track | What it does | Availability | Payment |
|---|---|---|---|
| **Track 3 — Risk Disclosure** | Lot diagram, restriction checklist, and economic-impact estimate (lost buildable area, value at risk, rework cost) | Nationwide | Free |
| **Track 2 — Request for Clarification** | Generates a clarification letter, no legal gating required | Nationwide | Free |
| **Track 1 — Advocacy Wizard** | Generates document-specific correspondence (e.g. Maintenance Request Letter), gated per field | **California only** in MVP | Paid — the only checkout path in the product |

Track 1 is restricted to California because it's the only state currently
classified as **Tier A** (licensed non-attorney pathway exists) in the state
compliance matrix at `src/config/state-tiers.ts`. Every other state defaults
to Track 2/3 only until it's individually reviewed by counsel — see
[`docs/development-strategy-v2.md`](docs/development-strategy-v2.md) for the
full three-tier model (A / B / C) and the reasoning behind it.

For the full product/legal strategy and the six-step MVP build scope, read:

- [`docs/development-strategy-v2.md`](docs/development-strategy-v2.md) — agent roles, state-tier model, build order, and explicit out-of-scope items
- [`docs/tech-stack-and-structure.md`](docs/tech-stack-and-structure.md) — stack rationale and folder-to-feature mapping

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) 14 (App Router) + TypeScript |
| UI | React 18 |
| Payments | [Stripe](https://stripe.com) — wired into the Track 1 flow only |
| Testing | [Vitest](https://vitest.dev) |
| Deployment target | Vercel (or similar) |

> Note: `docs/tech-stack-and-structure.md` also specifies Postgres (via
> Prisma) and S3-compatible file storage for parcel/document data. Those
> aren't wired up in the codebase yet — check current `package.json` and
> `prisma/` before assuming they're live.

---

## Project structure

```
Easement-Pro/
├── docs/
│   ├── development-strategy-v2.md      # product & legal strategy, source of truth
│   └── tech-stack-and-structure.md     # stack rationale, folder-to-feature map
│
├── src/
│   ├── app/
│   │   ├── search/                     # Step 1: address/APN input + resolution
│   │   ├── analyze/                    # Analysis Layer output display
│   │   ├── report/                     # Step 3: Track 3 risk-disclosure report
│   │   ├── inquiry/                    # Step 4: Track 2 clarification letter flow
│   │   ├── advocacy/                   # Step 5: Track 1 wizard (gated, CA only)
│   │   └── checkout/                   # Step 6: Stripe checkout — Track 1 only
│   │
│   ├── lib/
│   │   ├── parcel-resolution/          # address → APN
│   │   ├── document-retrieval/         # LA County fallback + general fallback data
│   │   ├── analysis-layer/             # confidence-tiering (Clear/Likely/Flagged), CA rule set
│   │   ├── gating/                     # state-tier config + required-flow branching
│   │   ├── letters/                    # letter templates (clarification, maintenance request)
│   │   ├── checkout/                   # Stripe payment provider
│   │   ├── compliance/                 # disclaimer + compliance logic
│   │   ├── risk-disclosure/            # Track 3 report logic
│   │   └── valuation/                  # economic-impact estimates
│   │
│   └── config/
│       └── state-tiers.ts              # state compliance matrix — CA is the only Tier A entry
│
└── tests/ (via vitest)
```

---

## Getting started

### Prerequisites

- Node.js (version matching `next@14` / `typescript@5.5` requirements — Node 18+ recommended)
- npm

### Setup

```bash
git clone https://github.com/sacker1989/Easement-Pro.git
cd Easement-Pro
npm install
```

### Environment variables

Create a `.env.local` file in the project root:

```bash
STRIPE_SECRET_KEY=sk_test_...
```

`STRIPE_SECRET_KEY` powers the Track 1 checkout flow
(`src/lib/checkout/stripe-payment-provider.ts`). It's optional for working on
anything outside `checkout/` or `advocacy/`.

### Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Other scripts

```bash
npm run build       # production build
npm run start        # run the production build
npm run test          # run the vitest suite once
npm run test:watch    # run vitest in watch mode
npm run typecheck     # tsc --noEmit
```

---

## Working on this repo

A few structural rules the codebase depends on — see
`docs/tech-stack-and-structure.md` for the full reasoning:

- **`src/config/state-tiers.ts` is the single source of truth for state
  gating.** Adding a state should mean adding an entry there, not touching
  gating logic elsewhere.
- **`checkout/` is only ever referenced from the `advocacy/` route tree.**
  Track 2 and Track 3 have no checkout entry point anywhere in the product,
  by design — don't wire up payment on a feature that's supposed to be free.
- **`document-retrieval/` is split into LA-County-specific and general
  fallback logic** — keep that distinction rather than merging them, since
  LA County ships with detailed reference data (fees, hours, addresses) that
  no other county has yet.

## License

Private / all rights reserved (update this section once a license is decided).
