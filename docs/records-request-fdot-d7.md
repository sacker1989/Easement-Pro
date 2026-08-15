# DRAFT — Public records request, FDOT District 7

**Status: NOT SENT.** A draft for you to review and send. I have no ability to file it, and sending
correspondence to an agency on your behalf is your decision, not mine.

---

## Recipient (verified 2026-08-02)

**D7prcustodian@dot.state.fl.us** · 813-975-6044
Florida Department of Transportation
District 7 — Office of General Counsel
11201 N. McKinley Drive, MS 7-120, Tampa, FL 33612-6403

From FDOT's published district custodian list. D7 covers Citrus, Hernando, Hillsborough, **Pasco**
and Pinellas. FDOT also accepts requests through its Customer Service Portal.

---

## Target parcels — chosen because the exemption has lapsed

**Sec. 119.0711, F.S.** exempts *"appraisals, other reports relating to value, offers, and
counteroffers"* until a valid option contract is executed or a written offer to sell is
conditionally accepted. Requesting compensation on an in-progress acquisition gets refused.

A scan of **1,558 FDOT ArcGIS services** found the layers where that exemption should already have
lapsed. Two qualify, both District 7:

| layer | TCE parcels | ROW-certified | ACQUIRED = COMPLETE | privately owned |
|---|---|---|---|---|
| `Segment3ROWParcels` | 7 | 7 (2022-10-20 to 2024-05-31) | **2** | 2 |
| `US301_Parcels` | 7 | 7 (2023-08-21 to 2024-10-31) | 0 | 6 |

**14 ROW-certified TCE parcels, 8 privately owned**, areas 129–44,686 sq ft (published directly in
`AREA_SF` / `AREA_SQFT`).

**One caveat that shapes the ask.** In these layers `ACQUIRED` is usually the literal string
`"N/A"`, which is not an acquisition status. Only parcels **705A** and **705B** (CSX
Transportation) read `COMPLETE`. The other twelve rest on a populated ROW certification date —
strong evidence the acquisition concluded, but not the department's own completion flag. The draft
leads with the two unambiguous parcels and asks about the rest in the alternative, so a partial
denial does not sink the whole request.

---

## Draft request

> **Subject: Public records request — temporary construction easement terms and compensation, District 7 ROW parcels**
>
> To the District 7 Custodian of Public Records,
>
> Under Chapter 119, Florida Statutes, I request copies of records relating to temporary
> construction easement (TCE) parcels shown in the Department's published right-of-way GIS layers
> `Segment3ROWParcels` and `US301_Parcels` (ArcGIS organisation `O1JpcwDW8sjYuddV`).
>
> **Group A — acquisition shown complete.** Parcels **705A** and **705B** in `Segment3ROWParcels`,
> both recording ACQUIRED = COMPLETE and a right-of-way certification date of 2023-12-31.
>
> **Group B — right-of-way certified.** Parcels 700, 701, V 702 and V 704 in `Segment3ROWParcels`,
> and parcels 700, 701, 702, 703 and V 701 in `US301_Parcels`, each recording a right-of-way
> certification date between 2022-10-20 and 2024-10-31.
>
> For each parcel above I request:
>
> **1. The term of the temporary construction easement** — commencement and expiration dates, or the
> stated number of months or years. This may appear in the easement instrument, the acquisition
> plans, or the parcel sketch.
>
> **2. The compensation paid for the temporary construction easement**, and the document stating it.
>
> I understand Sec. 119.0711 exempts appraisals, reports of value, offers and counteroffers until a
> valid option contract is executed or a written offer to sell is conditionally accepted, and that
> the exemption expires at the conclusion of condemnation litigation where no option contract is
> executed. I have selected these parcels because the Department's own published data indicates the
> right-of-way process has concluded for them. If the exemption nonetheless still applies to any
> parcel, please:
>
> (a) provide the records for the parcels where it does not — Group A in particular;
> (b) state the statutory basis for any withholding, as Sec. 119.07(1)(e) requires; and
> (c) tell me what identifier to cite to request the withheld records once the exemption lapses.
>
> Item 1 is requested independently of Item 2. The duration of an easement is a term of the
> instrument rather than an appraisal, a report relating to value, an offer, or a counteroffer, so I
> do not believe Sec. 119.0711 reaches it.
>
> **Fees.** Please advise of any charge before incurring it if the total would exceed [$AMOUNT]. A
> spreadsheet listing term and amount per parcel is preferable to copies of the underlying
> instruments if that is cheaper or faster.
>
> **Format.** Electronic copies by email, please.
>
> No statement of purpose is required under Chapter 119, but for context: I am researching how
> temporary construction easements are valued. Term and compensation are the only two inputs not
> derivable from the Department's published GIS data.
>
> Thank you,
> [NAME]
> [CONTACT]

---

## Why only these two items

Everything else came from FDOT's own layers:

| input | status |
|---|---|
| parcel identity, owner | published |
| encumbered area | published directly in `AREA_SF` / `AREA_SQFT` — 129 to 44,686 sq ft |
| ROW certification date | published |
| **term** | **not published — Item 1** |
| **compensation** | **not published — Item 2** |

Narrow requests are cheaper to fulfil, which makes a fast answer likelier and a fee dispute less so.

## Superseded targeting

An earlier draft aimed at the Pasco `Segment_2a_ROW_Status` / `Seg_2B_ROW_Status` TCE parcels. Those
are the **wrong target**: `ACQUIRED` and `ACQ_DATE` are empty across all 27 records there, so the
acquisitions are in progress and the exemption has not lapsed. Superseded by the parcels above.
