#!/bin/bash
# Publishes the built Angular SPA to S3 with per-asset-class Cache-Control,
# then invalidates CloudFront. Shared by deploy.sh (manual local) and
# infrastructure/buildspec.yml (CodeBuild admin-triggered rebuild).
#
# Required environment variables:
#   BUCKET_NAME         target S3 bucket name (no s3:// prefix)
#   CLOUDFRONT_DIST_ID  CloudFront distribution to invalidate
set -e

: "${BUCKET_NAME:?BUCKET_NAME env var required}"
: "${CLOUDFRONT_DIST_ID:?CLOUDFRONT_DIST_ID env var required}"

DIST="dist/daddy-bear-plumbing/browser"
BUCKET="s3://${BUCKET_NAME}"

echo "Pass 1: sync everything with a short cache (HTML / sitemap / robots default)..."
aws s3 sync "$DIST" "$BUCKET" --delete \
  --cache-control "public, max-age=300, must-revalidate"

echo "Pass 2: overwrite content-hashed JS/CSS + logo with 1y immutable..."
aws s3 cp "$DIST" "$BUCKET" --recursive \
  --exclude "*" \
  --include "chunk-*.js" \
  --include "styles-*.css" \
  --include "logo.svg" \
  --cache-control "public, max-age=31536000, immutable"

echo "Pass 3: overwrite fonts with 1 month..."
aws s3 cp "$DIST" "$BUCKET" --recursive \
  --exclude "*" \
  --include "fonts/*" \
  --cache-control "public, max-age=2592000"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*"

echo "Done!"
