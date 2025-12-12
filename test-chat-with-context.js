/**
 * Test Script for Phase 84.7 - Chat with Workspace Context
 * Tests POST /api/ide/chat with workspaceContext parameter
 */

const fetch = require('node-fetch');

const chatRequest = {
  sessionId: 'test-session-847-123',
  projectId: 'test-project-847',
  message: 'What files are currently open in my workspace?',
  locale: 'en',
  workspaceContext: {
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
  }
};

async function testChatWithContext() {
  console.log('Testing POST /api/ide/chat with workspace context...\n');
  console.log('Request:', JSON.stringify(chatRequest, null, 2));

  try {
    const res = await fetch('http://localhost:3030/api/ide/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, add Authorization header with Firebase token
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(chatRequest)
    });

    console.log('\n--- Response ---');
    console.log('Status:', res.status, res.statusText);

    const data = await res.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (res.status === 200 && data.replyText) {
      console.log('\n✅ SUCCESS: Chat response received');
      console.log('\n--- AI Response ---');
      console.log(data.replyText);

      // Check if AI mentions workspace context
      const response = data.replyText.toLowerCase();
      const mentionsFiles = response.includes('index.ts') || response.includes('utils.ts');
      const mentionsDeps = response.includes('react') || response.includes('next');
      const mentionsChanges = response.includes('modified') || response.includes('added');

      console.log('\n--- Context Awareness Check ---');
      console.log('AI mentions files:', mentionsFiles ? '✅' : '❌');
      console.log('AI mentions dependencies:', mentionsDeps ? '✅' : '❌');
      console.log('AI mentions changes:', mentionsChanges ? '✅' : '❌');

      if (mentionsFiles || mentionsDeps || mentionsChanges) {
        console.log('\n✅ AI is workspace-aware!');
      } else {
        console.log('\n⚠️  AI may not be using workspace context');
      }
    } else {
      console.log('\n❌ FAILED: Unexpected response');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testChatWithContext();
