# ─── Stage 1: Build ───
FROM node:23-alpine AS builder
WORKDIR /app

# copy package.json + package-lock.json (if exists)
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Production ──
FROM node:23-alpine AS production
WORKDIR /app

# again use wildcard so lockfile is included
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "dist/index.js"]
