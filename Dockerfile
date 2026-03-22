# --- STAGE 1: Build ---
FROM node:20-slim AS builder

WORKDIR /app

# 1. Install dependencies
# Dependencies like @ppos/preflight-engine are now consumed as packages
COPY package*.json ./
RUN npm install

# 2. Copy source code and build frontend
COPY . .
RUN npm run build

# --- STAGE 2: Runtime ---
FROM node:20-slim

WORKDIR /app

# Install system dependencies (Ghostscript for PDF operations)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy production artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/app ./app
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/config ./config

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "app/server.js"]
