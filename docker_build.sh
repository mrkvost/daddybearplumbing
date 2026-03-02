#!/bin/sh
# Builds the Angular app inside a Docker container.
# Output is written to dist/ in the current directory on your host machine.

docker run --rm \
  -v "$(pwd)":/app \
  -w /app \
  node:22-alpine \
  sh -c "npm install && npm run build"
