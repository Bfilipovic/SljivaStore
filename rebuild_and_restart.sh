#!/bin/bash
# Script to rebuild and restart the main SljivaStore project
# Fetches latest code, builds, and restarts all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_LOG="$SCRIPT_DIR/build.log"

echo "🔄 Rebuilding and restarting SljivaStore..."

# Navigate to project root
cd "$SCRIPT_DIR" || exit 1

# Fetch and pull latest code
echo "📥 Fetching latest code..."
git fetch || echo "⚠️  Git fetch failed, continuing..."

echo "📥 Pulling latest code..."
git pull || echo "⚠️  Git pull failed or not a git repo, continuing..."

# Build Docker images and save output to log
echo "🔨 Building Docker images (output saved to build.log)..."
if sudo docker compose build > "$BUILD_LOG" 2>&1; then
    echo "✅ Build completed successfully"
    BUILD_ERROR=false
else
    echo "❌ Build failed! Check build.log for details"
    BUILD_ERROR=true
fi

# Check build log for warnings/errors
# Check for actual errors (excluding engine warnings which are usually non-critical)
ERRORS_IN_LOG=$(grep -iE "(error|failed)" "$BUILD_LOG" 2>/dev/null | grep -viE "(EBADENGINE|npm warn)" || true)
if [ -n "$ERRORS_IN_LOG" ]; then
    echo ""
    echo "⚠️  WARNING: Build log contains errors!"
    echo "   Review build.log for details:"
    echo "   tail -50 $BUILD_LOG"
    echo ""
    BUILD_ERROR=true
fi

# Check for engine version warnings separately (informational)
if grep -qi "EBADENGINE" "$BUILD_LOG" 2>/dev/null; then
    echo ""
    echo "⚠️  NOTE: Build log contains engine version warnings (Node.js version mismatch)"
    echo "   This may not be critical, but consider updating Node.js version in Dockerfile"
    echo ""
fi

# Start services in background
echo "🚀 Starting services in background..."
sudo docker compose up -d

# Wait a moment for services to start
sleep 3

# Show status
echo ""
echo "📊 Service status:"
echo "=========================================="
sudo docker compose ps

echo ""
if [ "$BUILD_ERROR" = true ]; then
    echo "⚠️  Build completed with warnings/errors - check build.log"
else
    echo "✅ All services rebuilt and restarted successfully!"
fi

echo ""
echo "📋 Monitor services with:"
echo "   ./monitor_backend.sh"
echo "   ./monitor_frontend.sh"
echo "   ./monitor_mongo.sh"
echo "   ./monitor_nginx.sh"
echo ""
echo "📝 Build log saved to: $BUILD_LOG"

