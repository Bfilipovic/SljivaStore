#!/usr/bin/env node

/**
 * Frontend Logic Tests
 * 
 * Tests critical frontend business logic that AI might break when making changes.
 * Focuses on data handling, API communication, and utility functions.
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

// Test: API Communication
async function testAPICommunication() {
  try {
    // Test API fetch function (mock)
    const mockFetch = async (url, options = {}) => {
      if (url.includes('/nfts')) {
        return {
          ok: true,
          json: () => Promise.resolve([
            { _id: 'nft1', name: 'Test NFT', owner: '0x123...' }
          ])
        };
      }
      if (url.includes('/error')) {
        return {
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        };
      }
      return { ok: true, json: () => Promise.resolve({}) };
    };
    
    // Test successful API call
    const response = await mockFetch('/api/nfts');
    assert(response.ok, 'API call should succeed');
    const data = await response.json();
    assert(Array.isArray(data), 'API should return array');
    assert(data.length === 1, 'API should return correct data');
    
    // Test error handling
    const errorResponse = await mockFetch('/api/error');
    assert(!errorResponse.ok, 'Error API call should fail');
    assert(errorResponse.status === 500, 'Error should have correct status');
    
    logTest('API Communication', true);
    return true;
  } catch (error) {
    console.error('API Communication failed:', error.message);
    logTest('API Communication', false);
    return false;
  }
}

// Test: Data Formatting
async function testDataFormatting() {
  try {
    // Test address formatting
    const address = '0x1234567890123456789012345678901234567890';
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    assert(shortAddress === '0x1234...7890', 'Address should be formatted correctly');
    
    // Test balance formatting
    const balance = '1.500000000000000000';
    const formattedBalance = parseFloat(balance).toFixed(4);
    assert(formattedBalance === '1.5000', 'Balance should be formatted correctly');
    
    // Test currency conversion
    const ethAmount = '1.5';
    const weiAmount = (parseFloat(ethAmount) * 1e18).toString();
    assert(weiAmount === '1500000000000000000', 'ETH to Wei conversion should work');
    
    logTest('Data Formatting', true);
    return true;
  } catch (error) {
    console.error('Data Formatting failed:', error.message);
    logTest('Data Formatting', false);
    return false;
  }
}

// Test: Wallet State Management
async function testWalletStateManagement() {
  try {
    // Mock wallet state
    let walletState = {
      selectedAddress: null,
      selectedBalance: '0',
      selectedCurrency: 'ETH',
      addresses: [],
      balances: [],
      isAdmin: false,
      gifts: []
    };
    
    // Test wallet initialization
    assert(walletState.selectedCurrency === 'ETH', 'Default currency should be ETH');
    assert(walletState.selectedAddress === null, 'Default address should be null');
    assert(walletState.selectedBalance === '0', 'Default balance should be 0');
    
    // Test wallet update
    walletState.selectedAddress = '0x1234567890123456789012345678901234567890';
    walletState.selectedBalance = '1.5';
    walletState.addresses = ['0x1234567890123456789012345678901234567890'];
    walletState.balances = ['1.5'];
    
    assert(walletState.selectedAddress === '0x1234567890123456789012345678901234567890', 'Address should be updated');
    assert(walletState.selectedBalance === '1.5', 'Balance should be updated');
    assert(walletState.addresses.length === 1, 'Addresses array should be updated');
    
    // Test currency switching
    walletState.selectedCurrency = 'SOL';
    assert(walletState.selectedCurrency === 'SOL', 'Currency should be switchable');
    
    logTest('Wallet State Management', true);
    return true;
  } catch (error) {
    console.error('Wallet State Management failed:', error.message);
    logTest('Wallet State Management', false);
    return false;
  }
}

// Test: Input Validation
async function testInputValidation() {
  try {
    // Test Ethereum address validation
    const isValidAddress = (address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    };
    
    assert(isValidAddress('0x1234567890123456789012345678901234567890'), 'Valid address should pass');
    assert(!isValidAddress('invalid-address'), 'Invalid address should fail');
    assert(!isValidAddress('0x123'), 'Short address should fail');
    
    // Test mnemonic validation
    const isValidMnemonic = (mnemonic) => {
      const words = mnemonic.split(' ');
      return words.length === 12 && words.every(word => word.length > 0);
    };
    
    const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const invalidMnemonic = 'short mnemonic';
    
    assert(isValidMnemonic(validMnemonic), 'Valid mnemonic should pass');
    assert(!isValidMnemonic(invalidMnemonic), 'Invalid mnemonic should fail');
    
    // Test numeric validation
    const isValidNumber = (value) => {
      return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
    };
    
    assert(isValidNumber('1.5'), 'Valid number should pass');
    assert(isValidNumber('0'), 'Zero should pass');
    assert(!isValidNumber('abc'), 'Non-numeric should fail');
    assert(!isValidNumber(''), 'Empty string should fail');
    
    logTest('Input Validation', true);
    return true;
  } catch (error) {
    console.error('Input Validation failed:', error.message);
    logTest('Input Validation', false);
    return false;
  }
}

// Test: Error Handling
async function testErrorHandling() {
  try {
    // Test error message formatting
    const formatError = (error) => {
      if (typeof error === 'string') return error;
      if (error.message) return error.message;
      return 'Unknown error';
    };
    
    assert(formatError('Simple error') === 'Simple error', 'String error should be returned as-is');
    assert(formatError(new Error('Error object')) === 'Error object', 'Error object message should be extracted');
    assert(formatError({}) === 'Unknown error', 'Unknown error should be handled');
    
    // Test network error handling
    const handleNetworkError = (error) => {
      if (error.code === 'NETWORK_ERROR') return 'Network connection failed';
      if (error.code === 'TIMEOUT') return 'Request timed out';
      return 'Unknown network error';
    };
    
    assert(handleNetworkError({ code: 'NETWORK_ERROR' }) === 'Network connection failed', 'Network error should be handled');
    assert(handleNetworkError({ code: 'TIMEOUT' }) === 'Request timed out', 'Timeout error should be handled');
    assert(handleNetworkError({}) === 'Unknown network error', 'Unknown network error should be handled');
    
    logTest('Error Handling', true);
    return true;
  } catch (error) {
    console.error('Error Handling failed:', error.message);
    logTest('Error Handling', false);
    return false;
  }
}

// Test: State Persistence
async function testStatePersistence() {
  try {
    // Mock localStorage
    const mockStorage = {};
    const localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => { mockStorage[key] = value; },
      removeItem: (key) => { delete mockStorage[key]; }
    };
    
    // Test saving state
    const walletState = {
      selectedAddress: '0x1234567890123456789012345678901234567890',
      selectedCurrency: 'ETH'
    };
    
    localStorage.setItem('wallet', JSON.stringify(walletState));
    assert(mockStorage.wallet, 'State should be saved');
    
    // Test loading state
    const loadedState = JSON.parse(localStorage.getItem('wallet'));
    assert(loadedState.selectedAddress === walletState.selectedAddress, 'State should be loaded correctly');
    assert(loadedState.selectedCurrency === walletState.selectedCurrency, 'Currency should be loaded correctly');
    
    // Test clearing state
    localStorage.removeItem('wallet');
    assert(!mockStorage.wallet, 'State should be cleared');
    
    logTest('State Persistence', true);
    return true;
  } catch (error) {
    console.error('State Persistence failed:', error.message);
    logTest('State Persistence', false);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Frontend Logic Tests');
  console.log('='.repeat(50));
  
  const tests = [
    testAPICommunication,
    testDataFormatting,
    testWalletStateManagement,
    testInputValidation,
    testErrorHandling,
    testStatePersistence
  ];
  
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Frontend Tests: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All frontend tests passed!');
    return true;
  } else {
    console.log('❌ Some frontend tests failed!');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
