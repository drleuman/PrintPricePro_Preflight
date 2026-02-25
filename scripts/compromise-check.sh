#!/usr/bin/env bash
set -euo pipefail

# compromise-check.sh
# Quick host compromise indicators scan (non-destructive).
#
# Usage:
#   sudo bash scripts/compromise-check.sh /var/www/vhosts/printprice.pro/preflight.printprice.pro security-reports
#
# Notes:
# - Does NOT delete/kill anything. Only reads and reports.
# - Designed for Node/PDF-processing servers (Ghostscript/poppler/qpdf) & typical web roots.

ROOT="${1:-/var/www}"
OUTDIR="${2:-security-reports}"
TS="$(date -Iseconds)"
HOST="$(hostname)"
USER_NOW="$(whoami)"

mkdir -p "$OUTDIR"
REPORT="$OUTDIR/compromise-check_${HOST}_$(echo "$TS" | tr ':' '-').log"
JSON="$OUTDIR/compromise-check_${HOST}_$(echo "$TS" | tr ':' '-').json"

# ---------- helpers ----------
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
h()     { echo; echo "=== $* ==="; }

has() { command -v "$1" >/dev/null 2>&1; }

# Severity counters
CRIT=0
HIGH=0
MED=0
LOW=0

flag() {
  # flag <SEV> <MESSAGE>
  local sev="$1"; shift
  local msg="$*"
  case "$sev" in
    CRITICAL) CRIT=$((CRIT+1));;
    HIGH) HIGH=$((HIGH+1));;
    MEDIUM) MED=$((MED+1));;
    LOW) LOW=$((LOW+1));;
  esac
  echo "[$sev] $msg"
}

# Safe grep wrapper
rg_or_grep() {
  local pattern="$1"; shift
  local target="$1"; shift || true
  if has rg; then
    rg -n --hidden --no-ignore --max-filesize 2M "$pattern" "$target" 2>/dev/null || true
  else
    grep -RIn --exclude-dir=node_modules --exclude-dir=.git --binary-files=without-match \
      -E "$pattern" "$target" 2>/dev/null || true
  fi
}

# ---------- begin ----------
{
  echo "COMPROMISE CHECK REPORT"
  echo "Timestamp: $TS"
  echo "Host: $HOST"
  echo "User: $USER_NOW"
  echo "Root scope: $ROOT"
  echo "------------------------------------------------------------"

  # 1) System basics
  h "System"
  uname -a || true
  uptime || true
  date || true

  # 2) Listeners / outbound connections
  h "Network listeners"
  if has ss; then ss -lntup || true; elif has netstat; then netstat -lntup || true; fi

  h "Established outbound connections (top 50)"
  if has ss; then ss -ntp state established | head -n 60 || true; elif has netstat; then netstat -ntp | head -n 60 || true; fi

  # 3) Suspicious processes (miners / curl loops / weird shells)
  h "Processes (top CPU/MEM)"
  ps auxwww --sort=-%cpu | head -n 35 || true
  echo
  ps auxwww --sort=-%mem | head -n 35 || true

  h "Process indicators (miners / suspicious names)"
  SUSP_PROC_REGEX='(xmrig|minerd|cpuminer|cryptonight|stratum|kdevtmpfsi|kinsing|watchdog|sysupdate|\.x[a-z0-9]{3,}|bash -c|curl .*sh|wget .*sh|python .*base64|perl .*base64|nc -e|socat|reverse shell)'
  PROC_HITS="$(ps auxwww | grep -E "$SUSP_PROC_REGEX" | grep -v grep || true)"
  if [ -n "$PROC_HITS" ]; then
    flag HIGH "Suspicious process patterns detected"
    echo "$PROC_HITS"
  else
    echo "No obvious miner/suspicious process patterns found."
  fi

  # 4) Persistence: cron/systemd/pm2
  h "Cron / systemd timers"
  (crontab -l 2>/dev/null || true)
  echo
  ls -la /etc/cron.* 2>/dev/null || true
  echo
  systemctl list-timers --all 2>/dev/null | head -n 120 || true

  h "Systemd services with suspicious ExecStart (quick scan)"
  if has systemctl; then
    # Print service files and look for curl|wget|bash -c|nc|python -c
    svc_list="$(systemctl list-unit-files --type=service --no-pager 2>/dev/null | awk 'NR>1{print $1}' | head -n 4000)"
    echo "$svc_list" | while read -r svc; do
      [ -n "$svc" ] || continue
      f="$(systemctl show -p FragmentPath --value "$svc" 2>/dev/null || true)"
      [ -f "$f" ] || continue
      if grep -Eiq '(curl|wget|bash\s+-c|nc\s|socat|python\s+-c|perl\s+-e)' "$f"; then
        flag MEDIUM "Suspicious pattern in service file: $svc ($f)"
        grep -Ein '(ExecStart|curl|wget|bash\s+-c|nc\s|socat|python\s+-c|perl\s+-e)' "$f" | head -n 40
      fi
    done
  else
    echo "systemctl not available."
  fi

  h "PM2 (if present)"
  if has pm2; then
    pm2 list || true
    pm2 startup 2>/dev/null | head -n 30 || true
    pm2 save 2>/dev/null | head -n 20 || true
  else
    echo "pm2 not found."
  fi

  # 5) Web root quick IOC scan (recent changes + executable files)
  h "Recently modified files in scope (last 72h) - excluding node_modules"
  find "$ROOT" -type f -mtime -3 \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -printf "%TY-%Tm-%Td %TH:%TM  %s  %p\n" 2>/dev/null | sort -r | head -n 250 || true

  h "Executable or script-like files in writable-ish dirs (uploads/tmp/cache/logs)"
  for d in \
    "$ROOT" \
    "$ROOT/uploads" \
    "$ROOT/upload" \
    "$ROOT/tmp" \
    "$ROOT/cache" \
    "$ROOT/logs" \
    "/tmp" \
    "/var/tmp"
  do
    [ -d "$d" ] || continue
    echo "-- $d"
    find "$d" -type f \( \
      -name "*.php" -o -name "*.phtml" -o -name "*.sh" -o -name "*.py" -o -name "*.pl" -o -name "*.cgi" -o -name "*.so" \
      -o -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \
    \) -printf "%TY-%Tm-%Td %TH:%TM  %s  %p\n" 2>/dev/null | sort -r | head -n 180 || true
  done

  # 6) Key IOC patterns in code (RCE + loaders + obfuscation)
  h "IOC grep in code (excluding node_modules)"
  IOC_PATTERN='(child_process|execSync|spawn\(|fork\(|eval\(|new\s+Function|vm\.runIn|curl\s+http|wget\s+http|base64,|atob\(|Buffer\.from\(.+base64|stratum\+tcp|xmrig|kdevtmpfsi|/bin/sh|nc\s+-e|socat|chmod\s+\+x|crontab|systemctl\s+enable)'
  IOC_HITS="$(rg_or_grep "$IOC_PATTERN" "$ROOT" | head -n 250 || true)"
  if [ -n "$IOC_HITS" ]; then
    flag MEDIUM "IOC-like patterns found in repository/filesystem (review hits; may include legitimate usage)"
    echo "$IOC_HITS"
  else
    echo "No IOC-like patterns found with basic grep."
  fi

  # 7) SSH keys & authorized_keys quick check
  h "SSH authorized_keys check"
  for k in "/root/.ssh/authorized_keys" "$HOME/.ssh/authorized_keys"; do
    if [ -f "$k" ]; then
      flag MEDIUM "authorized_keys present: $k (verify expected keys only)"
      sed -n '1,200p' "$k" | sed 's/^/  /'
    fi
  done

  # 8) Plesk / vhosts typical: suspicious PHP in web roots (if any)
  h "Potential webshell patterns (php) under root (light scan)"
  # Not too aggressive; scans some classic markers.
  WEBSHELL_PATTERN='(base64_decode\(|gzinflate\(|str_rot13\(|eval\(\s*\$_(POST|GET|REQUEST)|assert\(\s*\$_(POST|GET|REQUEST)|preg_replace\(.*/e|shell_exec\(|passthru\(|system\(|`[^`]+`)'
  WS_HITS="$(rg_or_grep "$WEBSHELL_PATTERN" "$ROOT" | head -n 250 || true)"
  if [ -n "$WS_HITS" ]; then
    flag HIGH "Possible webshell-like PHP patterns found (verify carefully; can be false positives)"
    echo "$WS_HITS"
  else
    echo "No obvious webshell patterns found in quick scan."
  fi

  # 9) Suspicious PDFs check (light heuristic without parsing)
  h "Suspicious PDF token scan (first pass)"
  PDF_DIRS=()
  for d in "$ROOT" "$ROOT/uploads" "$ROOT/upload" "$ROOT/tmp" "$ROOT/cache"; do
    [ -d "$d" ] && PDF_DIRS+=("$d")
  done

  if [ ${#PDF_DIRS[@]} -gt 0 ]; then
    # Search tokens within PDFs (strings) - can be heavy; cap results
    PDF_TOKEN_PATTERN='(/JavaScript|/JS|/OpenAction|/AA|/Launch|/EmbeddedFile|/XFA|/RichMedia|http://|https://)'
    # Grep only first few MB of each PDF would be better; keep light:
    for d in "${PDF_DIRS[@]}"; do
      echo "-- $d"
      find "$d" -type f -name "*.pdf" -size -150M 2>/dev/null | head -n 200 | while read -r pdf; do
        # grep in binary safely
        if grep -aEiq "$PDF_TOKEN_PATTERN" "$pdf"; then
          flag MEDIUM "PDF contains suspicious tokens: $pdf"
          echo "  -> $(grep -aEio "$PDF_TOKEN_PATTERN" "$pdf" | head -n 20 | tr '\n' ' ')"
        fi
      done
    done
  else
    echo "No candidate PDF directories found."
  fi

  # 10) Summary + recommendations
  h "Summary"
  echo "Findings count:"
  echo "  CRITICAL: $CRIT"
  echo "  HIGH:     $HIGH"
  echo "  MEDIUM:   $MED"
  echo "  LOW:      $LOW"

  echo
  if [ "$CRIT" -gt 0 ]; then
    red "Overall: NOT CLEAN (CRITICAL findings present). Initiate incident response immediately."
  elif [ "$HIGH" -gt 0 ]; then
    yellow "Overall: SUSPICIOUS (HIGH findings present). Triage required."
  elif [ "$MED" -gt 0 ]; then
    yellow "Overall: REVIEW (MEDIUM findings present). Verify and harden."
  else
    green "Overall: CLEAN (No significant indicators found in this quick pass)."
  fi

  echo
  echo "Next steps (if suspicious):"
  echo "  1) Quarantine uploads and stop PDF processing temporarily."
  echo "  2) Rotate secrets (API keys, tokens, JWT secrets)."
  echo "  3) Take a filesystem snapshot + logs for forensics."
  echo "  4) Rebuild/redeploy from clean source and re-run scans."
  echo "------------------------------------------------------------"
} | tee "$REPORT"

# Write a small JSON summary too
cat >"$JSON" <<EOF
{
  "timestamp": "$(printf '%s' "$TS")",
  "host": "$(printf '%s' "$HOST")",
  "root": "$(printf '%s' "$ROOT")",
  "counts": { "critical": $CRIT, "high": $HIGH, "medium": $MED, "low": $LOW },
  "report": "$(printf '%s' "$REPORT")"
}
EOF

echo
echo "[✓] Report saved: $REPORT"
echo "[✓] Summary JSON : $JSON"
