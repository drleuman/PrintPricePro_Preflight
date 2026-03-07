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

# Check if we were just updated by git-pull in a previous execution of this script
RESTARTED_BY_SELF="${2:-}"

cd "$APP_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   PrintPrice Preflight — Deploy Script   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Git sync ──────────────────────────────────────────────
echo "▶ [1/6] Syncing with origin/main..."
git fetch --all
OLD_HEAD=$(git rev-parse HEAD)
git reset --hard origin/main
NEW_HEAD=$(git rev-parse HEAD)
echo "  HEAD: $(git log -1 --oneline)"

if [[ "$OLD_HEAD" != "$NEW_HEAD" ]] && [[ "$RESTARTED_BY_SELF" != "--restarted" ]]; then
  echo "  💎 Deploy script updated. Relaunching..."
  exec bash "$0" "$SKIP_BUILD" "--restarted"
fi

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

# ── 4. Directory permissions (Auto-Fix) ──────────────────────
echo "▶ [4/6] Ensuring directory permissions..."
# Recursively fix ownership for the whole app (critical when running as root)
chown -R "$PLESK_USER:$PLESK_GROUP" "$APP_DIR"

# Ensure the upload directory exists and is writable
mkdir -p "$UPLOAD_DIR"
chown -R "$PLESK_USER:$PLESK_GROUP" "$APP_DIR/tmp/"
chmod -R 775 "$APP_DIR/tmp/"
# Fix basic permissions
find "$APP_DIR" -type d -exec chmod 755 {} \;
find "$APP_DIR" -type f -exec chmod 644 {} \;
chmod +x "$APP_DIR/scripts/"*.sh || true

echo "  ✅ Ownership and permissions synchronized for $PLESK_USER."

# ── 5. Restart Node process ──────────────────────────────────
echo "▶ [5/6] Restarting Node process (Passenger)..."
mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"
echo "  Touched tmp/restart.txt. Waiting for Passenger to cycle..."
sleep 5

# ── 6. Health check ──────────────────────────────────────────
echo "▶ [6/6] Verifying API health..."
rm -f /tmp/ppp_ready.json # Clear stale check
for i in 1 2 3 4 5 6 7 8 9 10; do
  # Use -k/--insecure because loopback SSL on some servers fails
  # Use --max-time to avoid hanging curl
  HTTP=$(curl -s -k --max-time 10 -o /tmp/ppp_ready.json -w "%{http_code}" "$API_READY" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    echo ""
    echo "  ✅ API ready (HTTP 200)"
    cat /tmp/ppp_ready.json | python3 -m json.tool 2>/dev/null || cat /tmp/ppp_ready.json
    break
  fi
  if [[ "$HTTP" == "503" ]]; then
    echo ""
    echo "  ⚠️  API booting with errors (HTTP 503). Diagnostics received:"
    cat /tmp/ppp_ready.json | python3 -m json.tool 2>/dev/null || cat /tmp/ppp_ready.json
    # We don't break yet, maybe it's still initializing, or maybe we want to show logs
  fi
  echo "  Attempt $i/10 — HTTP $HTTP, retrying in 5s..."
  sleep 5
done

if [[ "$HTTP" != "200" ]]; then
  echo ""
  echo "  ❌ Health check failed after 10 attempts (HTTP $HTTP)"
  echo "  Last response summary:"
  head -c 500 /tmp/ppp_ready.json 2>/dev/null || echo "No response content"
  echo ""
  echo "  🔍 --- DEEP DIAGNOSTICS ---"
  echo "  Current User: $(whoami)"
  echo "  Node Version: $(node -v)"
  echo "  Memory free: $(free -m | awk '/^Mem:/{print $4 "MB"}')"
  echo ""
  echo "  --- ENVIRONMENT CHECK ---"
  [ -z "${DATABASE_URL:-}" ] && echo "  ⚠️  DATABASE_URL is NOT set in the shell environment." || echo "  ✅ DATABASE_URL is set."
  [ -z "${NODE_ENV:-}" ] && echo "  ⚠️  NODE_ENV is NOT set (defaulting to production)." || echo "  ✅ NODE_ENV=$NODE_ENV"
  echo ""
  echo "  --- LOG SEARCH (stderr.log) ---"
  [ -f "$APP_DIR/logs/stderr.log" ] && tail -n 50 "$APP_DIR/logs/stderr.log" || echo "  No logs found at $APP_DIR/logs/stderr.log"
  echo ""
  echo "  --- LOG SEARCH (Plesk/Passenger Error Log) ---"
  # Try common Plesk log locations relative to APP_DIR
  PLESK_LOGS="$APP_DIR/../../statistics/logs/error_log"
  if [ -f "$PLESK_LOGS" ]; then
    echo "  Found Plesk error_log. Last 20 lines:"
    tail -n 20 "$PLESK_LOGS" | grep -i "passenger\|node\|app" || echo "  (No relevant entries in last 20 lines)"
  else
    echo "  No Plesk error_log found at $PLESK_LOGS"
  fi
  echo ""
  echo "  --- SYSTEM LOGS ---"
  echo "  If you have sudo, try: journalctl -u preflight-api.service -n 50 --no-pager"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Deploy completo ✅  $(date '+%Y-%m-%d %H:%M:%S')   ║"
echo "║   Commit: $(git log -1 --format='%h %s' | cut -c1-38)   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
