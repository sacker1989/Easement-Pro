# Go-to-market: targeting, advertising, and what we may not say

**Status: draft for review. Not approved for spend.** Section 8 lists the gates that must clear
before the first dollar goes out. One of them is counsel review, which the product itself is still
waiting on — `CURRENT_DISCLAIMER` is `placeholder-v2` with `needsComplianceSignOff: true`.

**Revised 2026-10-04 for FREE MODE.** The product now takes no money and offers no paid tier
pending counsel review (`src/lib/compliance/commerce-mode.ts`). That is not a temporary note on an
otherwise unchanged plan — it changes the funnel, the channel economics and what section 9 was
waiting to learn. Sections 6, 8 and 9 are rewritten; the segment analysis in section 2 survives
intact and is, if anything, better supported.

---

## 1. The constraint that shapes everything else

The product cannot tell a homeowner what their easement is worth. This is not a gap to be closed by
more engineering; it is the finding. The Uniform Appraisal Standards for Federal Land Acquisitions
§4.6.5 measures a permanent easement as the value of the whole property before minus the remainder
after, and it rejects every shortcut that could be computed from data — percentage of fee, customary
going rates, and valuing the encumbered strip on its own. `encumbrance-factors.ts` ships empty for
exactly this reason.

**So the single highest-converting message available to us is one we are not allowed to use.**
"Find out what your easement is worth" would be a false claim, and in a category where the answer
requires a licensed appraiser it is a false claim with a regulator attached.

Three regimes bear on the copy, not one:

| Regime | What it reaches | Consequence |
|---|---|---|
| FTC Act §5 | Deceptive or unsubstantiated advertising claims | Substantiation must exist *before* the claim runs |
| State appraisal licensing | Holding out as providing valuation services | Varies by state; California is not permissive |
| LDA registration — Cal. Bus. & Prof. Code §6400 et seq. | Providing or **offering** self-help service **for compensation** | Registration and bonding. **Free mode removes the compensation element, so this no longer applies** |
| UPL — Cal. Bus. & Prof. Code §6125 / §6126 | Practising law without a licence, **payment irrelevant** | Misdemeanour. Free mode does **not** touch this, and it is now the live question |

The marketing therefore has to say something true. There is something true and it is worth having:
**the product answers "what can I do with my land, and what does the record actually say" faster
than any alternative, and it packages evidence so the professional you eventually hire starts from
something.**

**The §6400 / §6125 split is the most important line in this table and it is new.** Free mode
removes the compensation element from the LDA definition, which takes registration and bonding off
the table. It does nothing to §6125, which prohibits practising law without a licence whether or not
anyone pays. So the copy constraint has not relaxed — it has moved. The question is no longer "may we
sell this" but "is what we produce the practice of law at all", and every claim in section 5 is now
judged against that rather than against a licensing question that free mode already answered.

---

## 2. Segments, ranked by fit rather than by size

### A. Blocked mid-project — *the wedge*

A homeowner who has designed a pool, an ADU, an addition, or a fence, and has just been told by a
contractor, an architect, or a permit counter that an easement is in the way.

- **Urgency:** high. There is money already committed and a decision pending this week.
- **Search intent:** explicit. They type the question.
- **What they need:** exactly what we produce — which activities are restricted, how big the
  easement is, what the county records.
- **Claims risk:** low. No valuation, no legal conclusion, no adversary.
- **Live data fit:** good. LA, Orange and San Diego are the three counties wired, and they are dense
  with exactly this remodel activity.

**This is the segment to launch on.** It is the only one where the product's honest output is also
the thing the customer wants.

### B. Recently notified of an acquisition — *the trap*

A homeowner who received an offer or a notice from a DOT, a utility, or a pipeline operator.

- **Urgency:** highest. **Willingness to pay:** highest.
- **And the product cannot give them what they want**, which is a number to push back with.

Chasing this segment first is the obvious commercial mistake. The ad that converts them is the ad we
may not run, and the ones who buy anyway arrive expecting a valuation and receive a list of things
we could not determine. That is a refund, a review, and — if the copy implied a number — a
complaint.

Serve them later, positioned honestly as *preparation for the appraiser and attorney you are about
to need*, once there is a referral network to hand them to. Not at launch.

### C. Recent buyer / in escrow

Found an easement on the title report or the plat and does not know what it means.

- Moderate urgency, high volume, low price tolerance. Good content and SEO target; poor paid target.

### D. Visible infrastructure, nothing recorded

The implied-easement case the subagent spec covers. Genuinely interesting, essentially unsearchable —
these people do not know they have a question. Content and partnership only.

---

## 3. Positioning

> **Before you build, find out what is actually on your land.**
> We read your county's own parcel records and tell you what the easement restricts, how much of
> your lot it covers, and what the public record does and does not establish. In minutes, free while
> the service is under legal review.

What that promises is all deliverable today. Note what it does not promise.

**The counter-positioning is the honesty itself.** Every competitor in adjacent categories leads with
a number. We lead with "here is what is knowable, here is what is not, and here is who can answer the
rest." For a homeowner who has already been told three different things by three different people,
that is a differentiator rather than a weakness — and it is the reason the report ends with a
referral package instead of an invoice.

**Free is now part of the positioning rather than a caveat buried in it.** "Free while under legal
review" is an unusual thing to say out loud and it is worth saying: it tells a homeowner the service
is not trying to extract anything from them at the moment they are most anxious, which is precisely
when adjacent categories do extract. State it plainly and do not dress it as a limited-time offer —
that framing implies a price is coming, which is the offer free mode cannot make.

---

## 4. Channels

### 4.1 Search — no longer primary

**Reordered for free mode.** Paid search was ranked first on the assumption that a conversion paid
for the click. With no revenue there is no payback period, only burn, and every click is a cost
against a learning budget rather than an acquisition cost. That does not make it worthless — buying
traffic to find out whether the report lands is a legitimate use of money — but it has to be
budgeted and read as research, with a number set in advance and a question it is meant to answer.
The compounding channels below now carry the launch.

High-intent, low-ambiguity queries. These people are mid-decision:

- `can I build a fence on a utility easement`
- `pool over sewer easement`
- `ADU setback easement [city]`
- `what does a drainage easement mean`
- `easement on my property survey`
- `can I build over a storm drain easement`

Geo-fence to the three live counties at launch. Serving an ad to a Phoenix homeowner and then
telling them we have no county data for Maricopa is money spent to produce a bad impression.

Negative keywords are as important as keywords, and this is a compliance control, not just a
budget one: `easement value`, `easement compensation`, `easement worth`, `eminent domain lawyer`,
`condemnation attorney`, `easement appraisal`. Those queries want the thing we may not sell.

### 4.2 Referral partners — now the primary channel

The people who hit the easement wall *on the homeowner's behalf*, repeatedly, and currently have no
good next step to offer:

- ADU and addition designers, pool builders, fence and deck contractors
- Landscape architects
- Residential surveyors
- Permit expediters

They meet this problem weekly. A tool that resolves it in minutes makes them look competent and
unblocks their own pipeline. This is a warm channel with near-zero CAC and it needs a partner page
and a referral link, not an ad budget.

**Free makes this channel dramatically easier to open, which is why it moves to first.** A
contractor recommending a paid tool is making a referral their client may resent and is implicitly
vouching for the price. Recommending a free one costs them nothing and carries no risk to the
relationship — "there's a free thing that reads your county records, try it before we redesign" is a
sentence they will actually say. The ask also gets simpler: no revenue share to negotiate, no
affiliate terms, no invoice.

### 4.3 The professional side — two-sided

Appraisers and eminent domain attorneys are not competitors here; the product routes work *to* them
and the referral package makes each intake cheaper. A homeowner arriving with the parcel record,
geometry, sources and dates already assembled is a better client than one arriving with a shoebox.

Worth building deliberately, because it also solves segment B: once a referral network exists, the
acquisition-notice homeowner can be served honestly instead of turned away.

### 4.4 Content / SEO — compounding

One page per easement type, per the twelve in `EASEMENT_TYPES`. Each answers the real question
("can I plant a tree over a sewer easement?") and ends in the tool. This is durable, it is cheap,
and it targets segments C and D which paid search cannot reach economically.

---

## 5. Copy: approved, prohibited, and why

### Approved

- "Find out what you can and can't build."
- "See what your county actually records about your lot."
- "Know before you pour concrete."
- "Your easement, in plain English."
- "Get an evidence package ready for an appraiser."
- "We'll tell you what the record doesn't say, too."

### Prohibited — do not run, in any variant

| Claim | Why |
|---|---|
| "Find out what your easement is worth" | We cannot compute it. §4.6.5 forecloses the method. |
| "You may be owed compensation" | Legal conclusion; also matches a forbidden pattern in `appraisal-claim-scan.ts` |
| "Get the compensation you deserve" | Implies advocacy outcome and legal advice |
| "Free easement appraisal" | Appraisal is a licensed activity |
| "Know your rights" | Legal advice framing |
| "Fight your utility company" | Adversarial positioning we cannot support |
| Any specific dollar figure in an ad | Unsubstantiated, and parcel-specific |
| "Pro", "Premium", "upgrade", "coming soon", pricing pages | **New under free mode.** "Offers to provide ... for compensation" is in the §6400(c) definition — advertising a paid tier is the offer free mode exists to avoid |
| A waitlist framed as early access to a paid product | Same reason. "Tell me when this covers my county" is a coverage signal; "join the list for launch pricing" is an offer |

**The scanner is the backstop, and it is now pointed at marketing too.**
`src/lib/marketing/ad-copy.ts` holds the approved and prohibited sets, and its suite runs
`scanForAppraisalClaims()` over both — approved copy must come back clean *with the disclosure
appended*, and every prohibited line must be caught even when the page also carries the disclaimer.
A "not an appraisal" line at the bottom does not license "find out what it's worth" at the top.

**Known gap, stated rather than assumed away.** The scanner covers *valuation and appraisal* claims,
which is what it was built for. Two rows in the table above are a different category — "Fight your
utility company" and "Know your rights" are adversarial-positioning and outcome claims, closer to
ordinary FTC substantiation than to appraisal licensing, and the scanner has no pattern for them.
Adding one to `PROHIBITED_COPY` today makes the suite fail, correctly, because the blocklist would
be naming something the code cannot enforce. Those two rows are therefore **human review items, not
automated ones**, until someone decides whether to widen the scanner's remit or add a second one.
Either is defensible; pretending the table is fully enforced is not.

---

## 6. Funnel — free, with no step five

1. **Ad / partner link** → geo-matched, intent-matched
2. **Landing page per easement type** — the same twelve, so the ad's promise matches the page
3. **Address + easement type** — two fields, no account
4. **The report, free** — restrictions, county parcel record, the screening range, the
   open-questions panel, the remedy plan, the referral package and the letters

**There is no step five, and there must not be an advertised one.** The previous version of this
funnel ended in a paid step. That step is gone, and the reason is not squeamishness: "offers to
provide ... **for compensation**" is in the §6400(c) definition of a legal document assistant. A free
product that advertises a coming paid tier, takes pre-orders, collects a card for later or runs an
"upgrade" call to action is still *offering* to provide for compensation, which is the thing free
mode exists to avoid. `mayOfferPaidTier()` returns the same flag as `COMMERCE_ENABLED` for exactly
this reason.

So: no "Pro" badge, no "coming soon", no waitlist framed as early access to a paid product, no
pricing page. A plain "this is free while under legal review" is fine and is what the product says.

**What this costs, honestly.** The old funnel used the free report to qualify buyers for a paid
artefact. There is no conversion event now, which means no revenue signal and a weaker measure of
intent — "they read the open-questions panel" is softer evidence than "they paid."

**What it buys, which is more than it costs right now.** The strongest objection to the wedge in
section 2A was always price: "can I build here" is worth tens of dollars, not hundreds, and a paid
product in that range has to convert at a rate that leaves no room for a confusing first run. Free
removes that constraint entirely while the report is still being tuned. It also removes refunds,
chargebacks, consumer-protection exposure and the Stripe surface area, none of which were doing any
work for a product this early.

**An email capture is permissible and worth having**, provided it is framed as "tell me when this
covers my county" rather than as a list for a future paid launch. The first is a coverage signal;
the second is an offer.

---

## 7. User test cases across all twelve easement types

These are acceptance scenarios for the funnel, one per `EASEMENT_TYPES` member. The mechanical half
is already automated in `easement-purpose-map.test.ts` (34 tests, every type produces a complete
checklist and a complete report). What follows is the human half: what the user asks, and what a
correct answer looks like.

| # | Type | User arrives asking | A correct outcome |
|---|---|---|---|
| 1 | `utility-overhead` | "Can I build a carport under the power lines?" | Additions restricted; landscaping usually OK; vertical clearance flagged as outside our scope |
| 2 | `utility-underground` | "Can I put a pool where the electric runs?" | Pool restricted; excavation access named as the reason |
| 3 | `sewer` | "Can I plant a tree over the sewer line?" | Landscaping **restricted** — stricter than utility, roots damage the line itself |
| 4 | `storm-drain` | "Can I regrade my back yard?" | Drainage rules; grading change flagged, not just structures |
| 5 | `water-line` | "Can I fence over the water main?" | Utility treatment **plus** a visible unreviewed marker directing them to the water provider |
| 6 | `pipeline` | "Can I plant shrubs over the gas line?" | **All four restricted**, 811 and the operator named. Never the utility answer. |
| 7 | `access-ingress-egress` | "Can I gate my shared driveway?" | Fencing restricted; full-width passability explained |
| 8 | `public-right-of-way` | "Can I extend my porch toward the street?" | Access treatment plus an unreviewed marker pointing at the municipal code |
| 9 | `drainage` | "Can I build a shed in the swale?" | All restricted including landscaping; flow named as the reason |
| 10 | `slope` | "Can I terrace this hillside?" | All restricted, with an explicit statement that no slope rules have been researched |
| 11 | `conservation` | "Can I clear brush on my own land?" | All restricted **and** a statement that the footprint framing does not fit — whole-parcel instrument controls |
| 12 | `prescriptive` | "The neighbour has crossed my lot for years — can I block it?" | All restricted; no instrument exists; existence itself is contested and goes to an attorney |

**Cross-cutting cases** the funnel must also survive:

- **Unsupported county** (e.g. Austin, TX) — must say *no search was performed*, never "no easement
  found". Already enforced by the `unsupported-county` branch and tested.
- **Service outage** — Orange County has returned 503 under load. Must degrade to national
  benchmarks with a notice, not error out.
- **Ambiguous address** — a multi-unit match must ask which parcel, never price an arbitrary
  neighbour.
- **Every path** — the open-questions panel appears, and no dollar figure appears above it.

---

## 8. Gates before any spend

Reordered for free mode. Two of the original gates were about selling and have dissolved; one got
harder to ignore.

1. **Counsel review of the ad copy**, in each state advertised into. Still first, and the question it
   answers has changed: not "may we sell this" but whether the copy describes something that is the
   practice of law under §6125. `COPY_APPROVED_IN_STATES` is a list and it is empty.
2. **~~Confirm the licensing posture for charging~~** — dissolved. Free mode removes the compensation
   element from §6400(c), so LDA registration and bonding do not arise. Recorded rather than deleted
   so the reasoning survives if commerce resumes; `COMMERCE_REENABLE_CONDITIONS` is the list to
   re-read then.
3. **Automate the claim scan over marketing copy.** Done — `src/lib/marketing/ad-copy.ts` holds the
   approved and prohibited sets and the suite scans both. Two rows remain human-review items, per
   the known gap in section 5.
4. **Point `AUDIT_LOG_PATH` at durable storage.** Promoted, because free traffic still generates
   audit records and a free artefact is exactly as answerable-for as a paid one. Production now
   refuses an unconfigured store rather than warning, so this blocks a deploy rather than degrading
   one quietly.
5. **Geo-fence to the three live counties** and instrument what share of traffic falls outside them.
   That number is the coverage roadmap, and under free mode it is the primary thing traffic buys.
6. **Landing pages for all twelve types** before running type-specific ads.
7. **Instrument the free funnel honestly.** There is no purchase event now, so the measures are:
   report generated → open-questions panel reached → referral package opened → letter generated. If
   people bounce at the panel, the positioning is wrong and more spend will not fix it.

---

## 9. The strategic question, and what free mode does to it

The previous version of this section ended on a question: segment A is real but modest — "can I
build here" is worth tens of dollars — while the large willingness to pay sits in segment B, where
the honest answer is "you need an appraiser, and here is a well-prepared package for them." Whether
a homeowner facing an acquisition will pay for *preparation* rather than an *answer* was untested,
and I said twenty conversations would settle it before committing budget.

**Free mode does not answer that question. It changes when you have to.**

The test as framed required building a paid tier to run it, which meant committing to the counsel
review, the LDA posture and the payment surface before learning anything. That sequencing was always
backwards and free mode breaks it: demand, comprehension and segment mix can all be measured now,
with no price in the way and no compliance spend committed.

What can be learned for free, and could not be learned before:

- **Does the honest report land?** Whether a homeowner who meets "10 open questions" understands why
  that is the finding rather than a failure. This is the single riskiest assumption in the product
  and it has never been tested on a stranger. If it does not land, no pricing fixes it.
- **Which segment actually shows up.** Section 2 ranks A over B on reasoning, not evidence. Free
  traffic tells you the real mix, and it tells you cheaply.
- **Where the coverage gap bites.** The share of traffic outside LA, Orange and San Diego is the
  county roadmap, and it costs nothing to collect.
- **Whether referral partners will actually refer.** Much easier to test at zero price, per §4.2.

What still cannot be learned, and is worth naming so nobody mistakes free usage for validated
demand: **nobody has paid for this, so nothing here establishes that anyone would.** Free usage is
weak evidence of willingness to pay — it is routine for a free tool to be used enthusiastically and
bought by no one. Treat the free period as a test of comprehension and segment, not of price.

**The one thing to decide now rather than later.** Free mode is a good position for the segment A
wedge and a poor one for segment B. A homeowner facing a condemnation offer with a deadline is not
price-sensitive and does not need a free tool; they need a professional, quickly. Serving them well
eventually means the referral network in §4.3, which is a relationship-building effort that can start
immediately and does not depend on commerce resuming. That is the highest-value thing available
during the free period, and it is not a marketing activity.

---

## 10. What changed in this revision

| Section | Change |
|---|---|
| 1 | Split the UPL row into §6400 (compensation, now moot) and §6125 (payment-irrelevant, now live) |
| 2 | Unchanged. The segment analysis holds and A is better supported at zero price |
| 3 | Removed the pricing comparison from the positioning; free is now stated rather than hidden |
| 4 | Paid search demoted from primary to a budgeted research line; referral partners promoted |
| 5 | New prohibition class: paid-tier offers, upgrade CTAs, pricing pages, launch-pricing waitlists |
| 6 | Step five removed. There is no paid step and there must not be an advertised one |
| 7 | Unchanged. The twelve type cases are independent of pricing |
| 8 | Gate 2 dissolved; audit storage promoted; funnel instrumentation rewritten without a purchase event |
| 9 | Rewritten. The paid-preparation question is deferred, not answered, and the free period has its own agenda |
