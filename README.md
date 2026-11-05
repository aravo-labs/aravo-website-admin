# Aravo admin panels

Two Next.js applications, each with its own deployment.

    cms-admin/        the website's content editor   -> cms.aravo.in
    platform-admin/   the delivery platform admin    -> admin.aravo.in

## Why they are in subdirectories rather than merged

Both are Next.js applications laid out the same way, so thirty one of their
files share a path: `package.json`, `next.config.ts`, `eslint.config.mjs`,
`src/app/` and the rest. Copying one over the other would have replaced one
panel's configuration with the other's.

They also answer to different backends and different audiences. `cms-admin`
edits website content and talks to the CMS API. `platform-admin` manages
companies, devices, deliveries and SDK configuration, and talks to the
platform API. A member of staff with access to one does not automatically have
access to the other.

## Running either one

Each directory is self-contained. From inside it:

    npm install
    cp .env.local.example .env.local      # then fill it in
    npm run dev

## Deploying

Neither panel deploys from git. Both are static exports published to S3 and
served by CloudFront, so a change here does nothing until someone publishes.

`platform-admin` has a `npm run deploy` that builds and publishes in one step.
It exists because a plain `npm run build` picks up `.env.local` ahead of
`.env.production` and bakes a localhost API URL into the bundle, which deploys
without complaint and then fails for every visitor. The script sets a real
environment variable, which outranks both files, and refuses to upload a
bundle that still names localhost.

## A note on .gitignore

Each panel keeps its own, but those use root-anchored rules like
`/node_modules`. Those stop matching once a panel sits in a subdirectory, so
the `.gitignore` at the root of this repository repeats them unanchored.
Removing it will cause `node_modules` to be committed.
