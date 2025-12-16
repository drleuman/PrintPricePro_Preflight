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


# Stage 2: Runtime image (Cloud Run)
FROM node:22

# Ghostscript required for PDF fixes (grayscale, RGB->CMYK, rebuild to >=150dpi)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server entry
COPY --from=builder /app/server/server.js ./server.js
COPY --from=builder /app/server/routes ./routes
COPY --from=builder /app/server/services ./services

# Copy server dependencies from builder to guarantee runtime modules exist (fixes "Cannot find module 'multer'")
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./package.json

# Create ICC profiles directory (profiles can be added later if needed)
RUN mkdir -p ./icc-profiles

# Copy server public assets (if any)
COPY --from=builder /app/server/public ./public

# Copy built frontend
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["node", "server.js"]
