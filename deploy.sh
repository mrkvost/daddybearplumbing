#!/bin/bash
set -e

DIST="dist/daddy-bear-plumbing/browser"
BUCKET="s3://kvaking"

echo "Uploading hashed assets (long cache)..."
aws s3 sync "$DIST" "$BUCKET" --delete \
  --exclude "index.html" \
  --exclude "robots.txt" \
  --exclude "sitemap.xml" \
  --cache-control "public, max-age=31536000, immutable"

echo "Uploading index.html, robots.txt, sitemap.xml (no cache)..."
aws s3 cp "$DIST/index.html" "$BUCKET/index.html" --cache-control "no-cache"
aws s3 cp "$DIST/robots.txt" "$BUCKET/robots.txt" --cache-control "no-cache"
aws s3 cp "$DIST/sitemap.xml" "$BUCKET/sitemap.xml" --cache-control "no-cache"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E13CC4GUW5MN29 --paths "/*"

echo "Done!"
