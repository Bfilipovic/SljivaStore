#!/bin/bash

# AI Test Runner - Simple script for AI to run tests
# Usage: ./test.sh [quick|full]

echo "🤖 AI Test Runner"
echo "=================="

if [ "$1" = "quick" ]; then
    echo "Running quick tests (critical only)..."
    node tests/backend-logic.test.js && node tests/frontend-logic.test.js
elif [ "$1" = "full" ]; then
    echo "Running full test suite..."
    ./test-ai.js
else
    echo "Usage: $0 [quick|full]"
    echo ""
    echo "  quick  - Run only critical tests (backend + frontend logic)"
    echo "  full   - Run complete test suite (includes API integration)"
    echo ""
    echo "Examples:"
    echo "  $0 quick    # Fast test for code changes"
    echo "  $0 full     # Complete test before deployment"
fi
