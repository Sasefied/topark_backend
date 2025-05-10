# ───────────── Stage 1: Build ─────────────
FROM node:23-alpine AS builder
WORKDIR /app

# Copy only the lockfile + manifest so layer caching works well
COPY package.json package-lock.json ./
RUN npm install

# Bring in the rest of the source, then compile
COPY . .
RUN npm run build   # emits dist/

# ──────────── Stage 2: Production ────────────
FROM node:23-alpine AS production
WORKDIR /app

# Copy only the lockfile + manifest and install prod deps
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy over compiled output from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 10000

# Run the compiled app
CMD ["node", "dist/index.js"]
