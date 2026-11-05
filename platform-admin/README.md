# Aravo platform admin

The control panel for the tracking platform: every company, their measured
usage, and the two controls that can suspend one or cap its traffic.

A separate application from `aravo-website-admin`, which is the CMS behind the
marketing site. They share a design system and nothing else: **every endpoint
this panel calls crosses the tenant boundary by design**, which is exactly why
it is its own app, behind its own login, on its own Supabase project.

```
the platform API     :8020    ← this talks to it
this repo            :4800
the CMS admin        :4300    ← different product, different project
the website          :4200
```

## Run it

```bash
npm install
cp .env.local.example .env.local    # then fill it in
npm run dev                         # http://localhost:4800
```

Requires the platform API running, and `NEXT_PUBLIC_API_URL` pointing at it.

With no Supabase project configured, the sign-in screen offers a development
entry that accepts a pasted access token, so the screens can be exercised
against a local API before auth exists. It refuses to run in production.

```bash
npm run api:types    # regenerate from ../aravo-platform-api/openapi.json
npm run build
npx eslint .
npx tsc --noEmit
```

## What it shows, and what it deliberately does not

**Overview** answers one question: is ingestion keeping up? Queue depth alone
cannot — a large queue that is draining is healthy and a small one that has not
moved in an hour is not — so depth sits next to the age of the oldest waiting
job, which is the number that actually says.

**Companies** shows device and delivery counts **as measured**. Registration
asks how many couriers a company has and how many deliveries a day they do;
those are guesses typed by whoever signed up and are wrong within a month. They
are shown on the company page under a heading that says so, and they are never
used for limits or metering.

**No billing.** Out of scope for these phases, and a half-built invoicing
screen is worse than none.

**No movement paths.** Reconstructing indoor position from these sensors is not
something the pipeline can honestly claim, so nothing here draws one.

## Two things the screens are careful about

**`inconclusive` is amber, not red.** A delivery is inconclusive when its
sensor data could not be used — a phone that was off, in a bag, or force
closed. That is a real outcome, not a platform fault, and colouring it as an
error teaches an operator to chase the wrong thing.

**Suspension says what it does before it is pressed.** It is immediate and
total: the dashboard, every API key and every live device token stop working on
the next request.

## What the audits found

| Found | Why it mattered |
|---|---|
| The status dialog never read `rate_limit_per_minute` back | The API stored it and `CompanyRead` did not return it, so the box was always blank. An operator who opened the dialog to change a status silently wiped whatever ceiling was already set. The field is now returned and seeded. |
| A rejected token dead-ended | The screen showed an error with a Try again button that could never succeed, and the dead session survived a reload. The client now reports a 401 once and the shell signs out. |
| Search queried per keystroke | Debounced, and the abort signal now reaches the fetch instead of being created and ignored. |
| Device and delivery tabs fetched fifty rows with no controls | A company with ten thousand deliveries showed the first fifty as though that were all of them. |

## Every list paginates

A tab that fetched a fixed page and rendered it without controls would show the
first 50 of 10,000 deliveries as though that were all of them. Silent
truncation reads as "covered everything" when it did not, so every list here
reports its total and can be paged.
