#!/usr/bin/env bash
set -euo pipefail

PDF="${1:?Usage: sandbox/run-pdf-sandbox.sh path/to/file.pdf}"
OUT="${2:-./sandbox-out}"

mkdir -p "$OUT"

docker build -t preflight-pdf-sandbox -f sandbox/Dockerfile sandbox

docker run --rm \
  --network none \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 256 \
  --memory 1024m \
  --cpus 1.0 \
  --read-only \
  -v "$(realpath "$PDF"):/in/input.pdf:ro" \
  -v "$(realpath "$OUT"):/out:rw" \
  preflight-pdf-sandbox
