#!/usr/bin/env bash
set -euo pipefail

# File Integrity Monitoring (FIM) Baseline Creator
# Usage:
#   bash scripts/fim-baseline.sh <target_dir> <baseline_file>

TARGET="${1:-.}"
BASELINE="${2:-security-reports/baseline.sha256}"

mkdir -p "$(dirname "$BASELINE")"

echo "[+] Creating FIM baseline for: $TARGET"
echo "[+] Destination: $BASELINE"

# Exclude obvious noise dirs: node_modules, .git, uploads, tmp, reports
find "$TARGET" -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/uploads/*" \
  -not -path "*/tmp/*" \
  -not -path "*/security-reports/*" \
  -not -path "*/emergency-reports/*" \
  -exec sha256sum {} + > "$BASELINE"

echo "[✓] Baseline created. To verify run: sha256sum -c $BASELINE --status || echo 'INTEGRITY BREACH DETECTED'"
