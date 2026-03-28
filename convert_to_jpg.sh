#!/bin/bash
set -e

# Converts all .png files in a folder to .jpg (80% quality)
# Usage: ./convert_to_jpg.sh [folder]
# Default folder: current directory

DIR="${1:-.}"

if ! command -v convert &> /dev/null; then
  echo "ImageMagick not found. Install with:"
  echo "  sudo apt install imagemagick"
  exit 1
fi

count=0
for png in "$DIR"/*.png; do
  [ -f "$png" ] || continue
  jpg="${png%.png}.jpg"
  convert "$png" -quality 80 "$jpg"
  echo "Converted: $(basename "$png") → $(basename "$jpg")"
  count=$((count + 1))
done

echo "Done! Converted $count file(s)."
