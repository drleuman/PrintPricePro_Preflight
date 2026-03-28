#!/usr/bin/env bash
set -euo pipefail

IN="${IN:-/in/input.pdf}"
OUTDIR="${OUTDIR:-/out}"

mkdir -p "$OUTDIR"

# Basic validations
if [ ! -f "$IN" ]; then
  echo "[!] Missing input: $IN" >&2
  exit 2
fi

# Detect PDF header quickly
head -c 4 "$IN" | grep -q "%PDF" || echo "[!] Warning: input does not start with %PDF"

# 1) qpdf basic structural check (no execute)
qpdf --check "$IN" >"$OUTDIR/qpdf-check.txt" 2>&1 || true

# 2) pdfinfo metadata
pdfinfo "$IN" >"$OUTDIR/pdfinfo.txt" 2>&1 || true

# 3) Extract text (no JS execution; just parsing)
pdftotext "$IN" "$OUTDIR/text.txt" >/dev/null 2>&1 || true

# 4) Render 1st page to image (optional)
pdftoppm -f 1 -l 1 -png "$IN" "$OUTDIR/page" >/dev/null 2>&1 || true

# 5) If you must normalize via Ghostscript, keep it locked down:
#    -dSAFER is default in newer gs, but we force it.
gs -q -dNOPAUSE -dBATCH -dSAFER \
  -sDEVICE=pdfwrite \
  -sOutputFile="$OUTDIR/normalized.pdf" \
  "$IN" >"$OUTDIR/ghostscript.txt" 2>&1 || true

echo "[✓] Done. Outputs in $OUTDIR"
