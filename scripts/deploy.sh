#!/usr/bin/env bash
# ============================================================
# deploy.sh — PrintPrice Preflight production deploy
# Usage:  bash scripts/deploy.sh [--skip-build]
# ============================================================
set -euo pipefail

APP_DIR="/var/www/vhosts/printprice.pro/preflight.printprice.pro"
UPLOAD_DIR="$APP_DIR/tmp/uploads"
PLESK_USER="printprice.pro_a2w0fsu9yw9"
PLESK_GROUP="psacln"
API_READY="http://127.0.0.1:8080/api/ready"
SKIP_BUILD="${1:-}"

cd "$APP_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   PrintPrice Preflight — Deploy Script   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Git sync ──────────────────────────────────────────────
echo "▶ [1/6] Syncing with origin/main..."
git fetch --all
git reset --hard origin/main
echo "  HEAD: $(git log -1 --oneline)"

# ── 2. Dependencies ──────────────────────────────────────────
echo "▶ [2/6] Installing dependencies (npm ci)..."
npm ci --omit=dev --prefer-offline 2>&1 | tail -3

# ── 3. Frontend build ────────────────────────────────────────
if [[ "$SKIP_BUILD" != "--skip-build" ]]; then
  echo "▶ [3/6] Building frontend (npm run build)..."
  npm run build 2>&1 | tail -5
else
  echo "▶ [3/6] Skipping frontend build (--skip-build flag)"
fi

# ── 4. Upload directory permissions ──────────────────────────
echo "▶ [4/6] Ensuring upload directory permissions..."
mkdir -p "$UPLOAD_DIR"
chown -R "$PLESK_USER:$PLESK_GROUP" "$APP_DIR/tmp/"
chmod 770 "$UPLOAD_DIR"
echo "  Upload dir: $UPLOAD_DIR (owner: $PLESK_USER)"

# ── 5. Restart Node process ──────────────────────────────────
echo "▶ [5/6] Restarting Node process..."
PID=$(lsof -ti:8080 2>/dev/null || true)
if [[ -n "$PID" ]]; then
  kill "$PID"
  echo "  Killed PID $PID, waiting for Plesk to restart..."
  sleep 5
else
  echo "  No process on 8080 — Plesk will start it automatically."
  sleep 3
fi

# ── 6. Health check ──────────────────────────────────────────
echo "▶ [6/6] Verifying API health..."
for i in 1 2 3 4 5; do
  HTTP=$(curl -s -o /tmp/ppp_ready.json -w "%{http_code}" "$API_READY" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    echo ""
    echo "  ✅ API ready (HTTP 200)"
    cat /tmp/ppp_ready.json | python3 -m json.tool 2>/dev/null || cat /tmp/ppp_ready.json
    break
  fi
  echo "  Attempt $i/5 — HTTP $HTTP, retrying in 3s..."
  sleep 3
done

if [[ "$HTTP" != "200" ]]; then
  echo ""
  echo "  ❌ Health check failed after 5 attempts (HTTP $HTTP)"
  echo "  Last response:"
  cat /tmp/ppp_ready.json 2>/dev/null || true
  echo ""
  echo "  Run: journalctl -u preflight-api.service -n 20 --no-pager"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Deploy completo ✅  $(date '+%Y-%m-%d %H:%M:%S')   ║"
echo "║   Commit: $(git log -1 --format='%h %s' | cut -c1-38)   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
