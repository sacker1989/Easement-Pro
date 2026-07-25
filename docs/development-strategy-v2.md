# Development Strategy v2 — LA County Property Easement & Advocacy Tool

This section replaces the original "Development Strategy (Antigravity Agent Roles)"
section of the Foundational Roadmap. It reflects everything decided in the working
spec sessions since the original roadmap was written, and is structured to be handed
to Claude Code as a build brief for a Phase 1 (LA County) MVP.

---

## Agent Roles

### 1. Research Agent — Data Infrastructure

**Original mandate:** Map APIs for LA County GIS and the Registrar-Recorder.

**Updated mandate:** Own document retrieval infrastructure end to end — not a single
county integration, but the full data-sourcing strategy across Phase 1 and Phase 2.
For MVP, address/APN query accepts **any U.S. address**, not just LA County —
document retrieval succeeds where data permits and falls back to jurisdiction-
appropriate guidance everywhere else (see below).

**Key tasks:**
- Evaluate and pilot data vendors against a 20–30 parcel hand-verified test set:
  **First American DataTree** (primary candidate — direct-from-county document
  images), **ATTOM Data Solutions** (parcel/ownership enrichment), **Cotality**
  (formerly CoreLogic — enterprise fallback), **Regrid** (parcel/zoning/GIS layer).
- Build the **county coverage matrix**: tag each county as (a) full document image
  access via vendor, (b) index-only — routes to the fallback-guidance flow, or
  (c) no coverage — manual guidance only.
- For LA County specifically (Phase 1 MVP), hardcode the fallback-path reference
  data as static content, since no vendor fully solves pre-2009 document retrieval:
  - Recorder office locations, hours, and search rooms (Room 2207 for 1958–present,
    Room LL001 for 1850–1957, Norwalk HQ)
  - Copy fee schedule ($6 first page / $3 additional for certified copies; free
    first conformed copy)
  - Grantor/Grantee index structure (separate pre-1973, combined with asterisk
    marking grantees from 1973 on)
  - Mail request address and process
- Own the **APN/address resolution** layer — the entry point for both LA County
  and future nationwide search.

**Deliverable for MVP:** A parcel/document-lookup service that, given **any U.S.
address**, either returns a retrievable document or routes the user into a
fallback flow. For non-LA-County addresses in MVP, the fallback flow does not
need full jurisdiction-specific instructions (that level of detail is Phase 2's
county coverage matrix work) — it needs to clearly tell the user their address
is outside this MVP's detailed coverage, point them to the general path (county
recorder's office, name-based index search, title company), and route them into
Track 3 (risk disclosure) using whatever parcel-level data is available
nationally, since Track 3 doesn't require the recorded document image itself to
produce useful output.

---

### 2. Compliance Agent — California Legal Standards

**Original mandate:** Audit all generated correspondence templates against
California property law standards for "Notice" and "Quiet Enjoyment."

**Updated mandate:** Retains the original core function for Phase 1, expanded to
cover everything the Advocacy Wizard now actually does.

**Key tasks:**
- Audit every letter template (Property Findings Report, Request for Clarification,
  Maintenance Request Letter) against CA standards for legal notice sufficiency,
  quiet enjoyment, and — critically — **Business & Professions Code §6400 et seq.
  (Legal Document Assistant)**, since paid, document-specific correspondence
  generation is the feature most exposed to UPL risk.
- Own the **confidence-tier legal rule set** for California: what makes a duration
  determination "Clear" vs. "Likely, with caveat" vs. "Flagged — Ambiguous" under
  CA easement law specifically. This rule set is what the Analysis Layer's gating
  logic actually executes against.
- Maintain and version the disclaimer language across all three touchpoints
  (checkout, letter footer, send screen) — single source of truth, reused verbatim,
  not re-paraphrased per surface.
- Review the Attorney Review Add-on partnership structure (referral vs. in-house)
  to confirm it doesn't itself create an unintended attorney-client relationship
  or licensing issue.

**Deliverable for MVP:** A signed-off template library (Property Findings Report,
Request for Clarification, Maintenance Request Letter) plus the CA-specific
ambiguity rule set encoded as gating logic, plus finalized disclaimer copy.

---

### 3. UX Agent — Interface & Risk Communication

**Original mandate:** Simplify the "easement decoder" interface so a layperson
without legal training can interpret the risk assessment.

**Updated mandate:** Same core goal, now scoped to a larger, more specific set of
interface requirements that emerged from the confidence-tier and gating decisions.

**Key tasks:**
- Build the **three-state confidence UI** (Clear / Likely with caveat / Flagged —
  Ambiguous) so ambiguous findings are visibly different from confirmed ones, never
  presented as a false binary.
- Build the **Track 3 risk-disclosure card**: lot diagram, restriction checklist
  (fencing / additions / pool / landscaping), and the three-part economic impact
  panel (lost buildable area, value range at risk, rework cost) with the
  "How we calculated this" expandable methodology panel. The economic panel
  carries a **data-coverage confidence label** (e.g., "Verified against LA
  County reference data" vs. "Based on national estimates, not locally
  verified") — reuse the existing Clear / Likely / Flagged confidence pattern
  rather than building separate geographic gating logic. This ships nationwide
  from day one; the label is the only thing that changes by location, not
  feature availability.
- Build the **Advocacy Wizard gating UX**: per-field blocking (not whole-document
  blocking), the "Request for Clarification" fallback offer when a needed field is
  flagged, and the escape-hatch messaging so users aren't dead-ended.
- Build the **three disclaimer touchpoints** (checkout checkbox, letter footer with
  attorney-review status line, non-dismissible send-screen banner) using the
  finalized copy from the Compliance Agent — UX owns placement and interaction,
  not wording.
- Build the **non-Tier-A state messaging**: when a query resolves to an address
  outside California (or any future Tier A state), the Advocacy Wizard (Track 1)
  is not offered. Instead, the UI explains — in plain language, not just a
  disabled button — that generating document-specific correspondence in this
  state requires a level of legal review this platform hasn't yet completed for
  that state, and directs the user to Track 2 (Request for Clarification) and
  Track 3 (risk disclosure), plus a general "find an attorney in your state"
  link. This should read as an honest capability boundary, not an error or a
  paywall.
- Ensure "Send without review" (the opt-in decline path) is a real, unshamed,
  equally-weighted option next to "Add attorney review" — no dark patterns.

**Deliverable for MVP:** Functional screens for: address search → document
retrieval/fallback → Analysis Layer results (confidence-tiered) → Track 3 report →
Advocacy Wizard (gated) → checkout → letter delivery, all carrying correct
disclaimer states.

---

### 4. NEW — Licensing & State Compliance Agent

**Why this role didn't exist in the original doc:** The original roadmap was
scoped entirely to LA County / California, so ongoing multi-state legal tracking
wasn't yet a problem. Once Phase 2 (nationwide data) and Phase 3/4 (nationwide
Analysis Layer and Advocacy Wizard) enter scope, UPL and non-attorney
document-preparation law becomes a **50-state, continuously-changing surface**,
not a one-time audit — California's LDA statute does not exist in most other
states, and the rules that do exist vary widely and change over time.

**Important framing note:** Stronger disclaimer language does **not** expand
where Track 1 can legally operate. Unauthorized practice of law is a licensing
and, in many states, criminal question — it turns on whether a non-attorney
performed a reserved activity for compensation, not on whether the user was
warned or consented. A disclaimer reduces reliance/negligence exposure; it does
not cure a UPL violation. This agent's job is therefore not "write stronger
warnings for stricter states" — it's classifying states into structurally
different regimes and gating the product accordingly.

**Mandate:** Own and maintain a living, versioned compliance map of what this
product is legally permitted to do, state by state, and gate feature rollout
against it — this is an ongoing operational function, not a launch checklist.

**The three-tier state model:**

| Tier | Definition | Track 1 status | Examples (verify current status before use — laws change) |
|---|---|---|---|
| **Tier A — Licensed non-attorney pathway exists** | State has a formal certification/licensing program for non-attorney document preparation (e.g., CA's LDA statute, AZ's Certified Legal Document Preparer / Legal Paraprofessional license) | Available, structured through the applicable licensing relationship — company or a specific certified individual must hold or partner under the license, a disclaimer alone does not satisfy this | California, Arizona |
| **Tier B — Scrivener exception / gray zone** | Some non-lawyer document preparation is informally tolerated case-by-case, but boundaries are untested against a fee-charged, AI-generated product specifically | Available **only** with mandatory (not opt-in) attorney review before send, until case-by-case legal clearance is obtained for that state | Florida, North Carolina, Hawaii, Nevada, Missouri, and similar — confirm per state |
| **Tier C — Explicit restriction or prohibition** | State law restricts or bars non-attorney legal document preparation broadly | Unavailable. Track 2 (Request for Clarification) and Track 3 (risk disclosure) remain available, since they carry materially lower UPL exposure | Texas, Louisiana, Connecticut, New Mexico, New Hampshire, South Dakota, New Jersey, and similar — confirm per state |

**Key tasks:**
- Maintain the **state compliance matrix** above as a living document: for each
  state, its tier, the specific statute/program it's based on, whether Track 2 is
  clear at its current scope, and date of last legal review. Every entry needs
  sign-off from actual counsel in that state before it moves a state into Tier A
  or B — this list is a starting hypothesis from general research, not a legal
  determination.
- **Gate feature availability by state** in the product configuration as a
  three-value enum per state (A / B / C), not a binary allowlist — Track 1's
  required flow (licensed-pathway vs. mandatory-review) differs between Tier A
  and Tier B, so the gating logic needs to branch on tier, not just on/off.
- For Tier A states, own the actual licensing relationship (in-house certified
  preparer, or partnership with a certified individual/firm in that state) —
  this is a business/legal setup task, not something the disclaimer or UX layer
  can substitute for.
- For Tier B states, own the mandatory-attorney-review partner relationship,
  distinct from the opt-in Attorney Review Add-on used in Tier A.
- Own re-review triggers: any state law change, any state moving tiers, and
  periodic re-review of already-classified states (laws change, and an informal
  Tier B tolerance can tighten without warning).
- Maintain the audit trail linking every sent letter to the tier and compliance
  basis active at generation time — if a state's tier changes later, you need to
  know what was true when a specific letter went out.
- Liaise with the Compliance Agent (Phase 1/CA-specific) as the Tier A pattern
  gets replicated to each new state added to that tier.

**Deliverable for MVP:** A state-tier configuration table (Phase 1 ships with
California as the only Tier A entry with Track 1 enabled; all other states
default to Track 2/3 only until individually classified and legally reviewed),
plus the schema for how tier + required-flow (licensed-pathway vs.
mandatory-review) plugs into the gating logic UX already owns.

---

## Phase 1 MVP Build Scope (for Claude Code)

Suggested build order — each step should be independently testable before moving
to the next:

1. **Address/APN resolution + LA County document retrieval or fallback routing**
   (Research Agent scope) — including hardcoded LA County fallback reference data.
2. **Analysis Layer with three-state confidence tiering**, CA rule set only
   (Compliance Agent scope for rules, engineering for implementation).
3. **Track 3 risk-disclosure report** (safest, no-letter-generation feature —
   good first vertical slice to prove the full pipeline end to end). **Available
   nationwide in MVP, always free — no payment path exists for this feature.**
   The economic-impact panel's dollar estimates use the same national FHFA/NAHB
   data sources everywhere, but carry a data-coverage confidence label
   distinguishing "verified against LA County reference data" from "national
   estimate, not locally verified" — this is a labeling task, not a geographic
   feature gate, so no location-based branching is needed for this feature.
4. **Track 2 Request for Clarification letter** — no gating required, lowest risk,
   good second slice. **Available nationwide in MVP, always free — no payment
   path exists for this feature.**
5. **Advocacy Wizard with per-field gating** (Track 1) — built against the
   tier-based schema from the start (tier enum + required-flow branching), even
   though Phase 1 MVP only populates California as Tier A. Building the schema
   correctly now avoids a rework when Tier A/B states are added later. **Track 1
   is the only feature with a payment path in MVP, and is the only feature
   restricted to California.**
6. **Checkout, disclaimer touchpoints, opt-in Attorney Review Add-on (Tier A
   flow), and mandatory Attorney Review flow (Tier B flow, structurally present
   even if no Tier B state is enabled yet)**. Checkout only appears in the Track 1
   flow — Track 2 and Track 3 have no checkout entry point anywhere in the
   product, by design, not just by default configuration.

**Explicitly out of scope for Phase 1 MVP:** legal classification of any state
beyond California (the Tier A/B/C matrix is a hypothesis pending real counsel
review per state — no state beyond CA should be enabled for Track 1 until that
review is done), any paid tier for Track 2 or Track 3 in any state, jurisdiction-
specific fallback instructions for counties outside LA County (non-LA addresses
get general guidance, not the detailed fee/hours/address-level detail LA County
has), any vendor integration beyond what's needed to prove the LA County
pipeline (full vendor evaluation is a Phase 2 activity), and the
Portfolio/Professional pricing tier.
