#!/usr/bin/env bash
set -euo pipefail

# Quick IOC + persistence + suspicious changes scanner
# Usage:
#   bash scripts/server-audit.sh /var/www/vhosts/printprice.pro/preflight.printprice.pro security-reports

ROOT="${1:-.}"
OUT="${2:-security-reports}"
TS="$(date -Iseconds)"
HOST="$(hostname)"

mkdir -p "$OUT"
LOG="$OUT/server-audit-${HOST}-${TS}.log"

{
  echo "=== SERVER AUDIT ==="
  echo "Timestamp: $TS"
  echo "Host: $HOST"
  echo "Root: $ROOT"
  echo

  echo "== System =="
  uname -a || true
  whoami || true
  id || true
  uptime || true
  echo

  echo "== Network listeners =="
  (ss -lntup || netstat -lntup) 2>/dev/null || true
  echo

  echo "== Running processes (top suspicious) =="
  ps auxwww --sort=-%cpu | head -n 40 || true
  echo

  echo "== PM2 (if present) =="
  command -v pm2 >/dev/null && pm2 list || true
  echo

  echo "== Cron & timers =="
  crontab -l 2>/dev/null || true
  ls -la /etc/cron.* 2>/dev/null || true
  systemctl list-timers --all 2>/dev/null | head -n 80 || true
  echo

  echo "== Recently modified files (last 72h) under root =="
  find "$ROOT" -type f -mtime -3 -printf "%TY-%Tm-%Td %TH:%TM  %s  %p\n" 2>/dev/null | sort -r | head -n 300 || true
  echo

  echo "== Suspicious extensions in writable dirs =="
  for d in "$ROOT" "$ROOT/uploads" "$ROOT/public" "$ROOT/server" "$ROOT/tmp" "/tmp"; do
    [ -d "$d" ] || continue
    echo "-- $d"
    find "$d" -type f \( -name "*.php" -o -name "*.sh" -o -name "*.py" -o -name "*.pl" -o -name "*.cgi" \) \
      -printf "%TY-%Tm-%Td %TH:%TM  %s  %p\n" 2>/dev/null | sort -r | head -n 200 || true
  done
  echo

  echo "== Grep suspicious patterns (root, limited) =="
  rg -n --hidden --no-ignore --max-filesize 2M \
    "(child_process|execSync|spawn\\(|curl\\s|wget\\s|\\beval\\(|new\\s+Function|base64,|/bin/sh|nc\\s|bash\\s-?c)" \
    "$ROOT" 2>/dev/null | head -n 400 || true
  echo

  echo "== package scripts =="
  if [ -f "$ROOT/package.json" ]; then
    node -e "const p=require('${ROOT}/package.json'); console.log(JSON.stringify({name:p.name, scripts:p.scripts},null,2))" 2>/dev/null || true
  fi
  echo

  echo "== npm integrity quick checks =="
  if [ -f "$ROOT/package-lock.json" ]; then
    echo "-- package-lock.json present"
  fi
  command -v npm >/dev/null && (cd "$ROOT" && npm audit --omit=dev || true) || true
  echo

  echo "== SSH keys (root + current user) =="
  ls -la ~/.ssh 2>/dev/null || true
  ls -la /root/.ssh 2>/dev/null || true
  echo

  echo "== Users with shells =="
  awk -F: '($7 ~ /(bash|zsh|sh)$/){print $1 " -> " $7}' /etc/passwd 2>/dev/null || true
  echo

  echo "=== END ==="
} | tee "$LOG"

echo "[✓] Saved log: $LOG"
