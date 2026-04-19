#!/bin/bash
# Fetch Figma file JSON for this project.
# Usage:
#   FIGMA_TOKEN=figd_... bash scripts/fetch-figma.sh
# Token is read from env so it never lands in argv / ps / shell history.
set -euo pipefail
: "${FIGMA_TOKEN:?FIGMA_TOKEN env var is required}"
FILE_KEY="${1:-6JhV6LiGCCbBLTl7VJlaFz}"
OUT="${2:-./figma.json}"
DEPTH="${3:-8}"
curl -sS -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY?depth=$DEPTH" \
  -o "$OUT"
printf 'wrote %s (%d bytes)\n' "$OUT" "$(wc -c < "$OUT")"
