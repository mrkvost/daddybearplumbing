#!/bin/bash
set -e

echo "Uploading to S3..."
aws s3 sync dist/daddy-bear-plumbing/browser/ s3://kvaking --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E13CC4GUW5MN29 --paths "/*"

echo "Done!"
