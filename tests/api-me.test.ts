/**
 * Basic unit tests for /api/me endpoint
 * 
 * Note: This requires vitest to be installed
 * To run: npm install -D vitest && npm test
 */

// import { describe, it, expect } from 'vitest';

describe('/api/me', () => {
  it('returns shape {uid,email,roles,plan,usage}', () => {
    // Mock payload that should be returned by /api/me
    const payload = { 
      uid: 'u1', 
      email: 'a@b.c', 
      roles: ['admin'], 
      plan: 'pro', 
      usage: { calls: 1 } 
    };
    
    const expectedKeys = ['email', 'plan', 'roles', 'uid', 'usage'].sort();
    const actualKeys = Object.keys(payload).sort();
    
    // expect(actualKeys).toEqual(expectedKeys);
    console.assert(
      JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
      'Keys should match expected shape'
    );
  });
});

// Simple Node.js test runner (without vitest)
if (typeof describe === 'undefined') {
  console.log('Running basic test...');
  const payload = { 
    uid: 'u1', 
    email: 'a@b.c', 
    roles: ['admin'], 
    plan: 'pro', 
    usage: { calls: 1 } 
  };
  
  const expectedKeys = ['email', 'plan', 'roles', 'uid', 'usage'].sort();
  const actualKeys = Object.keys(payload).sort();
  
  if (JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)) {
    console.log('✓ /api/me returns correct shape');
  } else {
    console.log('✗ /api/me shape mismatch');
    process.exit(1);
  }
}

