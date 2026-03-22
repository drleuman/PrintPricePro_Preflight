FROM node:20-bookworm-slim
WORKDIR /app
COPY ppos-preflight-engine ./ppos-preflight-worker/libs/ppos-preflight-engine
COPY ppos-shared-infra ./ppos-preflight-worker/libs/ppos-shared-infra

WORKDIR /app/ppos-preflight-worker
COPY ppos-preflight-worker/package.json ./
RUN ls -la libs/ppos-preflight-engine
RUN npm install --only=production --no-audit --install-links
RUN ls -la node_modules/@ppos/preflight-engine || echo "NOT INSTALLED"
