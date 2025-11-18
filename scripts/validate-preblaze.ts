#!/usr/bin/env ts-node
/**
 * Pre-Blaze Readiness Validation Script
 *
 * Validates environment configuration before Blaze Plan upgrade
 * Run: npx ts-node scripts/validate-preblaze.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const { green, red, yellow, blue, cyan, reset } = colors;

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function pass(name: string, message: string, critical = false) {
  results.push({ name, passed: true, message, critical });
  console.log(`${green}✓${reset} ${name}: ${message}`);
}

function fail(name: string, message: string, critical = false) {
  results.push({ name, passed: false, message, critical });
  console.log(`${red}✗${reset} ${name}: ${message}`);
}

function warn(name: string, message: string) {
  console.log(`${yellow}⚠${reset} ${name}: ${message}`);
}

function info(message: string) {
  console.log(`${cyan}ℹ${reset} ${message}`);
}

function section(title: string) {
  console.log(`\n${blue}${'='.repeat(60)}${reset}`);
  console.log(`${blue}${title}${reset}`);
  console.log(`${blue}${'='.repeat(60)}${reset}\n`);
}

// Helper: Read .env file
function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return env;
}

// Helper: Check if file exists
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Helper: Check directory exists
function dirExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

// Check 1: Functions Environment Variables
function checkFunctionsEnv() {
  section('1. Functions Environment Variables');

  const envPath = path.join(process.cwd(), 'functions', '.env');

  if (!fileExists(envPath)) {
    fail('Functions .env', 'File not found at functions/.env', true);
    return;
  }

  const env = readEnvFile(envPath);
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PORTAL_RETURN_URL',
    'API_KEY_HASH_SECRET',
    'ADMIN_DASH_TOKEN'
  ];

  let allPresent = true;
  required.forEach(key => {
    if (env[key]) {
      if (key === 'API_KEY_HASH_SECRET' && env[key].length < 32) {
        warn(key, `Only ${env[key].length} chars (recommend 32+)`);
      } else if (key === 'ADMIN_DASH_TOKEN' && env[key].length < 32) {
        warn(key, `Only ${env[key].length} chars (recommend 32+)`);
      } else {
        pass(key, 'Present');
      }
    } else {
      fail(key, 'Missing', true);
      allPresent = false;
    }
  });

  if (allPresent) {
    pass('Functions .env', 'All required variables present');
  }
}

// Check 2: Next.js Environment Variables
function checkNextEnv() {
  section('2. Next.js Environment Variables');

  const envPath = path.join(process.cwd(), '.env.local');

  if (!fileExists(envPath)) {
    fail('Next.js .env.local', 'File not found', true);
    return;
  }

  const env = readEnvFile(envPath);
  const required = [
    'FIREBASE_PROJECT_ID',
    'FUNCTIONS_REGION',
    'ADMIN_DASH_TOKEN'
  ];

  let allPresent = true;
  required.forEach(key => {
    if (env[key]) {
      pass(key, `Set to: ${env[key]}`);
    } else {
      fail(key, 'Missing', key === 'FIREBASE_PROJECT_ID');
      allPresent = false;
    }
  });

  // Check token match
  const functionsEnv = readEnvFile(path.join(process.cwd(), 'functions', '.env'));
  if (env.ADMIN_DASH_TOKEN && functionsEnv.ADMIN_DASH_TOKEN) {
    if (env.ADMIN_DASH_TOKEN === functionsEnv.ADMIN_DASH_TOKEN) {
      pass('Token Match', 'ADMIN_DASH_TOKEN matches between Next.js and Functions');
    } else {
      fail('Token Match', 'ADMIN_DASH_TOKEN mismatch!', true);
    }
  }

  if (allPresent) {
    pass('Next.js .env.local', 'All required variables present');
  }
}

// Check 3: Functions Build
function checkFunctionsBuild() {
  section('3. Functions Build Status');

  const libPath = path.join(process.cwd(), 'functions', 'lib');

  if (!dirExists(libPath)) {
    fail('Functions Build', 'lib/ directory not found. Run: cd functions && npm run build', true);
    return;
  }

  const requiredFiles = [
    'index-new.js',
    'debugSchedulers.js',
    'limits.js',
    'overage.js',
    'aggregateMonthly.js',
    'periodClose.js',
    'quotaWarn.js',
    'gateCheck.js',
    'subscriptionRead.js',
    'usageMonthRead.js'
  ];

  let allPresent = true;
  requiredFiles.forEach(file => {
    const filePath = path.join(libPath, file);
    if (fileExists(filePath)) {
      pass(file, 'Compiled');
    } else {
      fail(file, 'Missing compiled file', true);
      allPresent = false;
    }
  });

  if (allPresent) {
    pass('Functions Build', `All ${requiredFiles.length} critical files compiled`);
  }
}

// Check 4: Firebase Configuration
function checkFirebaseConfig() {
  section('4. Firebase Configuration');

  const firebaseJsonPath = path.join(process.cwd(), 'firebase.json');
  const firebasercPath = path.join(process.cwd(), '.firebaserc');

  if (fileExists(firebaseJsonPath)) {
    pass('firebase.json', 'Present');

    try {
      const config = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));
      if (config.functions) {
        pass('Functions Config', 'Configured in firebase.json');
      } else {
        warn('Functions Config', 'Not found in firebase.json');
      }
    } catch (e) {
      fail('firebase.json', 'Invalid JSON', false);
    }
  } else {
    fail('firebase.json', 'Not found', true);
  }

  if (fileExists(firebasercPath)) {
    pass('.firebaserc', 'Present');

    try {
      const config = JSON.parse(fs.readFileSync(firebasercPath, 'utf-8'));
      if (config.projects?.default) {
        pass('Firebase Project', `Set to: ${config.projects.default}`);
      }
    } catch (e) {
      fail('.firebaserc', 'Invalid JSON', false);
    }
  } else {
    fail('.firebaserc', 'Not found', true);
  }
}

// Check 5: Firestore Indexes
function checkFirestoreIndexes() {
  section('5. Firestore Indexes');

  const indexesPath = path.join(process.cwd(), 'firestore.indexes.json');

  if (!fileExists(indexesPath)) {
    fail('Firestore Indexes', 'firestore.indexes.json not found', false);
    return;
  }

  try {
    const indexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));
    const collections = ['api_keys', 'monthly', 'daily', 'webhook_queue', 'billing_events'];

    if (indexes.indexes && Array.isArray(indexes.indexes)) {
      const indexedCollections = new Set(
        indexes.indexes.map((idx: any) => idx.collectionGroup)
      );

      collections.forEach(col => {
        if (indexedCollections.has(col)) {
          pass(col, 'Index configured');
        } else {
          warn(col, 'No index found (may be needed)');
        }
      });

      pass('Firestore Indexes', `${indexes.indexes.length} total indexes configured`);
    } else {
      fail('Firestore Indexes', 'Invalid structure', false);
    }
  } catch (e) {
    fail('Firestore Indexes', 'Invalid JSON', false);
  }
}

// Check 6: Project Structure
function checkProjectStructure() {
  section('6. Project Structure');

  const criticalPaths = [
    'functions/src/index-new.ts',
    'functions/src/debugSchedulers.ts',
    'functions/src/limits.ts',
    'src/app/developers/billing/page.tsx',
    'src/app/admin/ops/page.tsx',
    'src/lib/functionsClient.ts'
  ];

  let allPresent = true;
  criticalPaths.forEach(p => {
    const fullPath = path.join(process.cwd(), p);
    if (fileExists(fullPath)) {
      pass(p, 'Present');
    } else {
      fail(p, 'Missing critical file', true);
      allPresent = false;
    }
  });

  if (allPresent) {
    pass('Project Structure', 'All critical files present');
  }
}

// Check 7: Dependencies
function checkDependencies() {
  section('7. Dependencies');

  // Check functions package.json
  const funcPkgPath = path.join(process.cwd(), 'functions', 'package.json');
  if (fileExists(funcPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(funcPkgPath, 'utf-8'));

    if (pkg.main === 'lib/index-new.js') {
      pass('Functions Entry', 'Points to index-new.js');
    } else {
      warn('Functions Entry', `Main is ${pkg.main}, expected lib/index-new.js`);
    }

    const requiredDeps = ['stripe', 'firebase-admin', 'firebase-functions', 'dotenv'];
    requiredDeps.forEach(dep => {
      if (pkg.dependencies?.[dep]) {
        pass(dep, `v${pkg.dependencies[dep]}`);
      } else {
        fail(dep, 'Missing dependency', true);
      }
    });
  } else {
    fail('Functions package.json', 'Not found', true);
  }

  // Check Next.js node_modules
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (dirExists(nodeModulesPath)) {
    pass('Next.js Dependencies', 'node_modules/ exists');
  } else {
    fail('Next.js Dependencies', 'Run: npm install', true);
  }
}

// Check 8: Documentation
function checkDocumentation() {
  section('8. Documentation');

  const docs = [
    'QUICK_START.md',
    'DEPLOYMENT_GUIDE.md',
    'ROLLBACK_PLAN.md',
    'MONITORING_SETUP.md',
    'ADMIN_DASHBOARD_GUIDE.md',
    'PRE_BLAZE_READINESS_CHECKLIST.md'
  ];

  let allPresent = true;
  docs.forEach(doc => {
    const docPath = path.join(process.cwd(), doc);
    if (fileExists(docPath)) {
      pass(doc, 'Present');
    } else {
      warn(doc, 'Documentation missing (optional)');
      allPresent = false;
    }
  });

  if (allPresent) {
    pass('Documentation', 'All guides present');
  }
}

// Check 9: Scripts
function checkScripts() {
  section('9. Scripts');

  const scriptsDir = path.join(process.cwd(), 'scripts');

  if (!dirExists(scriptsDir)) {
    warn('Scripts Directory', 'scripts/ not found');
    return;
  }

  const smokeProdPath = path.join(scriptsDir, 'smoke-prod.sh');
  if (fileExists(smokeProdPath)) {
    pass('smoke-prod.sh', 'Present');

    // Check if executable
    try {
      const stats = fs.statSync(smokeProdPath);
      if (stats.mode & 0o111) {
        pass('Script Permissions', 'smoke-prod.sh is executable');
      } else {
        warn('Script Permissions', 'Run: chmod +x scripts/smoke-prod.sh');
      }
    } catch (e) {
      warn('Script Permissions', 'Could not check permissions');
    }
  } else {
    warn('smoke-prod.sh', 'Not found (optional)');
  }
}

// Check 10: Git Safety
function checkGitSafety() {
  section('10. Git Safety');

  const gitignorePath = path.join(process.cwd(), '.gitignore');

  if (fileExists(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

    const criticalPatterns = ['.env', '.env.local', 'functions/.env'];
    criticalPatterns.forEach(pattern => {
      if (gitignore.includes(pattern)) {
        pass(pattern, 'In .gitignore');
      } else {
        fail(pattern, 'NOT in .gitignore - SECURITY RISK!', true);
      }
    });

    pass('.gitignore', 'File present');
  } else {
    fail('.gitignore', 'Not found - create to avoid committing secrets!', true);
  }
}

// Main execution
async function main() {
  console.log(`\n${cyan}╔${'═'.repeat(58)}╗${reset}`);
  console.log(`${cyan}║${reset}  ${blue}Pre-Blaze Readiness Validation${reset}                       ${cyan}║${reset}`);
  console.log(`${cyan}╚${'═'.repeat(58)}╝${reset}\n`);

  info('Validating Sprint 26 & 27 deployment readiness...\n');

  // Run all checks
  checkFunctionsEnv();
  checkNextEnv();
  checkFunctionsBuild();
  checkFirebaseConfig();
  checkFirestoreIndexes();
  checkProjectStructure();
  checkDependencies();
  checkDocumentation();
  checkScripts();
  checkGitSafety();

  // Summary
  section('Summary');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const critical = results.filter(r => !r.passed && r.critical).length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`${green}Passed: ${passed}${reset}`);
  console.log(`${red}Failed: ${failed}${reset}`);
  if (critical > 0) {
    console.log(`${red}Critical Failures: ${critical}${reset}`);
  }

  const score = Math.round((passed / results.length) * 10);
  console.log(`\nScore: ${score}/10`);

  if (critical > 0) {
    console.log(`\n${red}❌ NOT READY FOR DEPLOYMENT${reset}`);
    console.log(`${red}Fix ${critical} critical issue(s) before proceeding.${reset}\n`);
    process.exit(1);
  } else if (score >= 8) {
    console.log(`\n${green}✅ READY FOR BLAZE PLAN UPGRADE!${reset}`);
    console.log(`${green}All critical checks passed.${reset}\n`);

    console.log(`${cyan}Next steps:${reset}`);
    console.log(`1. Upgrade to Blaze Plan: https://console.firebase.google.com/project/cashout-swap/usage/details`);
    console.log(`2. Deploy functions: firebase deploy --only functions`);
    console.log(`3. Run smoke tests: ./scripts/smoke-prod.sh\n`);

    process.exit(0);
  } else {
    console.log(`\n${yellow}⚠ DEPLOYMENT NOT RECOMMENDED${reset}`);
    console.log(`${yellow}Score too low. Fix issues before proceeding.${reset}\n`);
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error(`\n${red}Validation script error:${reset}`, error);
  process.exit(1);
});
