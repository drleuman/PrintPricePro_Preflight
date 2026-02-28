#!/usr/bin/env bash
# preflight-check.sh — Production Hardening v2
# Usage: run manually before restart, or set as ExecStartPre in systemd unit.
# Strict mode: aborts if repo is dirty OR HEAD != origin/main OR server.js has syntax errors.
set -euo pipefail

APP=/var/www/vhosts/printprice.pro/preflight.printprice.pro
cd "$APP"

# 1) Sync remote refs (non-fatal)
git fetch origin main >/dev/null 2>&1 || true

# 2) Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ ABORT: Uncommitted changes detected:"
  git status --porcelain
  exit 1
fi

# 3) Check HEAD == origin/main (strict)
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")
if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
  echo "❌ ABORT: HEAD ($LOCAL) is not aligned with origin/main ($REMOTE)"
  echo "   Run: git reset --hard origin/main"
  exit 1
fi

# 4) Server.js syntax check
node --check server.js || { echo "❌ ABORT: server.js syntax error"; exit 1; }

# 5) Check for legacy imports (must return 0 results)
LEGACY=$(grep -rn "require.*['\"]\.\/server\/" \
  --include="*.js" --include="*.mjs" \
  --exclude-dir=node_modules --exclude-dir=server__legacy_disabled . 2>/dev/null || true)
if [ -n "$LEGACY" ]; then
  echo "❌ ABORT: Legacy ./server/ imports detected:"
  echo "$LEGACY"
  exit 1
fi

echo "✅ OK: repo clean, aligned with origin/main, syntax valid, no legacy imports"
