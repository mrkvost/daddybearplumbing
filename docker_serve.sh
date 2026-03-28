#!/bin/sh
# Serves the pre-built Angular app from dist/ using nginx in Docker.
# Run docker_build.sh first to generate the dist/ folder.

DIST="$(pwd)/dist/daddy-bear-plumbing/browser"

if [ ! -d "$DIST" ]; then
  echo "Error: $DIST not found. Run ./docker_build.sh first."
  exit 1
fi

echo "Serving at http://localhost:8080"

docker run --rm \
  -p 8080:80 \
  -v "$DIST":/usr/share/nginx/html:ro \
  -v "$(pwd)/nginx.conf":/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
