#!/bin/bash

# changeNet.sh - Switch between testnet and mainnet configurations
# Usage: ./changeNet.sh -test or ./changeNet.sh -main

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to replace URLs in specific files
replace_urls() {
    local search_pattern="$1"
    local replace_pattern="$2"
    local description="$3"
    
    print_status "Switching $description..."
    
    # Target only specific files we know contain these URLs
    local files=(
        "backend/services/ethService.js"
        "frontend/src/lib/ethService.ts"
        "frontend/src/lib/solService.ts"
        "frontend/src/routes/part/[id]/+page.svelte"
    )
    
    local changed=false
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            if sed -i "s|$search_pattern|$replace_pattern|g" "$file"; then
                changed=true
            fi
        fi
    done
    
    if [ "$changed" = true ]; then
        print_status "✓ $description updated"
    else
        print_warning "No files updated for $description"
    fi
}

# Main function
main() {
    if [ "$1" = "-test" ]; then
        print_status "Switching to TESTNET configuration..."
        
        # Ethereum provider URLs
        replace_urls \
            "https://mainnet.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7" \
            "https://sepolia.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7" \
            "Ethereum provider (mainnet → sepolia)"
        
        # Solana provider URLs
        replace_urls \
            "https://api.mainnet-beta.solana.com" \
            "https://api.devnet.solana.com" \
            "Solana provider (mainnet → devnet)"
        
        # Ethereum explorer links
        replace_urls \
            "https://etherscan.io/tx/\${String(tx.chainTx)}" \
            "https://sepolia.etherscan.io/tx/\${String(tx.chainTx)}" \
            "Ethereum explorer (mainnet → sepolia)"
        
        # Solana explorer links
        replace_urls \
            "https://explorer.solana.com/tx/\${String(tx.chainTx)}" \
            "https://explorer.solana.com/tx/\${String(tx.chainTx)}?cluster=devnet" \
            "Solana explorer (mainnet → devnet)"
        
        # Chain ID for Ethereum
        replace_urls \
            "chainId: 1" \
            "chainId: 11155111" \
            "Ethereum chain ID (mainnet → sepolia)"
        
        print_status "🎉 Successfully switched to TESTNET!"
        print_warning "Remember to restart your backend and frontend services"
        
    elif [ "$1" = "-main" ]; then
        print_status "Switching to MAINNET configuration..."
        
        # Ethereum provider URLs
        replace_urls \
            "https://sepolia.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7" \
            "https://mainnet.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7" \
            "Ethereum provider (sepolia → mainnet)"
        
        # Solana provider URLs
        replace_urls \
            "https://api.devnet.solana.com" \
            "https://api.mainnet-beta.solana.com" \
            "Solana provider (devnet → mainnet)"
        
        # Ethereum explorer links
        replace_urls \
            "https://sepolia.etherscan.io/tx/\${String(tx.chainTx)}" \
            "https://etherscan.io/tx/\${String(tx.chainTx)}" \
            "Ethereum explorer (sepolia → mainnet)"
        
        # Solana explorer links
        replace_urls \
            "https://explorer.solana.com/tx/\${String(tx.chainTx)}?cluster=devnet" \
            "https://explorer.solana.com/tx/\${String(tx.chainTx)}" \
            "Solana explorer (devnet → mainnet)"
        
        # Chain ID for Ethereum
        replace_urls \
            "chainId: 11155111" \
            "chainId: 1" \
            "Ethereum chain ID (sepolia → mainnet)"
        
        print_status "🎉 Successfully switched to MAINNET!"
        print_warning "Remember to restart your backend and frontend services"
        
    else
        print_error "Invalid option!"
        echo "Usage: $0 [-test | -main]"
        echo ""
        echo "Options:"
        echo "  -test    Switch to testnet configuration (Sepolia + Devnet)"
        echo "  -main    Switch to mainnet configuration (Ethereum + Solana)"
        echo ""
        echo "Examples:"
        echo "  $0 -test    # Switch to testnet"
        echo "  $0 -main    # Switch to mainnet"
        exit 1
    fi
}

# Check if script is run from project root
if [ ! -f "package.json" ] && [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Run main function with all arguments
main "$@"
