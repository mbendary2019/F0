/**
 * Test Script for Phase 84.7 - Context Upload
 * Tests POST /api/ide/context endpoint
 */

const fetch = require('node-fetch');

const testContext = {
  projectId: 'test-project-847',
  sessionId: 'test-session-847-123',
  openedFiles: [
    { path: 'src/index.ts', languageId: 'typescript' },
    { path: 'src/utils.ts', languageId: 'typescript' },
    { path: 'package.json', languageId: 'json' }
  ],
  currentFile: { path: 'src/index.ts', languageId: 'typescript' },
  changedFiles: [
    { path: 'src/index.ts', status: 'modified' },
    { path: 'src/new-feature.ts', status: 'added' }
  ],
  packageJson: {
    path: 'package.json',
    dependencies: {
      'react': '^18.0.0',
      'next': '^14.0.0'
    },
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/node': '^20.0.0'
    }
  },
  timestamp: Date.now()
};

async function testUpload() {
  console.log('Testing POST /api/ide/context...\n');
  console.log('Test Context:', JSON.stringify(testContext, null, 2));

  try {
    const res = await fetch('http://localhost:3030/api/ide/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, add Authorization header with Firebase token
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(testContext)
    });

    console.log('\n--- Response ---');
    console.log('Status:', res.status, res.statusText);

    const data = await res.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.status === 200) {
      console.log('\n✅ SUCCESS: Context uploaded successfully');
    } else {
      console.log('\n❌ FAILED: Unexpected status code');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testUpload();
