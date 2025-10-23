#!/bin/bash

# regression-test.sh - Fast regression testing for AI-assisted development
# Usage: ./regression-test.sh [quick|full]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to run quick regression tests
run_quick_tests() {
    print_header "Quick Regression Tests"
    
    # Backend core tests only
    if [ -d "backend" ]; then
        print_success "Running backend core tests..."
        cd backend
        npm test -- --testPathPatterns="regression|utils" --verbose=true
        cd ..
    fi
    
    # Frontend core tests only
    if [ -d "frontend" ]; then
        print_success "Running frontend core tests..."
        cd frontend
        npm test -- --run --reporter=verbose
        cd ..
    fi
    
    print_success "Quick regression tests completed!"
}

# Function to run full regression tests
run_full_tests() {
    print_header "Full Regression Tests"
    
    # Run all tests
    ./test-runner.sh all
    
    print_success "Full regression tests completed!"
}

# Function to check for regressions
check_regressions() {
    print_header "Regression Check"
    
    local quick_success=true
    local full_success=true
    
    # Quick tests
    if ! run_quick_tests; then
        quick_success=false
    fi
    
    echo ""
    
    # If quick tests pass, run full tests
    if [ "$quick_success" = true ]; then
        print_success "Quick tests passed, running full regression suite..."
        if ! run_full_tests; then
            full_success=false
        fi
    else
        print_error "Quick tests failed, skipping full regression suite"
        full_success=false
    fi
    
    echo ""
    print_header "Regression Check Summary"
    
    if [ "$quick_success" = true ]; then
        print_success "Quick tests: PASSED"
    else
        print_error "Quick tests: FAILED"
    fi
    
    if [ "$full_success" = true ]; then
        print_success "Full tests: PASSED"
    else
        print_error "Full tests: FAILED"
    fi
    
    if [ "$quick_success" = true ] && [ "$full_success" = true ]; then
        print_success "No regressions detected! 🎉"
        return 0
    else
        print_error "Regressions detected! Please review changes."
        return 1
    fi
}

# Main function
main() {
    local command="${1:-check}"
    
    case "$command" in
        "quick")
            run_quick_tests
            ;;
        "full")
            run_full_tests
            ;;
        "check")
            check_regressions
            ;;
        *)
            echo "Usage: $0 [quick|full|check]"
            echo ""
            echo "Commands:"
            echo "  quick   - Run only critical regression tests (fast)"
            echo "  full    - Run complete regression test suite"
            echo "  check   - Run quick tests, then full if quick passes (default)"
            echo ""
            echo "Examples:"
            echo "  $0              # Check for regressions"
            echo "  $0 quick        # Quick regression check"
            echo "  $0 full         # Full regression suite"
            exit 1
            ;;
    esac
}

# Check if script is run from project root
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Run main function with all arguments
main "$@"
