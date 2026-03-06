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
# The health check URL should hit the production domain as port 8080 is not fixed in Passenger
API_READY="https://preflight.printprice.pro/api/ready"
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
echo "▶ [2/6] Installing dependencies (npm ci — full, for build)..."
npm ci 2>&1 | grep -E "added|removed|audit|error" | head -5

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
echo "▶ [5/6] Restarting Node process (Passenger)..."
mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"
echo "  Touched tmp/restart.txt. Waiting for Passenger to cycle..."
sleep 5

# ── 6. Health check ──────────────────────────────────────────
echo "▶ [6/6] Verifying API health..."
rm -f /tmp/ppp_ready.json # Clear stale check
for i in 1 2 3 4 5 6 7 8; do
  # Use -k/--insecure because loopback SSL on some servers fails
  HTTP=$(curl -s -k -o /tmp/ppp_ready.json -w "%{http_code}" "$API_READY" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    echo ""
    echo "  ✅ API ready (HTTP 200)"
    cat /tmp/ppp_ready.json | python3 -m json.tool 2>/dev/null || cat /tmp/ppp_ready.json
    break
  fi
  echo "  Attempt $i/8 — HTTP $HTTP, retrying in 4s..."
  sleep 4
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
