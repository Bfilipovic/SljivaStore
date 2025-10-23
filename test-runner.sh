#!/bin/bash

# test-runner.sh - Comprehensive test runner for SljivaStore project
# Usage: ./test-runner.sh [backend|frontend|all|coverage]

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

# Function to run backend tests
run_backend_tests() {
    print_header "Running Backend Tests"
    
    if [ ! -d "backend" ]; then
        print_error "Backend directory not found"
        return 1
    fi
    
    cd backend
    
    if [ ! -f "package.json" ]; then
        print_error "Backend package.json not found"
        return 1
    fi
    
    print_success "Installing backend dependencies..."
    npm install --silent
    
    print_success "Running backend unit tests..."
    npm run test
    
    print_success "Backend tests completed successfully!"
    cd ..
}

# Function to run frontend tests
run_frontend_tests() {
    print_header "Running Frontend Tests"
    
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory not found"
        return 1
    fi
    
    cd frontend
    
    if [ ! -f "package.json" ]; then
        print_error "Frontend package.json not found"
        return 1
    fi
    
    print_success "Installing frontend dependencies..."
    npm install --silent
    
    print_success "Running frontend unit tests..."
    npm run test
    
    print_success "Frontend tests completed successfully!"
    cd ..
}

# Function to run coverage reports
run_coverage() {
    print_header "Running Coverage Reports"
    
    # Backend coverage
    if [ -d "backend" ]; then
        print_success "Generating backend coverage..."
        cd backend
        npm run test:coverage
        print_success "Backend coverage report generated in backend/coverage/"
        cd ..
    fi
    
    # Frontend coverage
    if [ -d "frontend" ]; then
        print_success "Generating frontend coverage..."
        cd frontend
        npm run test:coverage
        print_success "Frontend coverage report generated in frontend/coverage/"
        cd ..
    fi
    
    print_success "Coverage reports completed!"
}

# Function to run all tests
run_all_tests() {
    print_header "Running All Tests"
    
    local backend_success=true
    local frontend_success=true
    
    # Run backend tests
    if ! run_backend_tests; then
        backend_success=false
    fi
    
    echo ""
    
    # Run frontend tests
    if ! run_frontend_tests; then
        frontend_success=false
    fi
    
    echo ""
    print_header "Test Summary"
    
    if [ "$backend_success" = true ]; then
        print_success "Backend tests: PASSED"
    else
        print_error "Backend tests: FAILED"
    fi
    
    if [ "$frontend_success" = true ]; then
        print_success "Frontend tests: PASSED"
    else
        print_error "Frontend tests: FAILED"
    fi
    
    if [ "$backend_success" = true ] && [ "$frontend_success" = true ]; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_error "Some tests failed!"
        return 1
    fi
}

# Main function
main() {
    local command="${1:-all}"
    
    case "$command" in
        "backend")
            run_backend_tests
            ;;
        "frontend")
            run_frontend_tests
            ;;
        "coverage")
            run_coverage
            ;;
        "all")
            run_all_tests
            ;;
        *)
            echo "Usage: $0 [backend|frontend|all|coverage]"
            echo ""
            echo "Commands:"
            echo "  backend   - Run only backend tests"
            echo "  frontend  - Run only frontend tests"
            echo "  all       - Run all tests (default)"
            echo "  coverage  - Generate coverage reports"
            echo ""
            echo "Examples:"
            echo "  $0              # Run all tests"
            echo "  $0 backend      # Run only backend tests"
            echo "  $0 coverage     # Generate coverage reports"
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
