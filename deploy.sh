#!/bin/bash
# Manual deploy from a local build (run ./docker_build.sh first).
# Auto-detects env from AWS_PROFILE — bucket names + CloudFront distribution
# ID come from Terraform outputs, so a single command works for every
# deployment (kvaking, daddybear, …).
#
# Prerequisites:
#   1. export AWS_PROFILE=<env>    # e.g. kvaking or daddybear
#   2. cd infrastructure && ./tf $AWS_PROFILE init   (once per env-switch;
#      this sets .terraform/environment to the right workspace)
#
# Upload + invalidation logic lives in scripts/publish.sh (shared with
# CodeBuild). This script fills in the env vars publish.sh consumes.

set -euo pipefail

cd "$(dirname "$0")"

env="${AWS_PROFILE:?AWS_PROFILE not set — run 'export AWS_PROFILE=<env>' first (e.g. kvaking or daddybear)}"

# Sanity check: the Terraform workspace last selected in this checkout must
# match AWS_PROFILE. Otherwise `./tf $env output` would either error (wrong
# credentials for the state bucket) or worse, succeed against the wrong env.
active_workspace=$(cat infrastructure/.terraform/environment 2>/dev/null || echo default)
if [[ "$active_workspace" != "$env" ]]; then
    echo "error: Terraform workspace is '$active_workspace' but AWS_PROFILE is '$env'." >&2
    echo "       Run 'cd infrastructure && ./tf $env init' first, then retry." >&2
    exit 1
fi

echo "Reading deploy config from Terraform outputs (env=$env)…"
BUCKET_NAME=$(cd infrastructure && ./tf "$env" output -raw s3_bucket_name)
GALLERY_BUCKET=$(cd infrastructure && ./tf "$env" output -raw gallery_bucket_name)
CLOUDFRONT_DIST_ID=$(cd infrastructure && ./tf "$env" output -raw cloudfront_distribution_id)

echo "  BUCKET_NAME=$BUCKET_NAME"
echo "  GALLERY_BUCKET=$GALLERY_BUCKET"
echo "  CLOUDFRONT_DIST_ID=$CLOUDFRONT_DIST_ID"

export BUCKET_NAME
export CLOUDFRONT_DIST_ID

./scripts/publish.sh

echo "Uploading meta placeholders to gallery bucket (skip if already custom)…"
aws s3 sync meta/ "s3://$GALLERY_BUCKET/gallery-images/meta/" --no-progress \
  --cache-control "public, max-age=31536000, immutable"
