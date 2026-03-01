# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first so Docker can cache the install layer.
# Re-runs only when package.json or package-lock.json changes.
COPY package*.json ./
RUN npm ci

# Copy the rest of the source and build for production.
COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
# Lightweight nginx image to serve the static output.
# This stage is what you'd use for local testing.
# For production, the dist/ folder is uploaded to S3 instead.
FROM nginx:alpine

# Remove the default nginx placeholder page.
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from the builder stage.
COPY --from=builder /app/dist/daddy-bear-plumbing/browser /usr/share/nginx/html

# Angular uses client-side routing — any unknown path must serve index.html
# so the Angular router can handle it. This config does that.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
