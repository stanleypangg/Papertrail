#!/bin/bash
# Manual one-shot Marble world generation round-trip.
# Run from the worktree root with WLT_API_KEY set.
# Saves the resulting splat to data/splats/the-empress-last-tea-cached.splat
# so the mock provider has a real fallback for the demo.

set -euo pipefail

if [ -z "${WLT_API_KEY:-}" ]; then
  if [ -f .env.local ]; then
    set -a; source .env.local; set +a
  fi
fi

if [ -z "${WLT_API_KEY:-}" ]; then
  echo "ERROR: WLT_API_KEY is not set. Add it to .env.local or export it."
  exit 1
fi

mkdir -p data/splats

PROMPT="A 1920s Shanghai mansion tea parlour at dusk. Warm oil lamps glow against lacquered red and gold screens. Hand-painted scrolls hang on dark wood walls. A low rosewood tea table sits on a faded silk rug. Smoke from an incense burner drifts past blue-green ceramic vases. Cinematic, painterly, slightly mysterious."

echo "Submitting world generation request..."
GEN_RESPONSE=$(curl -sS -X POST "https://api.worldlabs.ai/marble/v1/worlds:generate" \
  -H "WLT-Api-Key: $WLT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "display_name": "sleuth-spike-the-empress-last-tea",
  "model": "marble-1.0-draft",
  "world_prompt": {
    "type": "text",
    "text_prompt": "$PROMPT"
  }
}
EOF
)")

OPERATION_ID=$(echo "$GEN_RESPONSE" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('operation_id') or d.get('name') or '')" 2>/dev/null || echo "")

if [ -z "$OPERATION_ID" ]; then
  echo "ERROR: did not get operation_id from generate response:"
  echo "$GEN_RESPONSE"
  exit 1
fi

echo "Operation: $OPERATION_ID"
echo "Polling..."

ATTEMPTS=0
MAX_ATTEMPTS=60
SLEEP_SECS=10

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  POLL_RESPONSE=$(curl -sS "https://api.worldlabs.ai/marble/v1/operations/$OPERATION_ID" \
    -H "WLT-Api-Key: $WLT_API_KEY")

  DONE=$(echo "$POLL_RESPONSE" | python3 -c "import json,sys;print(json.load(sys.stdin).get('done', False))" 2>/dev/null || echo "false")

  if [ "$DONE" = "True" ] || [ "$DONE" = "true" ]; then
    echo "Done."
    SPLAT_URL=$(echo "$POLL_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
result = data.get('response') or data.get('result') or {}
for key in ('splat_url', 'gaussian_splat_url', 'asset_url', 'world_url'):
    if key in result and result[key]:
        print(result[key])
        sys.exit(0)
contents = result.get('contents') or result.get('assets') or []
for c in contents:
    if isinstance(c, dict) and c.get('url'):
        print(c['url'])
        sys.exit(0)
print('')
" 2>/dev/null)

    if [ -z "$SPLAT_URL" ]; then
      echo "ERROR: operation done but no splat URL found in response:"
      echo "$POLL_RESPONSE"
      exit 1
    fi

    echo "Splat URL: $SPLAT_URL"
    echo "Downloading..."
    curl -sSL -o data/splats/the-empress-last-tea-cached.splat "$SPLAT_URL"
    SIZE=$(wc -c < data/splats/the-empress-last-tea-cached.splat)
    echo "Saved $SIZE bytes to data/splats/the-empress-last-tea-cached.splat"
    exit 0
  fi

  ATTEMPTS=$((ATTEMPTS + 1))
  echo "  attempt $ATTEMPTS/$MAX_ATTEMPTS — not done yet, sleeping $SLEEP_SECS s..."
  sleep $SLEEP_SECS
done

echo "ERROR: timeout after $((MAX_ATTEMPTS * SLEEP_SECS))s waiting for operation $OPERATION_ID"
exit 1
