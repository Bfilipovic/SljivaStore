#!/usr/bin/env node

/**
 * AI-Focused Regression Test Runner
 * 
 * This script runs essential tests to catch regressions when AI makes code changes.
 * Focuses on business logic, not UI components.
 */

const { spawn } = require('child_process');
const { dirname, join } = require('path');

const PROJECT_ROOT = __dirname;

// Test categories that matter for AI development
const TEST_CATEGORIES = {
  'backend-logic': {
    description: 'Backend business logic (NFT, wallet, transaction operations)',
    command: 'node tests/backend-logic.test.js',
    critical: true
  },
  'frontend-logic': {
    description: 'Frontend utilities and data handling',
    command: 'node tests/frontend-logic.test.js', 
    critical: true
  },
  'api-integration': {
    description: 'API endpoints and data flow',
    command: 'node tests/api-integration.test.js',
    critical: false
  }
};

async function runTest(category, config) {
  console.log(`\n🧪 Running ${category}: ${config.description}`);
  console.log('─'.repeat(60));
  
  return new Promise((resolve) => {
    const [command, ...args] = config.command.split(' ');
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${category} passed`);
        resolve(true);
      } else {
        console.log(`❌ ${category} failed`);
        resolve(false);
      }
    });
  });
}

async function main() {
  console.log('🤖 AI Regression Test Runner');
  console.log('='.repeat(60));
  console.log('Running tests to catch regressions after code changes...\n');
  
  const results = {};
  
  // Run critical tests first
  for (const [category, config] of Object.entries(TEST_CATEGORIES)) {
    if (config.critical) {
      results[category] = await runTest(category, config);
    }
  }
  
  // Run non-critical tests if critical ones pass
  const criticalPassed = Object.values(results).every(Boolean);
  
  if (criticalPassed) {
    console.log('\n🎉 Critical tests passed! Running additional tests...');
    
    for (const [category, config] of Object.entries(TEST_CATEGORIES)) {
      if (!config.critical) {
        results[category] = await runTest(category, config);
      }
    }
  } else {
    console.log('\n💥 Critical tests failed! Skipping additional tests.');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  for (const [category, passed] of Object.entries(results)) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const critical = TEST_CATEGORIES[category].critical ? ' (CRITICAL)' : '';
    console.log(`${status} ${category}${critical}`);
  }
  
  console.log(`\nResult: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Safe to proceed.');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed! Review changes before proceeding.');
    process.exit(1);
  }
}

main().catch(console.error);
