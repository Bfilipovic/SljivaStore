#!/bin/bash
# Script to enable Explorer access on a SljivaStore backend
# Usage: ./scripts/enable-explorer.sh <explorer-url-1> [explorer-url-2] ...

set -e

if [ $# -lt 1 ]; then
  echo "Usage: $0 <explorer-url-1> [explorer-url-2] ..."
  echo ""
  echo "Example:"
  echo "  $0 https://explorer1.example.com https://explorer2.example.com"
  exit 1
fi

EXPLORER_ORIGINS="$@"

# Read current EXPLORER_ORIGINS from .env.production or .env
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE..."
  touch "$ENV_FILE"
fi

# Join origins with comma
ORIGINS_STRING=$(echo "$EXPLORER_ORIGINS" | tr ' ' ',')

# Update .env file
if grep -q "^EXPLORER_ORIGINS=" "$ENV_FILE"; then
  # Update existing line
  sed -i "s|^EXPLORER_ORIGINS=.*|EXPLORER_ORIGINS=$ORIGINS_STRING|" "$ENV_FILE"
else
  # Add new line
  echo "EXPLORER_ORIGINS=$ORIGINS_STRING" >> "$ENV_FILE"
fi

echo "✅ Explorer access enabled for:"
for origin in $EXPLORER_ORIGINS; do
  echo "   - $origin"
done
echo ""
echo "⚠️  Restart store server for changes to take effect"
echo ""
echo "To verify, test the Explorer API:"
echo "  curl -H \"Origin: $1\" https://your-store.com/api/explorer/stores"

