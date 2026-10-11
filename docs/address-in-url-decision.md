# The address is in the URL

**Status:** open. Needs a product decision, not a code cleanup.
**Raised:** 2026-10-11, during the privacy sweep that found the analytics leak.
**Owner:** product.

## The fact

`/report` is reached as a GET with the address in the query string:

```
/report?submitted=1&street=8321+Faust+Ave&city=Los+Angeles&state=CA&zip=91304
```

The homepage form posts there with no `method`, so it is a GET. Everything
below follows from that one decision.

## What it means, and what has already been done about it

A URL is not private. It travels further than the page it names.

| Path | Status |
|---|---|
| Our application log | **Closed, structurally.** `outcome-log.ts` takes a closed union and will not accept free text, so an address has nowhere to go even by mistake. |
| Vercel Web Analytics | **Closed 2026-10-11.** The beacon was sending `location.href` entire. `components/analytics.tsx` strips the query string before anything is sent. |
| Referrer header | **Closed 2026-10-11.** Policy pinned to `strict-origin-when-cross-origin`, so only the origin leaves. There are currently no external links on `/report` to leak through. |
| Page metadata | **Clean, verified.** `noindex, nofollow`; no canonical, `og:url` or Twitter tag carries the address. |
| **The browser's history** | **Open.** The URL is in the address bar and stays in history. A shared computer shows it. |
| **The host's request records** | **Open.** Any web host keeps automatic request records, and the URL is the request. |

The two open rows cannot be closed by stripping anything. They are closed only
by not putting the address in a URL.

## The options

### 1. Leave it, and keep saying so

The privacy page now states this limit plainly rather than claiming the
address is never recorded anywhere. That is honest and it is cheap.

Argues for: the tool is still unusually private — no accounts, no cookies, no
third-party scripts, nothing stored. The remaining exposure is the same one
every website has about its own URLs.

Argues against: the product's loudest promise is about addresses
specifically, and "every website has this problem" is a weak answer from a
tool whose entire pitch is that it handles addresses carefully.

### 2. POST the form

Change the homepage and report forms to `method="post"` and read the body.

Closes: browser history, host request records, and every future leak of this
shape at once.

Breaks, and this is the real cost:
- **Shareable and bookmarkable report URLs stop working.** Today a report can
  be bookmarked, re-opened, or sent to a spouse. After this, it cannot.
- **The "Which parcel?" disambiguation links break.** They are `<a href>`
  links carrying an APN plus the original query. They would need to become
  form posts.
- **Back/refresh gets worse.** A POSTed page prompts to resubmit on refresh.
- Possibly SEO-irrelevant (the page is already `noindex`), so nothing lost
  there.

### 3. Server-side exchange

POST the address, store it against a short-lived opaque id, redirect to
`/report/<id>`. The URL carries a meaningless token instead of an address.

Closes: the same things as option 2.
Keeps: shareable URLs, working links, clean refresh.

Costs: **it requires storing the address**, which is the one thing the product
currently never does. Even for ten minutes, even encrypted, that is a real
reversal of the strongest claim on the privacy page, and it needs somewhere to
store it — there is no datastore today, and Vercel's filesystem is ephemeral.
It also trades a URL that leaks to a store that could be breached.

## Recommendation

**Option 2, when there is time to do it properly** — and not before someone
has decided whether losing bookmarkable reports is acceptable. That is a
product question about how people actually use the tool, and nobody has data
on it yet.

Option 3 looks attractive and is probably wrong here: it closes the leak by
introducing storage, and "we never store your address" is worth more than a
tidy URL.

Option 1 is the honest status quo and is where things stand tonight.

## What would make this decidable

Whether anyone bookmarks or shares a report. The outcome log now records a
`county-parcel` event per lookup; it does not distinguish a fresh search from
a revisit. A repeat-visit signal, or simply a few weeks of traffic, would
answer it.
