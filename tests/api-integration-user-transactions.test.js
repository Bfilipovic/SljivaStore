#!/usr/bin/env node

/**
 * API Integration Tests - User Transactions
 * 
 * Tests API endpoints and integration for user transaction functionality
 * Focuses on endpoint structure, service integration, and data flow
 */

const fs = require('fs');
const path = require('path');

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

const testDir = __dirname;

// Test: New Transaction API Endpoints Structure
async function testNewTransactionAPIEndpoints() {
  try {
    // Check if the transactions route file exists and has the new endpoints
    const transactionsRoutePath = path.join(testDir, '../../backend/routes/transactions.js');
    assert(fs.existsSync(transactionsRoutePath), 'Transactions route file should exist');
    
    const transactionsRouteContent = fs.readFileSync(transactionsRoutePath, 'utf-8');
    
    // Check for the new user endpoints
    assert(transactionsRouteContent.includes('/user/:address'), 'Should have user transactions endpoint');
    assert(transactionsRouteContent.includes('/user/:address/partial'), 'Should have user partial transactions endpoint');
    
    // Check for proper service imports
    assert(transactionsRouteContent.includes('getTransactionsByUser'), 'Should import getTransactionsByUser service');
    assert(transactionsRouteContent.includes('countTransactionsByUser'), 'Should import countTransactionsByUser service');
    assert(transactionsRouteContent.includes('getPartialTransactionsByUser'), 'Should import getPartialTransactionsByUser service');
    assert(transactionsRouteContent.includes('countPartialTransactionsByUser'), 'Should import countPartialTransactionsByUser service');
    
    // Check for proper error handling
    assert(transactionsRouteContent.includes('res.status(500)'), 'Should have error handling');
    assert(transactionsRouteContent.includes('res.json({ total, transactions })'), 'Should return proper response format');
    assert(transactionsRouteContent.includes('res.json({ total, partialTransactions })'), 'Should return proper partial response format');
    
    logTest('New Transaction API Endpoints Structure', true);
    return true;
  } catch (error) {
    console.error('New Transaction API Endpoints Structure test failed:', error.message);
    logTest('New Transaction API Endpoints Structure', false);
    return false;
  }
}

// Test: Transaction Service Layer Integration
async function testTransactionServiceLayerIntegration() {
  try {
    // Check service layer has the required functions
    const transactionServicePath = path.join(testDir, '../../backend/services/transactionService.js');
    assert(fs.existsSync(transactionServicePath), 'Transaction service file should exist');
    
    const transactionServiceContent = fs.readFileSync(transactionServicePath, 'utf-8');
    
    // Check for required function exports
    assert(transactionServiceContent.includes('export async function getTransactionsByUser'), 'Should export getTransactionsByUser function');
    assert(transactionServiceContent.includes('export async function countTransactionsByUser'), 'Should export countTransactionsByUser function');
    assert(transactionServiceContent.includes('export async function getPartialTransactionsByUser'), 'Should export getPartialTransactionsByUser function');
    assert(transactionServiceContent.includes('export async function countPartialTransactionsByUser'), 'Should export countPartialTransactionsByUser function');
    
    // Check for proper database integration
    assert(transactionServiceContent.includes('connectDB'), 'Should use database connection');
    assert(transactionServiceContent.includes('collection("transactions")'), 'Should access transactions collection');
    assert(transactionServiceContent.includes('collection("partialtransactions")'), 'Should access partialtransactions collection');
    
    // Check for proper query logic
    assert(transactionServiceContent.includes('$or'), 'Should use OR query for buyer/seller matching');
    assert(transactionServiceContent.includes('toLowerCase()'), 'Should normalize addresses');
    assert(transactionServiceContent.includes('sort({ timestamp: -1 })'), 'Should sort by timestamp descending');
    
    logTest('Transaction Service Layer Integration', true);
    return true;
  } catch (error) {
    console.error('Transaction Service Layer Integration test failed:', error.message);
    logTest('Transaction Service Layer Integration', false);
    return false;
  }
}

// Test: Frontend User Transactions Page Structure
async function testFrontendUserTransactionsPageStructure() {
  try {
    // Check if the user transactions page exists
    const userTransactionsPagePath = path.join(testDir, '../../frontend/src/routes/user-transactions/+page.svelte');
    assert(fs.existsSync(userTransactionsPagePath), 'User transactions page should exist');
    
    const userTransactionsPageContent = fs.readFileSync(userTransactionsPagePath, 'utf-8');
    
    // Check for required functionality
    assert(userTransactionsPageContent.includes('ethAddress'), 'Should have ETH address input');
    assert(userTransactionsPageContent.includes('isValidAddress'), 'Should have address validation');
    assert(userTransactionsPageContent.includes('searchTransactions'), 'Should have search functionality');
    assert(userTransactionsPageContent.includes('activeTab'), 'Should have tab management');
    
    // Check for API integration
    assert(userTransactionsPageContent.includes('apiFetch'), 'Should use API fetch');
    assert(userTransactionsPageContent.includes('/transactions/user/'), 'Should call user transactions API');
    assert(userTransactionsPageContent.includes('/transactions/user/') && userTransactionsPageContent.includes('/partial'), 'Should call partial transactions API');
    
    // Check for pagination
    assert(userTransactionsPageContent.includes('skip'), 'Should have pagination skip');
    assert(userTransactionsPageContent.includes('limit'), 'Should have pagination limit');
    assert(userTransactionsPageContent.includes('goToPage'), 'Should have pagination navigation');
    
    // Check for error handling
    assert(userTransactionsPageContent.includes('error'), 'Should have error state');
    assert(userTransactionsPageContent.includes('loading'), 'Should have loading state');
    
    logTest('Frontend User Transactions Page Structure', true);
    return true;
  } catch (error) {
    console.error('Frontend User Transactions Page Structure test failed:', error.message);
    logTest('Frontend User Transactions Page Structure', false);
    return false;
  }
}

// Test: Navigation Integration
async function testNavigationIntegration() {
  try {
    // Check if navigation includes the new links
    const navPath = path.join(testDir, '../../frontend/src/lib/Nav.svelte');
    assert(fs.existsSync(navPath), 'Navigation component should exist');
    
    const navContent = fs.readFileSync(navPath, 'utf-8');
    
    // Check for new navigation links
    assert(navContent.includes('href="/user-parts"'), 'Should have USER PARTS navigation link');
    assert(navContent.includes('href="/user-transactions"'), 'Should have USER TRANSACTIONS navigation link');
    assert(navContent.includes('USER PARTS'), 'Should have USER PARTS link text');
    assert(navContent.includes('USER TRANSACTIONS'), 'Should have USER TRANSACTIONS link text');
    
    logTest('Navigation Integration', true);
    return true;
  } catch (error) {
    console.error('Navigation Integration test failed:', error.message);
    logTest('Navigation Integration', false);
    return false;
  }
}

// Test: API Response Format Validation
async function testAPIResponseFormatValidation() {
  try {
    // Test API response format validation logic
    const validateMainTransactionResponse = (response) => {
      return response && 
             typeof response.total === 'number' &&
             Array.isArray(response.transactions) &&
             response.transactions.every(tx => 
               tx._id && 
               tx.buyer && 
               tx.seller && 
               tx.nftId && 
               typeof tx.quantity === 'number' &&
               tx.chainTx &&
               tx.currency &&
               tx.amount &&
               tx.timestamp
             );
    };
    
    const validatePartialTransactionResponse = (response) => {
      return response && 
             typeof response.total === 'number' &&
             Array.isArray(response.partialTransactions) &&
             response.partialTransactions.every(ptx => 
               ptx.part && 
               ptx.from && 
               ptx.to && 
               ptx.nftId && 
               ptx.chainTx &&
               ptx.currency &&
               ptx.amount &&
               ptx.timestamp
             );
    };
    
    // Test valid responses
    const validMainResponse = {
      total: 2,
      transactions: [
        { _id: '1', buyer: '0x123...', seller: '0x456...', nftId: 'nft1', quantity: 1, chainTx: '0x789...', currency: 'ETH', amount: '0.1', timestamp: new Date() },
        { _id: '2', buyer: '0x456...', seller: '0x123...', nftId: 'nft2', quantity: 2, chainTx: '0xabc...', currency: 'ETH', amount: '0.2', timestamp: new Date() }
      ]
    };
    
    const validPartialResponse = {
      total: 2,
      partialTransactions: [
        { part: 'part1', from: '0x123...', to: '0x456...', nftId: 'nft1', chainTx: '0x789...', currency: 'ETH', amount: '0.1', timestamp: new Date() },
        { part: 'part2', from: '0x456...', to: '0x123...', nftId: 'nft2', chainTx: '0xabc...', currency: 'ETH', amount: '0.2', timestamp: new Date() }
      ]
    };
    
    assert(validateMainTransactionResponse(validMainResponse), 'Should validate main transaction response format');
    assert(validatePartialTransactionResponse(validPartialResponse), 'Should validate partial transaction response format');
    
    // Test invalid responses
    const invalidMainResponse = { total: 2, transactions: [{ _id: '1' }] }; // Missing required fields
    const invalidPartialResponse = { total: 2, partialTransactions: [{ part: 'part1' }] }; // Missing required fields
    
    assert(!validateMainTransactionResponse(invalidMainResponse), 'Should reject invalid main transaction response');
    assert(!validatePartialTransactionResponse(invalidPartialResponse), 'Should reject invalid partial transaction response');
    
    logTest('API Response Format Validation', true);
    return true;
  } catch (error) {
    console.error('API Response Format Validation test failed:', error.message);
    logTest('API Response Format Validation', false);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 API Integration Tests - User Transactions');
  console.log('='.repeat(50));
  
  const tests = [
    testNewTransactionAPIEndpoints,
    testTransactionServiceLayerIntegration,
    testFrontendUserTransactionsPageStructure,
    testNavigationIntegration,
    testAPIResponseFormatValidation
  ];
  
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 API Integration Tests: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All API integration tests passed!');
    return true;
  } else {
    console.log('❌ Some API integration tests failed!');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests };
