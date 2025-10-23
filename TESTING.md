# Testing Framework for AI-Assisted Development

This testing framework is optimized for **regression testing** when AI assistants (like me) edit your code. It ensures that existing functionality continues to work after changes.

## 🚀 Quick Start

### After AI makes changes to your code:
```bash
# Quick regression check (fast)
./regression-test.sh quick

# Full regression check (comprehensive)
./regression-test.sh full

# Smart check (quick first, then full if quick passes)
./regression-test.sh
```

## 📁 Test Structure

```
/tests/
├── regression/           # Tests that catch regressions
│   ├── core-business-logic.test.js    # Database operations, business rules
│   ├── blockchain-integration.test.js # Crypto operations, chainId bugs
│   └── ui-workflows.test.ts           # Frontend state management
├── templates/            # Copy these for new features
│   ├── service-template.test.js       # Backend service tests
│   └── component-template.test.ts     # Frontend component tests
├── unit/                 # Individual function tests
└── integration/          # Multi-component tests
```

## 🎯 Regression Test Categories

### 1. **Core Business Logic** (`core-business-logic.test.js`)
- ✅ NFT creation, ownership, updates
- ✅ Part creation and linking to NFTs
- ✅ Transaction recording and retrieval
- ✅ Data integrity and relationships
- ✅ Address case insensitivity

### 2. **Blockchain Integration** (`blockchain-integration.test.js`)
- ✅ Ethereum address validation
- ✅ Chain ID validation (catches chainId bugs)
- ✅ ETH amount formatting/parsing
- ✅ Transaction structure validation
- ✅ Mnemonic validation

### 3. **UI Workflows** (`ui-workflows.test.ts`)
- ✅ Wallet state management
- ✅ Currency switching
- ✅ API integration
- ✅ Error handling
- ✅ State persistence

## 🔧 Adding Tests for New Features

### For Backend Services:
1. Copy `backend/tests/templates/service-template.test.js`
2. Rename to `your-service.test.js`
3. Modify the template for your service
4. Add to regression tests if it's critical functionality

### For Frontend Components:
1. Copy `frontend/src/tests/templates/component-template.test.ts`
2. Rename to `your-component.test.ts`
3. Modify the template for your component
4. Add to regression tests if it's critical functionality

## ⚡ Test Execution Modes

### Quick Tests (`./regression-test.sh quick`)
- **Duration**: ~30 seconds
- **Scope**: Core regression tests only
- **Use**: After small changes, quick verification

### Full Tests (`./regression-test.sh full`)
- **Duration**: ~2 minutes
- **Scope**: All tests including templates
- **Use**: Before major releases, comprehensive verification

### Smart Check (`./regression-test.sh`)
- **Duration**: Variable (quick first, then full if needed)
- **Scope**: Quick tests first, full tests if quick passes
- **Use**: Default mode, best balance of speed and coverage

## 🐛 What These Tests Catch

### Database Issues:
- Missing required fields
- Broken relationships between NFTs and parts
- Address case sensitivity problems
- Data integrity violations

### Blockchain Issues:
- Invalid chain IDs (like the chainId overflow bug)
- Malformed Ethereum addresses
- Incorrect ETH amount formatting
- Transaction structure problems

### Frontend Issues:
- Wallet state corruption
- API integration failures
- UI state management bugs
- Error handling problems

## 📊 Test Coverage

Current coverage:
- ✅ **Backend**: Core business logic, blockchain validation
- ✅ **Frontend**: Wallet management, API integration
- ✅ **Templates**: Easy test creation for new features
- ⏳ **E2E**: End-to-end user workflows (planned)

## 🔄 CI/CD Integration

Add to your deployment pipeline:
```bash
# In your CI/CD script
./regression-test.sh full
if [ $? -eq 0 ]; then
    echo "No regressions detected, proceeding with deployment"
else
    echo "Regressions detected, stopping deployment"
    exit 1
fi
```

## 🎯 Best Practices

1. **Run quick tests** after every AI-assisted change
2. **Run full tests** before merging to main branch
3. **Add regression tests** for any bug that gets fixed
4. **Use templates** when adding new features
5. **Keep tests fast** - they should run in under 2 minutes

## 🚨 When Tests Fail

1. **Check the error message** - it usually points to the exact issue
2. **Review recent changes** - what was modified recently?
3. **Run individual test files** to isolate the problem
4. **Check if it's a real regression** or just a test that needs updating

---

**Remember**: These tests are your safety net when AI assistants modify your code. They catch regressions before they reach production! 🛡️
