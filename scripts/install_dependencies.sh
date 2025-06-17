#!/usr/bin/env bash
# Ensure correct Node.js version and install dependencies for all parts.

echo "🔧 Checking Node.js version..."
REQUIRED="18.20.8"
CURRENT="$(node -v 2>/dev/null | tr -d 'v')"
if [ "$CURRENT" != "$REQUIRED" ]; then
  echo "⚠️  Please install Node.js v$REQUIRED (e.g., via nvm)"
  exit 1
fi

echo "✅ Node.js version OK: $CURRENT"

echo "📦 Installing backend dependencies..."
cd ../backend || exit
npm install

echo "📦 Installing frontend dependencies..."
cd ../frontend || exit
npm install

echo "📦 Installing Ethereum network (Hardhat) dependencies..."
cd ../eth-local || exit
npm install

echo "✅ All dependencies installed!"
