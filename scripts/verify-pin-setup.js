#!/usr/bin/env node
/**
 * PIN Setup Verification Script
 * Usage: node scripts/verify-pin-setup.js <pin> <expected-pinKey>
 * 
 * This script helps diagnose PIN login issues by:
 * 1. Computing pinKey from PIN with current PIN_PEPPER
 * 2. Comparing with expected pinKey from database
 * 3. Checking if PIN_PEPPER is correctly configured
 */

const crypto = require('crypto');

const pin = process.argv[2];
const expectedPinKey = process.argv[3];

if (!pin) {
  console.error('Usage: node scripts/verify-pin-setup.js <pin> [expected-pinKey]');
  console.error('Example: node scripts/verify-pin-setup.js 123456 6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd');
  process.exit(1);
}

const PIN_PEPPER = process.env.PIN_PEPPER || process.env.JWT_SECRET_KEY || 'pin-pepper';

console.log('=== PIN Setup Verification ===\n');
console.log('Input PIN:', pin);
console.log('PIN_PEPPER:', PIN_PEPPER);
console.log('PIN_PEPPER source:', process.env.PIN_PEPPER ? 'PIN_PEPPER env var' : 
                                   process.env.JWT_SECRET_KEY ? 'JWT_SECRET_KEY env var' : 
                                   'default fallback');

const computedPinKey = crypto.createHmac('sha256', PIN_PEPPER).update(String(pin)).digest('hex');
console.log('\nComputed pinKey:', computedPinKey);

if (expectedPinKey) {
  console.log('Expected pinKey:', expectedPinKey);
  console.log('\n✅ Match:', computedPinKey === expectedPinKey ? 'YES - PIN will work!' : '❌ NO - PIN will fail!');
  
  if (computedPinKey !== expectedPinKey) {
    console.log('\n🔴 MISMATCH DETECTED!');
    console.log('Possible causes:');
    console.log('1. PIN_PEPPER environment variable changed since PIN was set');
    console.log('2. JWT_SECRET_KEY changed (if PIN_PEPPER not explicitly set)');
    console.log('3. PIN was set in different environment with different secrets');
    console.log('\nSolution: Re-set the PIN via API: POST /t/staff/{id}/set-pin');
  }
} else {
  console.log('\nTo verify against database:');
  console.log('1. Query main DB: db.tenantpindirectories.findOne({ pinKey: "' + computedPinKey + '" })');
  console.log('2. If not found, the PIN needs to be re-set with current environment variables');
}

console.log('\n=== Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('JWT_SECRET_KEY:', process.env.JWT_SECRET_KEY ? '✅ set (length: ' + process.env.JWT_SECRET_KEY.length + ')' : '❌ not set');
console.log('PIN_PEPPER:', process.env.PIN_PEPPER ? '✅ set (length: ' + process.env.PIN_PEPPER.length + ')' : '⚠️  not set (using fallback)');
console.log('PIN_BCRYPT_ROUNDS:', process.env.PIN_BCRYPT_ROUNDS || '12 (default)');

console.log('\n=== Recommendations ===');
if (!process.env.PIN_PEPPER) {
  console.log('⚠️  Set PIN_PEPPER explicitly in .env for production');
  console.log('   Example: PIN_PEPPER=' + crypto.randomBytes(32).toString('hex'));
}
if (!process.env.JWT_SECRET_KEY) {
  console.log('⚠️  Set JWT_SECRET_KEY in .env for production');
  console.log('   Example: JWT_SECRET_KEY=' + crypto.randomBytes(32).toString('hex'));
}

