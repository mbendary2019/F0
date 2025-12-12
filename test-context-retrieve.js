/**
 * Test Script for Phase 84.7 - Context Retrieval
 * Tests GET /api/ide/context endpoint
 */

const fetch = require('node-fetch');

async function testRetrieve() {
  const projectId = 'test-project-847';
  const sessionId = 'test-session-847-123';

  console.log('Testing GET /api/ide/context...\n');
  console.log('Query Parameters:');
  console.log('  projectId:', projectId);
  console.log('  sessionId:', sessionId);

  try {
    const url = `http://localhost:3030/api/ide/context?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // Note: In production, add Authorization header with Firebase token
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      }
    });

    console.log('\n--- Response ---');
    console.log('Status:', res.status, res.statusText);

    const data = await res.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.status === 200 && data) {
      console.log('\n✅ SUCCESS: Context retrieved successfully');

      // Verify data structure
      console.log('\n--- Data Verification ---');
      console.log('Has projectId:', !!data.projectId);
      console.log('Has sessionId:', !!data.sessionId);
      console.log('Has openedFiles:', Array.isArray(data.openedFiles));
      console.log('Has changedFiles:', Array.isArray(data.changedFiles));
      console.log('Has packageJson:', !!data.packageJson);
      console.log('Has timestamp:', !!data.timestamp);
    } else if (res.status === 404) {
      console.log('\n⚠️  EXPECTED: Context not found (run upload test first)');
    } else {
      console.log('\n❌ FAILED: Unexpected response');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testRetrieve();
