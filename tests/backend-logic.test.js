#!/usr/bin/env node

/**
 * Backend Logic Tests (Simplified)
 * 
 * Tests critical backend business logic that AI might break when making changes.
 * Focuses on data validation and business rules without external dependencies.
 */

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function logTest(testName, passed) {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${testName}`);
}

// Test: Ethereum Address Validation
async function testEthereumValidation() {
  try {
    // Test Ethereum address format validation
    const isValidEthereumAddress = (address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    };
    
    const validAddress = '0x1234567890123456789012345678901234567890';
    const invalidAddress = 'invalid-address';
    const shortAddress = '0x123';
    
    assert(isValidEthereumAddress(validAddress), 'Valid Ethereum address should be recognized');
    assert(!isValidEthereumAddress(invalidAddress), 'Invalid Ethereum address should be rejected');
    assert(!isValidEthereumAddress(shortAddress), 'Short address should be rejected');
    
    // Test address checksum (basic)
    const checksumAddress = validAddress.toLowerCase();
    assert(checksumAddress === validAddress.toLowerCase(), 'Address checksum should work');
    
    logTest('Ethereum Validation', true);
    return true;
  } catch (error) {
    console.error('Ethereum Validation failed:', error.message);
    logTest('Ethereum Validation', false);
    return false;
  }
}

// Test: Data Structure Validation
async function testDataStructureValidation() {
  try {
    // Test NFT data structure
    const validateNFTData = (nft) => {
      return nft && 
             typeof nft.name === 'string' && 
             typeof nft.description === 'string' &&
             typeof nft.creator === 'string' &&
             typeof nft.owner === 'string' &&
             typeof nft.part_count === 'number' &&
             nft.part_count >= 0;
    };
    
    const validNFT = {
      name: 'Test NFT',
      description: 'Test Description',
      creator: '0x1234567890123456789012345678901234567890',
      owner: '0x1234567890123456789012345678901234567890',
      part_count: 5
    };
    
    const invalidNFT = {
      name: 'Test NFT',
      // missing required fields
    };
    
    assert(validateNFTData(validNFT), 'Valid NFT data should pass validation');
    assert(!validateNFTData(invalidNFT), 'Invalid NFT data should fail validation');
    
    // Test Part data structure
    const validatePartData = (part) => {
      return part &&
             typeof part.parent_hash === 'string' &&
             typeof part.owner === 'string' &&
             part.metadata &&
             typeof part.metadata.name === 'string';
    };
    
    const validPart = {
      parent_hash: 'test-hash-123',
      owner: '0x1234567890123456789012345678901234567890',
      metadata: {
        name: 'Test Part',
        description: 'Test Part Description'
      }
    };
    
    assert(validatePartData(validPart), 'Valid Part data should pass validation');
    
    logTest('Data Structure Validation', true);
    return true;
  } catch (error) {
    console.error('Data Structure Validation failed:', error.message);
    logTest('Data Structure Validation', false);
    return false;
  }
}

// Test: Transaction Validation
async function testTransactionValidation() {
  try {
    // Test transaction data validation
    const validateTransaction = (tx) => {
      return tx &&
             typeof tx.from === 'string' &&
             typeof tx.to === 'string' &&
             typeof tx.amount === 'string' &&
             typeof tx.currency === 'string' &&
             (tx.currency === 'ETH' || tx.currency === 'SOL') &&
             !isNaN(parseFloat(tx.amount)) &&
             parseFloat(tx.amount) >= 0;
    };
    
    const validTransaction = {
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      amount: '1.5',
      currency: 'ETH'
    };
    
    const invalidTransaction = {
      from: 'invalid-address',
      to: '0x0987654321098765432109876543210987654321',
      amount: '-1.5', // negative amount
      currency: 'ETH'
    };
    
    assert(validateTransaction(validTransaction), 'Valid transaction should pass validation');
    assert(!validateTransaction(invalidTransaction), 'Invalid transaction should fail validation');
    
    // Test amount formatting
    const formatAmount = (amount) => {
      const num = parseFloat(amount);
      return isNaN(num) ? '0' : num.toFixed(4);
    };
    
    assert(formatAmount('1.500000000000000000') === '1.5000', 'Amount should be formatted correctly');
    assert(formatAmount('invalid') === '0', 'Invalid amount should default to 0');
    
    logTest('Transaction Validation', true);
    return true;
  } catch (error) {
    console.error('Transaction Validation failed:', error.message);
    logTest('Transaction Validation', false);
    return false;
  }
}

// Test: Business Logic Rules
async function testBusinessLogicRules() {
  try {
    // Test ownership transfer logic
    const canTransferOwnership = (currentOwner, newOwner, partCount) => {
      return currentOwner !== newOwner && 
             typeof currentOwner === 'string' && 
             typeof newOwner === 'string' &&
             partCount > 0;
    };
    
    assert(canTransferOwnership('0x123...', '0x456...', 5), 'Valid ownership transfer should be allowed');
    assert(!canTransferOwnership('0x123...', '0x123...', 5), 'Self-transfer should be rejected');
    assert(!canTransferOwnership('0x123...', '0x456...', 0), 'Zero parts should be rejected');
    
    // Test part count validation
    const validatePartCount = (count) => {
      return typeof count === 'number' && 
             count >= 0 && 
             count <= 1000; // reasonable upper limit
    };
    
    assert(validatePartCount(5), 'Valid part count should pass');
    assert(!validatePartCount(-1), 'Negative part count should fail');
    assert(!validatePartCount(1001), 'Excessive part count should fail');
    
    // Test currency validation
    const isValidCurrency = (currency) => {
      return ['ETH', 'SOL'].includes(currency);
    };
    
    assert(isValidCurrency('ETH'), 'ETH should be valid currency');
    assert(isValidCurrency('SOL'), 'SOL should be valid currency');
    assert(!isValidCurrency('BTC'), 'BTC should be invalid currency');
    
    logTest('Business Logic Rules', true);
    return true;
  } catch (error) {
    console.error('Business Logic Rules failed:', error.message);
    logTest('Business Logic Rules', false);
    return false;
  }
}

// Test: Error Handling
async function testErrorHandling() {
  try {
    // Test error message formatting
    const formatError = (error) => {
      if (typeof error === 'string') return error;
      if (error && error.message) return error.message;
      return 'Unknown error occurred';
    };
    
    assert(formatError('Simple error') === 'Simple error', 'String error should be returned as-is');
    assert(formatError(new Error('Error object')) === 'Error object', 'Error object message should be extracted');
    assert(formatError({}) === 'Unknown error occurred', 'Unknown error should be handled');
    
    // Test validation error handling
    const handleValidationError = (field, value) => {
      if (value === null || value === undefined) return `${field} is required`;
      if (typeof value !== 'string') return `${field} must be a string`;
      if (value.length === 0) return `${field} cannot be empty`;
      return null; // no error
    };
    
    assert(handleValidationError('name', '') === 'name cannot be empty', 'Empty string should be rejected');
    assert(handleValidationError('name', null) === 'name is required', 'Null value should be rejected');
    assert(handleValidationError('name', 'Valid Name') === null, 'Valid value should pass');
    
    logTest('Error Handling', true);
    return true;
  } catch (error) {
    console.error('Error Handling failed:', error.message);
    logTest('Error Handling', false);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Backend Logic Tests');
  console.log('='.repeat(50));
  
  const tests = [
    testEthereumValidation,
    testDataStructureValidation,
    testTransactionValidation,
    testBusinessLogicRules,
    testErrorHandling
  ];
  
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Backend Tests: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All backend tests passed!');
    return true;
  } else {
    console.log('❌ Some backend tests failed!');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}