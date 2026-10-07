# County waitlist — how it works

**There is no database, and that is the design rather than a gap.**

The waitlist is a `mailto:` on the homepage FAQ. Requests arrive at
`help@safehomevalue.com` and live in that inbox. Nothing is stored by the
application, nothing is processed, and there is no admin screen.

---

## Why a mailbox rather than a form

A capture form needs somewhere to put the address. There is no datastore in
this project — the audit store is a file adapter and Vercel's filesystem is
ephemeral, so a form would accept an email, return a cheerful confirmation, and
drop it at the next cold start. **Silently.** Someone who asked to be told
about their county would simply never hear, and nothing would show that
anything had gone wrong.

An inbox is a real store that already exists, needs no connection string, adds
no third party to the privacy page, and fails visibly if it fails at all.

It also keeps the promise already published. Adding a form service — Formspree,
Buttondown, Mailchimp — would put the address with a third party, and
`/privacy` says it is never shared. That sentence would have to change first.

**Revisit when the volume is annoying**, not before. The signal is you putting
off reading the pile.

---

## What arrives

The link prefills a subject and a two-line body:

```
Subject: County waitlist

County:
State:

Anything else you want to tell us is welcome.
```

People will overwrite it, and that is fine — the prefill makes the common case
sortable, not every case. The point is that most of the pile can be counted by
eye without opening anything.

---

## The rule

**Once a week, or whenever the pile looks big:**

1. Filter the inbox on subject `County waitlist`.
2. Tally the counties. A tally sheet, a note file, a spreadsheet — anywhere that
   is not this repository, because these are real email addresses.
3. Note which counties are asked for most. That is the input to what gets built
   next, and it is the only thing the waitlist is actually for.

**When a county goes live:**

4. Find every request for it.
5. Send one note saying it is live. **One.** The privacy page says the address
   is used for "a single note when yours is live" and names what it is not for
   — no newsletter, no marketing, no "while we have you". Those are different
   purposes and nobody agreed to them.
6. Delete those messages. The purpose is finished, so the reason for holding
   the address is finished too.

**When someone asks to be removed:**

7. Delete it. Do not ask why — `/privacy` says they do not have to explain, and
   says it without conditions.
8. No confirmation email unless they asked for one. A "sorry to see you go"
   message is another use of an address that was given for one thing.

---

## What never happens

- No address is sold, rented, traded or shared. Not with advertisers, not with
  data brokers, not with partners.
- No address is added to any other list.
- No address is connected to a property lookup. It could not be — the addresses
  people look up are never stored, which is what makes that promise structural
  rather than a policy. See `src/lib/observability/outcome-log.ts`.
- No waitlist email, or any file derived from one, goes in this repository.

---

## If this ever becomes a form

Three things change together, in this order:

1. **Pick a store.** Vercel KV or Postgres keeps the data inside the same
   platform and does not add a party to the privacy page. A third-party form
   service does, and the "never shared" sentence has to be rewritten before the
   form ships, not after.
2. **Update `/privacy`.** It is written conditionally today — "if you join the
   county waitlist" — so it is accurate either way, but it would need to say
   where the address rests and for how long.
3. **Then build the form.** A test in `src/app/home-page.test.ts` currently
   asserts there is no email input on the homepage, and it exists to make this
   sequence deliberate rather than accidental. Removing it should be a decision
   somebody makes, not a line somebody deletes to get a build green.
