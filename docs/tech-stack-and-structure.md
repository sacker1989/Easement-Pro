# Tech Stack & Initial Project Structure — LA County Property Easement & Advocacy Tool

Companion doc to `development-strategy-v2.md`. This maps the stack and folder
structure directly onto the six-step Phase 1 MVP Build Scope so each step can be
built and tested independently.

---

## Suggested Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend/Backend** | Next.js (App Router) + TypeScript | Single framework for both UI and API routes — keeps the MVP simple, and scaffolds reliably |
| **Database** | Postgres (via Prisma ORM) | Needs relational structure for the state-tier config table, parcel/document metadata, and confidence-tier results — not a document-store shape |
| **File storage** | S3-compatible bucket (or Supabase Storage) | Recorded document PDFs and generated letter PDFs |
| **AI Analysis Layer** | Anthropic API (Claude) | Powers metes-and-bounds summarization, confidence-tier classification, and letter generation |
| **Payments** | Stripe | Only wired into the Track 1 flow — no checkout path exists anywhere else per the strategy doc |
| **Deployment** | Vercel (or similar) | Fastest path to a testable, shareable MVP |

---

## Initial Project Structure

```
easement-mvp/
├── docs/
│   ├── development-strategy-v2.md           # source of truth, referenced not duplicated
│   └── tech-stack-and-structure.md           # this file
│
├── prisma/
│   └── schema.prisma                         # Parcel, Document, AnalysisResult,
│                                               # StateTierConfig, Letter, Order models
│
├── src/
│   ├── app/
│   │   ├── search/                           # Step 1: address/APN input + resolution
│   │   ├── results/[parcelId]/               # Step 2: Analysis Layer output display
│   │   ├── report/[parcelId]/                # Step 3: Track 3 risk-disclosure card
│   │   ├── inquiry/[parcelId]/               # Step 4: Track 2 letter flow
│   │   ├── advocacy/[parcelId]/              # Step 5: Track 1 wizard (gated)
│   │   └── checkout/                         # Step 6: Stripe checkout, Track 1 only
│   │
│   ├── lib/
│   │   ├── parcel-resolution/                # address → APN, any US address
│   │   ├── document-retrieval/
│   │   │   ├── la-county-fallback.ts         # hardcoded LA County reference data
│   │   │   └── general-fallback.ts           # non-LA addresses, general guidance
│   │   ├── analysis-layer/
│   │   │   ├── confidence-tiering.ts         # Clear / Likely / Flagged logic
│   │   │   └── ca-rule-set.ts                # California-specific easement rules
│   │   ├── gating/
│   │   │   └── state-tier-config.ts          # Tier A/B/C enum + required-flow branching
│   │   └── letters/
│   │       ├── request-for-clarification.ts  # Track 2 template
│   │       └── maintenance-request.ts        # Track 1 template, CA-gated
│   │
│   └── config/
│       └── state-tiers.ts                    # single populated entry: CA = Tier A
│
└── tests/
    └── fixtures/                              # the 20-30 hand-verified test parcels
                                                # from the Research Agent's pilot task
```

---

## Structural choices worth testing early

- **`state-tiers.ts` is a single, isolated config file on purpose.** Per the
  strategy doc, adding a state later should be a data change there, not a code
  change anywhere else. Worth adding a fake second state during dev and
  confirming nothing else needs to change, before relying on that assumption.
- **`document-retrieval/` is split into `la-county-fallback.ts` and
  `general-fallback.ts` from day one**, matching the strategy doc's explicit
  distinction between LA County's detailed reference data (fees, hours,
  addresses) and the lighter general guidance given everywhere else.
- **`checkout/` is only referenced from the `advocacy/` route tree.** No shared
  checkout component should be imported into `report/` or `inquiry/` — this
  enforces "no payment path exists outside Track 1" structurally, not just by
  convention, so a future contributor can't accidentally wire up checkout on a
  free feature.
