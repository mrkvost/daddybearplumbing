#!/bin/bash
# Manual deploy from a local build (run ./docker_build.sh first).
# Upload + invalidation logic lives in scripts/publish.sh (shared with CodeBuild).
set -e

export BUCKET_NAME="kvaking"
export CLOUDFRONT_DIST_ID="E13CC4GUW5MN29"

./scripts/publish.sh

echo "Uploading meta placeholders to gallery bucket (skip if already custom)..."
aws s3 sync meta/ s3://kvaking-gallery/gallery-images/meta/ --no-progress \
  --cache-control "public, max-age=31536000, immutable"
