# DRAFT — Public records request, FDOT District 7

**Status: NOT SENT.** This is a draft for you to review and send. I have no ability to file it, and
sending correspondence to an agency on your behalf is your decision to make, not mine.

---

## Recipient (verified 2026-08-02)

**D7prcustodian@dot.state.fl.us** · 813-975-6044
Florida Department of Transportation
District 7 — Office of General Counsel
11201 N. McKinley Drive, MS 7-120, Tampa, FL 33612-6403

Source: FDOT's published district public-records-custodian list. District 7 covers Citrus, Hernando,
Hillsborough, **Pasco** and Pinellas — and the parcels below geocode to Pasco County (Zephyrhills
CCD), so D7 is the correct district.

FDOT also accepts requests through its Customer Service Portal; either route is fine.

---

## Read this before sending: expect a partial denial on compensation

Florida **§119.0711** exempts *"appraisals, other reports relating to value, offers, and
counteroffers"* from disclosure until a valid option contract is executed or a written offer to sell
is conditionally accepted. If no option contract is executed, the exemption expires at the
conclusion of condemnation litigation.

**On these parcels, that exemption has almost certainly not lapsed.** In FDOT's own published ROW
status layers, `ACQUIRED` and `ACQ_DATE` are **empty on all 27 TCE records**. Six carry an appraisal
*date* only. So the acquisitions appear to still be in progress, and the compensation figures are
likely exempt today.

**The term is a different matter.** How long an easement runs is not an appraisal, a report relating
to value, an offer, or a counteroffer. It is a term of the instrument. The request below is split so
that the non-exempt half can be answered now, rather than the whole thing being denied together.

Adjust the framing if you would rather wait and file once acquisition completes — that would get you
both halves in one request.

---

## Draft request

> **Subject: Public records request — TCE terms and compensation, SR 54/56 corridor ROW parcels (Pasco County)**
>
> To the District 7 Custodian of Public Records,
>
> Under Chapter 119, Florida Statutes, I request copies of the following records relating to
> temporary construction easement (TCE) parcels shown in the Department's published right-of-way
> status GIS layers `Segment_2a_ROW_Status` and `Seg_2B_ROW_Status` (ArcGIS organisation
> `O1JpcwDW8sjYuddV`), Pasco County.
>
> The parcels are those whose `TAKING` or `PURPOSE` value contains "TCE": parcel numbers 700, 701,
> 702, 703, 704, 705, 706, 707, 708, 709, 710A, 710B, 713, 714, 717, 718, and 716/800, together with
> those marked 712 and 715.
>
> **Item 1 — easement term (I do not believe this is exempt).**
> For each parcel listed, the document or record stating the **duration or term** of the temporary
> construction easement — commencement and expiration, or the stated number of months or years.
> This may appear in the easement instrument, the acquisition plans, or the parcel sketch. I am
> requesting the term only, not any appraisal, report of value, offer, or counteroffer.
>
> **Item 2 — compensation (I anticipate this may be exempt at present).**
> For each parcel listed, the amount of compensation paid or offered for the temporary construction
> easement, and the document stating it.
>
> I recognise that §119.0711 may exempt Item 2 until a valid option contract is executed or a
> written offer to sell is conditionally accepted, and that the Department's published data shows
> these acquisitions as not yet complete. If Item 2 is exempt in whole or part, please:
> (a) release Item 1 and any non-exempt portion of Item 2;
> (b) state the statutory basis for withholding, as §119.07(1)(e) requires; and
> (c) advise whether the Department will release the withheld records once the exemption lapses, and
> what identifier I should cite when requesting them again.
>
> **Fees.** Please advise of any charge before incurring it if the total would exceed [$AMOUNT].
> If a lower-cost format — a spreadsheet extract of terms and amounts rather than copies of the
> underlying instruments — would reduce cost or turnaround, that is acceptable and preferred.
>
> **Format.** Electronic copies by email are preferred.
>
> I am happy to narrow the scope if that would speed the response. No explanation of purpose is
> required under Chapter 119, but for context: I am researching how temporary construction easements
> are valued, and the term and compensation are the two inputs that are not derivable from published
> GIS data.
>
> Thank you,
> [NAME]
> [CONTACT]

---

## Why only these two items

Everything else the valuation needs is already public and was taken from FDOT's own layers:

| input | status |
|---|---|
| parcel identity, owner | published in the ROW status layer |
| encumbered area | computed from published geometry — 240 to 43,049 sq ft across the 27 records |
| **term** | **not published — Item 1** |
| **compensation** | **not published — Item 2** |

Requesting only the gap keeps the request cheap to fulfil, which makes it likelier to be answered
quickly and without a fee dispute.

## If this comes back denied

The fallback is a completed project rather than an active one. Once `ACQUIRED` is populated in a
district's ROW layer, the §119.0711 exemption has lapsed by its own terms and both items become
releasable. Scanning FDOT's other published ROW layers for populated `ACQUIRED` values would
identify such a project; that scan was started and timed out, so it remains open.
