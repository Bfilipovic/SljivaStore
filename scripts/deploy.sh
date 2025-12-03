#!/bin/bash

# Deployment script for SljivaStore
# This script helps deploy the application with Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "🚀 SljivaStore Deployment Script"
echo ""

# Check if Arweave keyfile exists
KEYFILE_PATH="backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json"
if [ ! -f "$KEYFILE_PATH" ]; then
    echo "⚠️  WARNING: Arweave keyfile not found at $KEYFILE_PATH"
    echo "   The keyfile must be present for Arweave integration to work."
    echo "   You can transfer it using:"
    echo "   scp $KEYFILE_PATH user@server:/path/to/SljivaStore/backend/"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Arweave keyfile found"
    # Set secure permissions
    chmod 600 "$KEYFILE_PATH"
    echo "✅ Keyfile permissions set to 600"
fi

# Check for environment files
if [ ! -f "backend/.env.production" ]; then
    echo "⚠️  WARNING: backend/.env.production not found"
    echo "   Create it before deploying or the backend may not work correctly."
fi

if [ ! -f "frontend/.env.production" ]; then
    echo "⚠️  WARNING: frontend/.env.production not found"
    echo "   Create it before deploying or the frontend may not work correctly."
fi

echo ""
echo "📦 Building Docker images..."
docker-compose build

echo ""
echo "🔄 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "📝 Checking backend logs (last 20 lines)..."
docker-compose logs --tail=20 backend

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Check logs: docker-compose logs -f backend"
echo "   2. Verify Arweave: Look for 'Arweave initialized' in logs"
echo "   3. Test API: curl http://localhost/api/status/maintenance"
echo ""

