// F0 Extensions - Doctor (System Health Check)

import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix?: string;
}

const checks: CheckResult[] = [];

function addCheck(result: CheckResult) {
  checks.push(result);
  const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.fix) {
    console.log(`   💡 Fix: ${result.fix}`);
  }
}

async function checkExtensionsDirectory() {
  const extDir = join(process.cwd(), '.f0', 'extensions');

  if (!existsSync(extDir)) {
    addCheck({
      name: 'Extensions Directory',
      status: 'warning',
      message: 'Directory does not exist',
      fix: 'Will be created automatically on first extension install',
    });
    return;
  }

  try {
    const files = await readdir(extDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    addCheck({
      name: 'Extensions Directory',
      status: 'ok',
      message: `Found ${jsonFiles.length} installed extension(s)`,
    });

    // Validate each manifest
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(extDir, file), 'utf-8');
        JSON.parse(content);
      } catch {
        addCheck({
          name: `Extension: ${file}`,
          status: 'error',
          message: 'Invalid JSON',
          fix: `Delete or fix ${file}`,
        });
      }
    }
  } catch (error: any) {
    addCheck({
      name: 'Extensions Directory',
      status: 'error',
      message: error.message,
    });
  }
}

async function checkNodeVersion() {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major >= 18) {
      addCheck({
        name: 'Node.js Version',
        status: 'ok',
        message: version,
      });
    } else {
      addCheck({
        name: 'Node.js Version',
        status: 'warning',
        message: `${version} (recommend >= 18)`,
        fix: 'Upgrade Node.js to v18 or higher',
      });
    }
  } catch (error: any) {
    addCheck({
      name: 'Node.js Version',
      status: 'error',
      message: 'Could not detect',
    });
  }
}

async function checkCLITools() {
  const tools = ['firebase', 'vercel', 'stripe'];

  for (const tool of tools) {
    try {
      await execAsync(`which ${tool}`);
      addCheck({
        name: `CLI Tool: ${tool}`,
        status: 'ok',
        message: 'Installed',
      });
    } catch {
      addCheck({
        name: `CLI Tool: ${tool}`,
        status: 'warning',
        message: 'Not installed',
        fix: `Install with: npm install -g ${tool}`,
      });
    }
  }
}

async function checkNetworkConnectivity() {
  try {
    const { stdout } = await execAsync('curl -s -o /dev/null -w "%{http_code}" https://httpbin.org/get', {
      timeout: 5000,
    });

    if (stdout.trim() === '200') {
      addCheck({
        name: 'Network Connectivity',
        status: 'ok',
        message: 'Internet connection is working',
      });
    } else {
      addCheck({
        name: 'Network Connectivity',
        status: 'warning',
        message: `HTTP ${stdout.trim()}`,
      });
    }
  } catch {
    addCheck({
      name: 'Network Connectivity',
      status: 'warning',
      message: 'Could not connect to internet',
      fix: 'Check your network connection',
    });
  }
}

async function checkOrchestratorHealth() {
  try {
    const { stdout } = await execAsync('curl -s http://localhost:8080/readyz', {
      timeout: 3000,
    });

    const data = JSON.parse(stdout);
    if (data.ok) {
      addCheck({
        name: 'Orchestrator Health',
        status: 'ok',
        message: 'Running on :8080',
      });
    } else {
      addCheck({
        name: 'Orchestrator Health',
        status: 'warning',
        message: 'Not healthy',
      });
    }
  } catch {
    addCheck({
      name: 'Orchestrator Health',
      status: 'warning',
      message: 'Not running',
      fix: 'Start with: cd orchestrator && pnpm dev',
    });
  }
}

async function checkEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_APPCHECK_SITE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length === 0) {
    addCheck({
      name: 'Environment Variables',
      status: 'ok',
      message: 'All required variables set',
    });
  } else {
    addCheck({
      name: 'Environment Variables',
      status: 'warning',
      message: `Missing: ${missing.join(', ')}`,
      fix: 'Check .env.local file',
    });
  }
}

async function runDoctor() {
  console.log('🏥 F0 Extensions Doctor');
  console.log('======================\n');

  await checkNodeVersion();
  await checkExtensionsDirectory();
  await checkCLITools();
  await checkNetworkConnectivity();
  await checkOrchestratorHealth();
  await checkEnvironmentVariables();

  console.log('\n======================');

  const errors = checks.filter((c) => c.status === 'error').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  const ok = checks.filter((c) => c.status === 'ok').length;

  console.log(`✅ OK: ${ok}`);
  if (warnings > 0) console.log(`⚠️  Warnings: ${warnings}`);
  if (errors > 0) console.log(`❌ Errors: ${errors}`);

  if (errors === 0 && warnings === 0) {
    console.log('\n🎉 Everything looks good!');
  } else {
    console.log('\n💡 Some issues detected. Review the fixes above.');
  }

  process.exit(errors > 0 ? 1 : 0);
}

runDoctor();
