# ───────────── Stage 1: Build ─────────────
FROM node:23-alpine AS builder

WORKDIR /app

# Only install deps (including devDeps) so TS can compile
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build   # Runs `tsc` and emits dist/

# ──────────── Stage 2: Production ────────────
FROM node:23-alpine

WORKDIR /app

# Install *only* production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy over compiled output
COPY --from=builder /app/dist ./dist

# Tell Docker (and Render) which port we’ll listen on…
# (doesn't strictly enforce it, but documents intent)
EXPOSE 10000

# Start the server. No more build step here.
CMD ["node", "dist/index.js"]
