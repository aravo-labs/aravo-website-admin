#!/usr/bin/env bash
#
# Build and publish the platform admin.
#
# The reason this exists rather than a line in a README: `.env.local` takes
# precedence over `.env.production` in Next.js, so a plain `npm run build` on
# a developer's machine bakes `http://localhost:8020` into the bundle. It
# deploys without complaint and every page then fails with "Could not reach
# the server". That has happened twice on this project, once here and once on
# the CMS. A real environment variable outranks both files, so this sets one,
# and then checks the built output rather than trusting that it worked.
set -euo pipefail

API_URL="${NEXT_PUBLIC_API_URL:-https://api.aravo.in}"
BUCKET="${BUCKET:-aravo-platform-admin-site}"
DISTRIBUTION="${DISTRIBUTION:-E3TGG06Q6RL8S2}"
export AWS_PROFILE="${AWS_PROFILE:-aravo}"

echo "building against ${API_URL}"
rm -rf out
NEXT_OUTPUT=export NEXT_PUBLIC_API_URL="$API_URL" npm run build >/dev/null

# The check that would have caught it. A bundle naming localhost is a bundle
# nobody can sign in to, and it is cheaper to fail here than to find out from
# the client.
if grep -rqa "localhost:[0-9]" out/_next/static/chunks/ 2>/dev/null; then
  echo "REFUSING: a localhost URL is baked into the bundle." >&2
  grep -rhoa "localhost:[0-9]*" out/_next/static/chunks/ | sort -u | sed 's/^/  /' >&2
  exit 1
fi
if ! grep -rqa "$(echo "$API_URL" | sed 's|https\?://||')" out/_next/static/chunks/ 2>/dev/null; then
  echo "REFUSING: ${API_URL} does not appear in the bundle." >&2
  exit 1
fi
echo "bundle points at ${API_URL}"

# No --delete: the deploy user has an explicit deny on s3:DeleteObject, so a
# sync that tries to prune fails loudly part way through. Stale chunks are
# harmless because the HTML names the ones it wants.
aws s3 sync out/ "s3://${BUCKET}/" --only-show-errors
echo "uploaded to ${BUCKET}"

ID=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
      --paths '/*' --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION" --id "$ID"
echo "invalidated ${DISTRIBUTION} (${ID})"
