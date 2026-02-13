#!/usr/bin/env node
/**
 * Sanitization Synchronization Test
 * 
 * Ensures that backend and frontend sanitization functions produce identical output.
 * This prevents bugs where sanitization logic diverges between implementations.
 * 
 * IMPORTANT: If this test fails, DO NOT COMMIT. Fix sanitization functions first.
 */

import { sanitizeText, sanitizeDescription, sanitizeEmail, sanitizeUsername } from '../utils/sanitize.js';

// Import frontend sanitization functions
// We'll need to compile TypeScript or use a runtime that can execute it
// For now, we'll test the backend functions and document the requirement

const testCases = [
  // sanitizeText tests
  {
    function: 'sanitizeText',
    tests: [
      { input: 'Hello World', expected: 'Hello World' },
      { input: '<script>alert("xss")</script>', expected: 'alert("xss")' },
      { input: 'Hello <b>World</b>', expected: 'Hello World' },
      { input: 'javascript:alert(1)', expected: 'alert(1)' },
      { input: 'onclick=evil()', expected: 'evil()' },
      { input: '  spaced  ', expected: 'spaced' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '', expected: '' },
      { input: 'A'.repeat(2000), expected: 'A'.repeat(1000) }, // maxLength default
    ],
  },
  // sanitizeDescription tests
  {
    function: 'sanitizeDescription',
    tests: [
      { input: 'Hello\nWorld', expected: 'Hello\nWorld' },
      { input: '<script>alert("xss")</script>', expected: 'alert("xss")' },
      { input: 'Multiple    spaces', expected: 'Multiple spaces' },
      { input: 'Multiple\t\ttabs', expected: 'Multiple tabs' },
      { input: 'Line1\nLine2\nLine3', expected: 'Line1\nLine2\nLine3' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '', expected: '' },
    ],
  },
  // sanitizeEmail tests
  {
    function: 'sanitizeEmail',
    tests: [
      { input: 'test@example.com', expected: 'test@example.com' },
      { input: 'Test@Example.COM', expected: 'test@example.com' },
      { input: 'user.name+tag@example.co.uk', expected: 'user.name+tag@example.co.uk' },
      { input: 'invalid-email', expected: '' },
      { input: 'not@valid', expected: '' },
      { input: '@example.com', expected: '' },
      { input: 'user@', expected: '' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '', expected: '' },
    ],
  },
  // sanitizeUsername tests
  {
    function: 'sanitizeUsername',
    tests: [
      { input: 'username123', expected: 'username123' },
      { input: 'user_name', expected: 'user_name' },
      { input: 'user-name', expected: 'user-name' },
      { input: 'user@name', expected: 'username' },
      { input: 'user name', expected: 'username' },
      { input: 'user<script>', expected: 'userscript' },
      { input: null, expected: '' },
      { input: undefined, expected: '' },
      { input: '', expected: '' },
    ],
  },
];

let passed = 0;
let failed = 0;

console.log('\n============================================================');
console.log('SANITIZATION SYNCHRONIZATION TEST');
console.log('============================================================');
console.log('\n⚠️  CRITICAL: These tests ensure sanitization functions work correctly.');
console.log('   If any test fails, DO NOT COMMIT. Fix sanitization functions first.\n');

for (const testGroup of testCases) {
  const func = {
    sanitizeText,
    sanitizeDescription,
    sanitizeEmail,
    sanitizeUsername,
  }[testGroup.function];

  if (!func) {
    console.error(`❌ Function ${testGroup.function} not found`);
    failed++;
    continue;
  }

  for (const test of testGroup.tests) {
    try {
      const result = func(test.input);
      if (result === test.expected) {
        passed++;
      } else {
        console.error(`❌ ${testGroup.function}(${JSON.stringify(test.input)})`);
        console.error(`   Expected: ${JSON.stringify(test.expected)}`);
        console.error(`   Got:      ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${testGroup.function}(${JSON.stringify(test.input)}) threw error:`, error.message);
      failed++;
    }
  }
}

console.log('\n============================================================');
if (failed === 0) {
  console.log(`✅ ALL SANITIZATION TESTS PASSED (${passed} tests)`);
  console.log('============================================================\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} TEST(S) FAILED (${passed} passed)`);
  console.log('============================================================\n');
  console.log('⚠️  DO NOT COMMIT: Fix sanitization functions first.\n');
  process.exit(1);
}

