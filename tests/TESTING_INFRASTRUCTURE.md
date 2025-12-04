# Testing Infrastructure Documentation

## Purpose

This document explains the testing infrastructure for the Nomin project to help AI assistants understand how to run and maintain tests without learning from scratch each time.

## Test Structure

### Test File Locations

- **Backend Logic Tests**: `tests/backend-logic.test.js`
- **Backend User Transactions Tests**: `tests/backend-logic-user-transactions.test.js`
- **API Integration Tests**: `tests/api-integration.test.js`
- **API Integration User Transactions**: `tests/api-integration-user-transactions.test.js`
- **Frontend Logic Tests**: `tests/frontend-logic.test.js`
- **Frontend User Transactions Tests**: `tests/frontend-logic-user-transactions.test.js`
- **Integration Hash Verification Test**: `tests/integration-hash-verification.test.mjs` (ES module)

### Test Types

1. **Backend Logic Tests**: Unit tests for business logic, validation, data structures
2. **API Integration Tests**: Tests that check actual API endpoints and database connections
3. **Frontend Logic Tests**: Tests for frontend data formatting and validation
4. **Integration Tests**: End-to-end tests that use actual services and database

## Running Tests

### Backend Logic Tests
```bash
node tests/backend-logic.test.js
node tests/backend-logic-user-transactions.test.js
```

### API Integration Tests
```bash
node tests/api-integration.test.js
node tests/api-integration-user-transactions.test.js
```

### Frontend Logic Tests
```bash
node tests/frontend-logic.test.js
node tests/frontend-logic-user-transactions.test.js
```

### Integration Hash Verification Test
```bash
node tests/integration-hash-verification.test.mjs
```

**Note**: The integration test uses ES modules (`.mjs` extension) and requires a running MongoDB instance.

## Test Patterns

### Assertion Pattern
All tests use a simple assertion pattern:
```javascript
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
```

### Test Logging
Tests log results using:
```javascript
function logTest(testName, passed) {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${testName}`);
}
```

### Test Runner Pattern
Tests typically follow this pattern:
```javascript
async function runTests() {
  const tests = [test1, test2, test3];
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  const passed = results.filter(Boolean).length;
  console.log(`📊 Tests: ${passed}/${results.length} passed`);
}
```

## Integration Test Details

### Hash Verification Integration Test

**File**: `tests/integration-hash-verification.test.mjs`

**Purpose**: Tests the complete transaction flow and hash-based verification system.

**Test Flow**:
1. Sets up two test users (makes them admins)
2. User 1 mints an NFT with parts
3. User 1 creates a listing for a part
4. User 2 creates a reservation
5. User 2 completes the transaction (buys the part)
6. User 2 creates and claims a gift (gifts part back to User 1)
7. Verifies part has exactly 2 transactions
8. Verifies all records use hash-based IDs

**Test Users**:
- USER1_ADDRESS: `0x1111111111111111111111111111111111111111`
- USER2_ADDRESS: `0x2222222222222222222222222222222222222222`

**Cleanup**: The test automatically cleans up all created test data.

**Requirements**:
- Running MongoDB instance
- Database connection configured in `backend/.env`
- Backend services must be importable

## Critical Rules for AI Assistants

### ⚠️ DO NOT:

1. **Never modify tests to make them pass without fixing the underlying issue**
   - If a test fails, fix the code being tested, not the test
   - Tests should fail when functionality is broken
   - Tests passing after code changes should indicate fixes, not test modifications

2. **Never skip assertions or make them less strict**
   - All assertions must remain as written
   - Do not add try-catch blocks that swallow test failures
   - Do not comment out failing tests

3. **Never change test expectations to match broken behavior**
   - If code behavior changes and tests fail, update the code to match expectations
   - If expectations need to change, document why in commit messages

4. **Never create tests that always pass**
   - Tests must validate actual functionality
   - Mock data must be realistic
   - Assertions must be meaningful

### ✅ DO:

1. **Fix the code when tests fail**
   - Understand why the test is failing
   - Fix the root cause in the implementation
   - Ensure tests pass with legitimate fixes

2. **Add new tests for new features**
   - Follow existing test patterns
   - Test both happy paths and edge cases
   - Use realistic test data

3. **Keep tests clean and maintainable**
   - Use descriptive test names
   - Add comments for complex test logic
   - Clean up test data after tests run

4. **Run all relevant tests before committing**
   - Run backend logic tests after backend changes
   - Run integration tests after significant changes
   - Verify no regressions introduced

## Test Data Management

### Integration Test Cleanup

The hash verification integration test (`integration-hash-verification.test.mjs`) includes automatic cleanup that:
- Removes all partial transactions for test users
- Removes all transactions for test users
- Removes all gifts for test users
- Removes all reservations for test users
- Removes all listings for test users
- Removes all parts and NFTs created during the test

### Test Isolation

- Each test should be independent
- Tests should not rely on data from other tests
- Use unique identifiers or cleanup between tests

## Common Issues

### ES Module Import Errors

If you see "Cannot use import statement outside a module":
- Check file extension: Use `.mjs` for ES modules
- Or ensure `"type": "module"` in package.json

### Database Connection Errors

If tests fail to connect to database:
- Check `backend/.env` file exists
- Verify MongoDB is running
- Check database connection string

### Test Timeout Issues

If tests hang:
- Check database connection
- Verify cleanup functions are running
- Look for unhandled promises

## Maintenance

### Adding New Tests

1. Follow existing test patterns
2. Use descriptive test names
3. Include cleanup if creating database records
4. Document any special setup requirements

### Updating Tests

When updating tests:
1. Keep assertions strict
2. Don't make tests easier to pass
3. Document why test expectations changed
4. Update this document if patterns change

## References

- Main project rules: `.cursorrules`
- Backend services: `backend/services/`
- Hash verification docs: `backend/docs/HASH_VERIFICATION.md`

## Quick Reference

```bash
# Run all backend logic tests
node tests/backend-logic.test.js
node tests/backend-logic-user-transactions.test.js

# Run integration test
node tests/integration-hash-verification.test.mjs

# Check test results
# All tests should show: ✅ Test Name
# Final summary should show: ✅ All tests passed!
```

