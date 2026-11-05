# Aravo admin

The admin panel. A separate application from the public site on purpose: it is
an internal tool behind a login, and it has no business shipping in the bundle
that anonymous visitors download.

Everything the site shows is written here - pages, platforms, documentation,
banners, the company name and logo, the social links and the policies - and
read at runtime, so publishing does not need a deploy.

Three repos, one API:

```
the backend      FastAPI + Supabase     :8010
the website      public site            :4200
this repo        the admin panel        :4300
```

## Run it

```bash
npm install
cp .env.local.example .env.local   # if starting fresh
npm run dev                        # http://localhost:4300
```

Requires the API running, and `NEXT_PUBLIC_API_URL` pointing at it.

```bash
npm run api:types    # regenerate types from ../Aravo-website-backend/openapi.json
npm run build
npx eslint .
```

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | where the FastAPI service is |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project, for sign-in |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon / publishable key only** |

`NEXT_PUBLIC_*` values are compiled into the browser bundle. The service-role
key must never appear here; it lives in the API's environment.

## Routes

The panel sits at the root of its own origin, so there is no `/admin` prefix.

| Route | |
| --- | --- |
| `/` | counts across every resource, and what is waiting on you |
| `/jobs` | roles: full CRUD, publish, search, status tabs |
| `/applications` | triage inbox, notes, signed resume links |
| `/sdk-requests` | triage inbox for SDK access requests |
| `/docs` | SDK documentation authoring, markdown |
| `/team` | team members shown on the public site |
| `/banners` | portfolio banners, three layouts, exclusive publish |
| `/members` | who can sign in; invite, roles, deactivate |
| `/account` | your details and password |
| `/reset` | where invitation and recovery links land; the only route that renders without a session |

## Authentication

Sign-in goes to Supabase Auth over REST (`lib/auth.ts`). Tokens refresh from
their actual expiry and on window focus, so a session does not expire mid-edit.

**Being signed in is not access.** The API checks an `admin_users` row on every
request; a Supabase account without one gets a 403. Roles are `editor` <
`admin` < `owner`.

There is no public sign-up, deliberately. Access is by invitation from an
owner, and the recipient sets their own password - no credential ever passes
through this app or through the person inviting.

Invitations and password resets both land on `/reset`, which is why that route
renders without a session: whoever follows one cannot sign in yet, and gating it
behind the login screen would make it unreachable by exactly the people it
exists for. Supabase delivers the token in the URL fragment, so it never reaches
a server; the page reads it once, sets the password, and strips it out of the
address bar.

`ADMIN_APP_URL` on the API must match this app's origin, and that origin plus
`/reset` has to be listed under **Authentication -> URL Configuration ->
Redirect URLs** in the Supabase dashboard. Supabase silently falls back to the
project's Site URL for any redirect that is not on that list, which looks like
the link being broken rather than the configuration being incomplete.

## Design system

`design/tokens.css` and `components/ui/index.tsx`. Three token layers, and
components may only read the third:

| Layer | Example |
| --- | --- |
| primitive | `--color-teal-600`, `--color-sand-200` |
| semantic | `--color-accent`, `--color-text-muted` |
| component | `--control-height-md`, `--control-radius` |

A component that hardcodes a hex has escaped the system. Rebranding is a change
to the primitives and nothing else.

This system is **not** shared with the marketing site, which has its own
palette. That is the point of the split: restyling one cannot affect the other.

## Talking to the API

```
../Aravo-website-backend/openapi.json  →  npm run api:types  →  lib/api/schema.d.ts
                                                         lib/api/types.ts   named interfaces
                                                         lib/api/client.ts  envelope + errors
                                                         lib/api/admin.ts   one fn per endpoint
```

Screens never build URLs or touch the response envelope. `request()` unwraps
`data` and throws `ApiRequestError`, which carries `code` (branch on this),
`fieldErrors` for messages next to inputs, `formErrors` for cross-field rules,
and `requestId` for bug reports.

`lib/api/client.ts` and the generated types also exist in the marketing repo.
The types are generated from the same `openapi.json`, so they cannot drift; the
client is a small, stable file duplicated rather than published as a package.

## Deploying

Point it at its own hostname, e.g. `admin.yourdomain.com`, and add that origin
to the API's `CORS_ORIGINS` and `ADMIN_APP_URL` (the latter is where invitation
and password-reset links land).

`robots` is set to `noindex, nofollow` in the root layout: this is an internal
tool and does not belong in a search index.
