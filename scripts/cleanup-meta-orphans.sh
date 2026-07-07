#!/bin/bash
# Delete orphaned hero/og image files in gallery-images/meta/ that are no
# longer referenced by the currently-live meta.json.
#
# Run AFTER publish.sh — the freshly deployed bundle now references the new
# hashes (baked into site-data.ts by generate-seo.js at build time), so the
# previously-referenced files are safe to remove.
#
# Required env vars:
#   GALLERY_BUCKET   the S3 bucket that holds gallery-images/*
#                    (falls back to ${BUCKET_NAME}-gallery if not set)
#
# Skips silently (exit 0) if meta.json is empty or missing — better to leave
# stale files than to accidentally wipe out a live hero because meta.json
# temporarily failed to fetch.

set -euo pipefail

GALLERY_BUCKET="${GALLERY_BUCKET:-${BUCKET_NAME:?GALLERY_BUCKET or BUCKET_NAME env var required}-gallery}"

META_JSON_KEY="gallery-images/meta.json"
META_PREFIX="gallery-images/meta/"

echo "Cleanup: reading s3://$GALLERY_BUCKET/$META_JSON_KEY..."
current_meta=$(aws s3 cp "s3://$GALLERY_BUCKET/$META_JSON_KEY" - 2>/dev/null || echo "")

if [ -z "$current_meta" ]; then
    echo "Cleanup: meta.json empty or missing — skipping to avoid deleting live files."
    exit 0
fi

hero=$(echo "$current_meta" | jq -r '.hero // empty')
og=$(echo "$current_meta" | jq -r '.og // empty')

echo "Cleanup: current hero='$hero' og='$og'"

# List everything in the meta/ prefix, filter to admin-uploaded pattern
# (`<prefix>-<hex hash>.<ext>`), then drop the currently-referenced ones.
# `grep -vFx` matches whole-line as fixed string; `|| true` prevents pipefail
# when no orphans exist.
orphans=$(aws s3 ls "s3://$GALLERY_BUCKET/$META_PREFIX" \
    | awk '{print $NF}' \
    | grep -E '^(hero|og)-[a-f0-9]+\.' \
    | grep -vFx "${hero:-__no_hero__}" \
    | grep -vFx "${og:-__no_og__}" \
    || true)

if [ -z "$orphans" ]; then
    echo "Cleanup: no orphans found."
    exit 0
fi

count=$(echo "$orphans" | wc -l | tr -d ' ')
echo "Cleanup: deleting $count orphan(s):"
echo "$orphans" | while IFS= read -r file; do
    [ -z "$file" ] && continue
    echo "  - $file"
    aws s3 rm "s3://$GALLERY_BUCKET/${META_PREFIX}${file}"
done

echo "Cleanup done."
