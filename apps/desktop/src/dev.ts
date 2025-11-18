/**
 * F0 Desktop - Development Server
 * Starts Next.js and Electron concurrently
 */

import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

console.log('🚀 Starting F0 Desktop Development Environment');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const processes: ChildProcess[] = [];

// Start Next.js dev server
console.log('📦 Starting Next.js dev server...');
const nextProcess = spawn('pnpm', ['dev'], {
  cwd: resolve(process.cwd(), '../../'),
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: '3000'
  }
});

processes.push(nextProcess);

// Wait a bit for Next.js to start
console.log('⏳ Waiting for Next.js to be ready...');
setTimeout(() => {
  // Start Electron
  console.log('🖥️  Starting Electron...');
  process.env.F0_WEB_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'development';

  const electronProcess = spawn('electron', ['dist/main.cjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  processes.push(electronProcess);

  electronProcess.on('close', (code) => {
    console.log(`\n🛑 Electron exited with code ${code}`);
    cleanup();
  });
}, 5000); // 5 seconds delay

// Cleanup on exit
function cleanup() {
  console.log('\n🔧 Cleaning up processes...');
  processes.forEach((proc) => {
    try {
      proc.kill('SIGINT');
    } catch (error) {
      // Ignore errors
    }
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

console.log('');
console.log('✅ Development environment started!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


