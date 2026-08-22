# Go-to-market: targeting, advertising, and what we may not say

**Status: draft for review. Not approved for spend.** Section 8 lists the gates that must clear
before the first dollar goes out. One of them is counsel review, which the product itself is still
waiting on — `CURRENT_DISCLAIMER` is `placeholder-v1` with `needsComplianceSignOff: true`.

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
| UPL statutes — Cal. Bus. & Prof. Code §6400 et seq. | Advertising legal document assistance or advice | Criminal in many states, already tracked in `attorney-review.ts` |

The marketing therefore has to sell something true. The good news is that there is something true
and it is worth money: **the product answers "what can I do with my land, and what does the record
actually say" faster and cheaper than any alternative, and it packages evidence so the professional
you eventually hire starts from something.**

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
> your lot it covers, and what the public record does and does not establish. In minutes, for less
> than an hour of anyone's billable time.

What that promises is all deliverable today. Note what it does not promise.

**The counter-positioning is the honesty itself.** Every competitor in adjacent categories leads with
a number. We lead with "here is what is knowable, here is what is not, and here is who can answer the
rest." For a homeowner who has already been told three different things by three different people,
that is a differentiator rather than a weakness — and it is the reason the report ends with a
referral package instead of an invoice.

---

## 4. Channels

### 4.1 Search — primary

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

### 4.2 Referral partners — highest leverage

The people who hit the easement wall *on the homeowner's behalf*, repeatedly, and currently have no
good next step to offer:

- ADU and addition designers, pool builders, fence and deck contractors
- Landscape architects
- Residential surveyors
- Permit expediters

They meet this problem weekly. A tool that resolves it in minutes makes them look competent and
unblocks their own pipeline. This is a warm channel with near-zero CAC and it needs a partner page
and a referral link, not an ad budget.

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

## 6. Funnel

1. **Ad / partner link** → geo-matched, intent-matched
2. **Landing page per easement type** — the same twelve, so the ad's promise matches the page
3. **Address + easement type** — two fields, no account
4. **Free report** — restrictions, county parcel record, and the open-questions panel
5. **Paid step** — the referral package as a document, the records-request drafts, and the letters

The free tier has to be genuinely useful, because the honest report is also the demonstration. A
homeowner who reads "10 open questions" and understands why is a qualified buyer for the paid step.
One who feels teased is not.

**Pricing note.** The paid artefact is preparation and correspondence, not valuation. Price it
against the alternative — an hour of an attorney's time to explain the same thing — not against an
appraisal.

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

Ordered. Do not skip 1 or 2.

1. **Counsel review of the disclaimer and the ad copy.** `needsComplianceSignOff` is still `true`.
   Advertising a product whose own disclaimer is a placeholder is the wrong order of operations, and
   the copy needs the same review the product does — in each state advertised into.
2. **Confirm the licensing posture** for advertising into CA on valuation-adjacent and
   legal-document-adjacent services, and re-check the `CA-TRACK1-UNREVIEWED` gap in
   `compliance-gaps.ts`, which is still open.
3. **Automate the claim scan over marketing copy.** Point `scanForAppraisalClaims()` at ad text,
   landing pages and emails in CI. Cheap, and it converts §5 from a rule into a build failure.
4. **Geo-fence to the three live counties** and instrument what share of traffic falls outside them.
   That number is the coverage roadmap.
5. **Landing pages for all twelve types** before running type-specific ads, so no ad promises a page
   that does not exist.
6. **Instrument the honest funnel:** report generated → open-questions panel read → paid step. If
   people bounce at the panel, the positioning is wrong and more spend will not fix it.

---

## 9. The strategic question this document cannot answer

Segment A is real and reachable, and the product serves it honestly today. But it is a *modest*
purchase: "can I build here" is worth tens of dollars, not hundreds.

The large willingness to pay sits in segment B, where the product's honest answer is "you need an
appraiser, and here is a well-prepared package for them." Whether that is a business depends on
something not yet tested: **will a homeowner facing an acquisition pay for preparation rather than
an answer?**

That is a customer-development question, not an engineering one, and it is cheap to test — twenty
conversations with people who have received an acquisition notice, before any of the above is built
out. I would run that test before committing budget to segment B, and I would launch on segment A
regardless, because segment A works today.
