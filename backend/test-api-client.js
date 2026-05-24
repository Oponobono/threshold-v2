#!/usr/bin/env node
/**
 * Debugging script to test API endpoint exactly as mobile client would
 * This simulates HTTP requests with proper headers and JWT token
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const secrets = require('./config/secrets');

// Generate a valid JWT token
const generateToken = () => {
  const userId = 1;
  const email = 'test@example.com';
  return jwt.sign({ id: userId, email }, secrets.JWT_SECRET, { expiresIn: '30d' });
};

// Make HTTP request to backend
const makeRequest = (method, path, token = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`\n[HTTP ${method}] http://localhost:3000/api${path}`);
    if (token) {
      console.log(`[Auth] Token: ${token.substring(0, 30)}...`);
    }

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        console.log(`[Response] Status: ${res.statusCode}`);
        console.log(`[Response] Headers:`, res.headers);
        try {
          const parsed = JSON.parse(body);
          console.log(`[Response] Body:`, JSON.stringify(parsed, null, 2));
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          console.log(`[Response] Body (raw):`, body);
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[Error] ${e.message}`);
      reject(e);
    });

    req.end();
  });
};

(async () => {
  try {
    console.log('=' .repeat(60));
    console.log('Testing /api/grading-systems endpoint');
    console.log('=' .repeat(60));

    const token = generateToken();
    console.log(`Generated token for user ID: 1`);
    console.log(`Token TTL: 30 days`);

    // Wait for server to be ready
    console.log(`\nWaiting for server to be ready...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Without token
    console.log(`\n` + '-'.repeat(60));
    console.log('Test 1: Request WITHOUT token');
    console.log('-'.repeat(60));
    try {
      await makeRequest('GET', '/grading-systems');
    } catch (e) {
      console.error(`Test 1 failed: ${e.message}`);
    }

    // Test 2: With token
    console.log(`\n` + '-'.repeat(60));
    console.log('Test 2: Request WITH valid token');
    console.log('-'.repeat(60));
    try {
      const result = await makeRequest('GET', '/grading-systems', token);
      if (result.status === 200 && result.data.systems) {
        console.log(`✓ Success! Got ${result.data.systems.length} grading systems`);
      } else {
        console.log(`✗ Failed! Status ${result.status}`);
      }
    } catch (e) {
      console.error(`Test 2 failed: ${e.message}`);
    }

    console.log(`\n` + '=' .repeat(60));
    console.log('Tests completed');
    console.log('=' .repeat(60));
  } catch (err) {
    console.error('Fatal error:', err);
  }
})();
