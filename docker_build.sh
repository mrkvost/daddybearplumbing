#!/bin/sh
# Builds the Angular app inside a Docker container.
# Output is written to dist/ in the current directory on your host machine.
#
# Auto-detects the deployment env from AWS_PROFILE (or accepts it as $1) so
# the right environment.<env>.ts is baked into the bundle via Angular's
# fileReplacements. Kvaking uses the default configuration (no replacement);
# daddybear replaces environment.ts with environment.daddybear.ts.

set -eu

env="${1:-${AWS_PROFILE:-}}"
if [ -z "$env" ]; then
    echo "error: pass env as first arg or export AWS_PROFILE=<env>" >&2
    echo "usage: $0 <env>   # e.g. kvaking, daddybear" >&2
    exit 1
fi

case "$env" in
    kvaking)
        # No fileReplacement needed — environment.ts already holds kvaking values.
        ng_config="production"
        ;;
    daddybear)
        ng_config="production,daddybear"
        ;;
    *)
        echo "error: unknown env '$env' — add a build configuration in angular.json" >&2
        exit 1
        ;;
esac

echo "Building for env=$env (ng --configuration=$ng_config)"

docker run --rm \
  -v "$(pwd)":/app \
  -w /app \
  node:24-alpine \
  sh -c "node scripts/generate-seo.js && npm install && npx ng build --configuration=$ng_config"
