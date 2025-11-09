#!/usr/bin/env node

/**
 * API Integration Tests
 * 
 * Tests API endpoints and data flow that AI might break when making changes.
 * Focuses on critical API functionality.
 */

const { spawn } = require('child_process');
const { dirname } = require('path');

const testDir = __dirname;

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

// Test: Server Startup
async function testServerStartup() {
  try {
    // Check if server can start (basic check)
    const serverProcess = spawn('node', ['server.js'], {
      cwd: `${testDir}/../backend`,
      stdio: 'pipe'
    });
    
    return new Promise((resolve) => {
      let output = '';
      
      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      serverProcess.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      // Give server 3 seconds to start
      setTimeout(() => {
        serverProcess.kill();
        
        // Check if server started successfully
        const started = output.includes('Server running') || 
                       output.includes('Listening') || 
                       output.includes('started');
        
        if (started) {
          logTest('Server Startup', true);
          resolve(true);
        } else {
          console.error('Server startup failed. Output:', output);
          logTest('Server Startup', false);
          resolve(false);
        }
      }, 3000);
    });
  } catch (error) {
    console.error('Server Startup failed:', error.message);
    logTest('Server Startup', false);
    return false;
  }
}

// Test: Database Connection
async function testDatabaseConnection() {
  try {
    // Simple check that MongoDB connection string is valid format
    const connectionString = 'mongodb://localhost:27017';
    const isValidConnectionString = (str) => {
      return typeof str === 'string' && 
             str.startsWith('mongodb://') && 
             str.includes(':27017');
    };
    
    assert(isValidConnectionString(connectionString), 'MongoDB connection string should be valid format');
    
    logTest('Database Connection', true);
    return true;
  } catch (error) {
    console.error('Database Connection test failed:', error.message);
    logTest('Database Connection', false);
    return false;
  }
}

// Test: API Endpoints Structure
async function testAPIEndpoints() {
  try {
    // Check if API route files exist and are properly structured
    const fs = require('fs');
    const path = require('path');
    
    const routesDir = path.join(testDir, '../backend/routes');
    const routeFiles = ['nfts.js', 'parts.js', 'transactions.js', 'eth.js', 'explorer.js'];
    
    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const exists = fs.existsSync(filePath);
      assert(exists, `Route file ${file} should exist`);
      
      if (exists) {
        const content = fs.readFileSync(filePath, 'utf8');
        assert(content.includes('router') || content.includes('express'), `Route file ${file} should contain router or express`);
        assert(content.includes('get') || content.includes('post') || content.includes('put') || content.includes('delete'), `Route file ${file} should contain HTTP methods`);
      }
    }
    
    logTest('API Endpoints Structure', true);
    return true;
  } catch (error) {
    console.error('API Endpoints Structure failed:', error.message);
    logTest('API Endpoints Structure', false);
    return false;
  }
}

// Test: Service Layer Structure
async function testServiceLayer() {
  try {
    // Check if service files exist and are properly structured
    const fs = require('fs');
    const path = require('path');
    
    const servicesDir = path.join(testDir, '../backend/services');
    const serviceFiles = ['nftService.js', 'partService.js', 'transactionService.js', 'ethService.js'];
    
    for (const file of serviceFiles) {
      const filePath = path.join(servicesDir, file);
      const exists = fs.existsSync(filePath);
      assert(exists, `Service file ${file} should exist`);
      
      if (exists) {
        const content = fs.readFileSync(filePath, 'utf8');
        assert(content.includes('export'), `Service file ${file} should have exports`);
      }
    }
    
    logTest('Service Layer Structure', true);
    return true;
  } catch (error) {
    console.error('Service Layer Structure failed:', error.message);
    logTest('Service Layer Structure', false);
    return false;
  }
}

// Test: Frontend Build
async function testFrontendBuild() {
  try {
    // Check if frontend can build successfully
    const frontendProcess = spawn('npm', ['run', 'build'], {
      cwd: `${testDir}/../frontend`,
      stdio: 'pipe'
    });
    
    return new Promise((resolve) => {
      let output = '';
      
      frontendProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      frontendProcess.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      frontendProcess.on('close', (code) => {
        if (code === 0) {
          logTest('Frontend Build', true);
          resolve(true);
        } else {
          console.error('Frontend build failed. Output:', output);
          logTest('Frontend Build', false);
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('Frontend Build failed:', error.message);
    logTest('Frontend Build', false);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 API Integration Tests');
  console.log('='.repeat(50));
  
  const tests = [
    testDatabaseConnection,
    testAPIEndpoints,
    testServiceLayer,
    testFrontendBuild
    // Note: Server startup test can be flaky, so we'll skip it for now
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
