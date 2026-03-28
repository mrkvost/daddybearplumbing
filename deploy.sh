#!/bin/bash
set -e

GALLERY_LOCAL="gallery_photos"

echo "Uploading to S3..."
aws s3 sync dist/daddy-bear-plumbing/browser/ s3://kvaking --delete --exclude "gallery/*"

if [ -d "$GALLERY_LOCAL" ]; then
  echo "Uploading gallery photos..."
  aws s3 sync "$GALLERY_LOCAL"/ s3://kvaking/gallery-photos/ --exclude "*.png" --exclude "gallery.json"
else
  echo "No local $GALLERY_LOCAL/ folder — skipping photo upload."
fi

echo "Generating gallery manifest..."
aws s3 ls s3://kvaking/gallery-photos/ --recursive \
  | awk '{print $4}' \
  | sed 's|^gallery-photos/||' \
  | grep -E '\.(jpg|jpeg|png|webp)$' \
  | sort \
  | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))" \
  > /tmp/gallery.json

aws s3 cp /tmp/gallery.json s3://kvaking/gallery-photos/gallery.json --content-type application/json
rm /tmp/gallery.json
echo "Gallery manifest: $(aws s3 ls s3://kvaking/gallery-photos/ --recursive | grep -cE '\.(jpg|jpeg|png|webp)$') images indexed"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E13CC4GUW5MN29 --paths "/*"

echo "Done!"
