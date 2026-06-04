#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SW_FILE="app/serviceworker.js"
MAIN_FILE="app/app/Main.js"

# Extract current build number from service worker
CURRENT=$(grep -o "papyrus-v[0-9]*" "$SW_FILE" | grep -o "[0-9]*$")
if [ -z "$CURRENT" ]; then
    echo "Error: could not find build number in $SW_FILE" >&2
    exit 1
fi

NEXT=$((CURRENT + 1))
echo "Bumping build: v$CURRENT → v$NEXT"

# Update serviceworker.js
sed -i '' "s/papyrus-v${CURRENT}/papyrus-v${NEXT}/g" "$SW_FILE"

# Update Main.js display string
sed -i '' "s/(build v${CURRENT})/(build v${NEXT})/g" "$MAIN_FILE"

echo "Updated $SW_FILE and $MAIN_FILE"

# Package the webOS app
echo "Packaging webOS app..."
palm-package app

IPK=$(ls -t com.palm.codepoet.papyrus_*.ipk 2>/dev/null | head -1)
if [ -n "$IPK" ]; then
    echo "Built: $IPK"
else
    echo "Warning: .ipk not found after packaging"
fi
