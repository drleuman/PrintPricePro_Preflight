# Stage 1: Build frontend + install server dependencies
FROM node:22 AS builder

WORKDIR /app
COPY . ./

# Provide placeholder env vars so the server doesn't crash during build steps
RUN echo "API_KEY=PLACEHOLDER" > ./.env && echo "GEMINI_API_KEY=PLACEHOLDER" >> ./.env

# Install server dependencies (includes multer)
WORKDIR /app/server
RUN npm install

# Install frontend deps and build
WORKDIR /app
RUN npm install && npm run build


# Runtime image (Phase 18.C - Decoupled)
FROM node:22-slim

# We install procps for child-process management
# Note: Ghostscript and poppler are no longer required locally as execution is delegated to PPOS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends procps \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r pppuser && useradd -r -g pppuser pppuser

WORKDIR /app

# Copy server entry and dependencies
COPY --from=builder /app/server/server.js ./server.js
COPY --from=builder /app/server/routes ./routes
COPY --from=builder /app/server/services ./services
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./package.json

# Copy frontend
COPY --from=builder /app/dist ./dist

# Final permissions
RUN mkdir -p ./icc-profiles /tmp/ppp-preflight && \
    chown -r pppuser:pppuser /app /tmp/ppp-preflight

USER pppuser

EXPOSE 8080
CMD ["node", "server.js"]
