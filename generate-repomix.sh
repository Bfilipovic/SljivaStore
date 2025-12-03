#!/bin/bash

# Generate Repomix for both main project and explorer project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PROJECT_DIR="$SCRIPT_DIR"
EXPLORER_DIR="$SCRIPT_DIR/explorer"

echo "📦 Generating Repomix outputs..."
echo ""

# Generate repomix for main project
echo "1️⃣  Generating repomix for main project..."
cd "$MAIN_PROJECT_DIR"
npx repomix --output orch_ai_strator/context/repomix-output.xml

echo ""
echo "2️⃣  Generating repomix for explorer project..."
cd "$EXPLORER_DIR"
npx repomix --output repomix-output.xml

echo ""
echo "✅ Repomix generation complete!"
echo ""
echo "📁 Output files:"
echo "   - Main project: orch_ai_strator/context/repomix-output.xml"
echo "   - Explorer: explorer/repomix-output.xml"

