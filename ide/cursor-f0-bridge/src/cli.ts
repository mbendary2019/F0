#!/usr/bin/env node
/**
 * F0 CLI for Cursor Bridge
 * Phase 84.8: Main CLI entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { AuthManager } from './auth/authManager';
import { F0Client } from './api/f0Client';
import { getProjectBinding, saveProjectBinding, updateSessionId } from './config/projectBinding';
import { collectWorkspaceContext } from './context/contextCollector';

const program = new Command();

program
  .name('f0')
  .description('F0 CLI Bridge for Cursor IDE')
  .version('0.0.1');

/**
 * f0 login
 * Authenticate with F0
 */
program
  .command('login')
  .description('Authenticate with F0')
  .option('--api-base <url>', 'API base URL', 'http://localhost:3030')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Starting F0 authentication...'));
      const authManager = new AuthManager(options.apiBase);
      await authManager.login();
      console.log(chalk.green('✓ Successfully authenticated with F0!'));
    } catch (err: any) {
      console.error(chalk.red('✗ Authentication failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 logout
 * Clear authentication
 */
program
  .command('logout')
  .description('Clear authentication')
  .action(async () => {
    try {
      const authManager = new AuthManager();
      authManager.logout();
      console.log(chalk.green('✓ Successfully logged out'));
    } catch (err: any) {
      console.error(chalk.red('✗ Logout failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 init <projectId>
 * Link current directory to F0 project
 */
program
  .command('init <projectId>')
  .description('Link current directory to F0 project')
  .option('--api-base <url>', 'API base URL', 'http://localhost:3030')
  .action(async (projectId: string, options) => {
    try {
      console.log(chalk.blue(`Linking current directory to project: ${projectId}`));

      saveProjectBinding({
        projectId,
        apiBase: options.apiBase,
      });

      console.log(chalk.green('✓ Project linked successfully!'));
      console.log(chalk.gray(`Configuration saved to .f0/config.json`));
    } catch (err: any) {
      console.error(chalk.red('✗ Init failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 session
 * Create or show current session
 */
program
  .command('session')
  .description('Create or show current IDE session')
  .option('--new', 'Force create new session')
  .action(async (options) => {
    try {
      const binding = getProjectBinding();
      if (!binding) {
        console.error(chalk.red('✗ No project linked. Run "f0 init <projectId>" first.'));
        process.exit(1);
      }

      const authManager = new AuthManager(binding.apiBase);
      const client = new F0Client(authManager);

      if (options.new || !binding.sessionId) {
        console.log(chalk.blue('Creating new IDE session...'));
        const session = await client.createSession(binding.projectId);
        updateSessionId(session.id);
        console.log(chalk.green('✓ Session created:'), session.id);
      } else {
        console.log(chalk.blue('Current session:'), binding.sessionId);
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Session operation failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 chat <message>
 * Send chat message to F0 agent
 */
program
  .command('chat <message>')
  .description('Send chat message to F0 agent')
  .option('--locale <locale>', 'Language locale (en or ar)', 'en')
  .option('--with-context', 'Include workspace context', false)
  .action(async (message: string, options) => {
    try {
      const binding = getProjectBinding();
      if (!binding) {
        console.error(chalk.red('✗ No project linked. Run "f0 init <projectId>" first.'));
        process.exit(1);
      }

      if (!binding.sessionId) {
        console.error(chalk.red('✗ No active session. Run "f0 session" first.'));
        process.exit(1);
      }

      const authManager = new AuthManager(binding.apiBase);
      const client = new F0Client(authManager);

      console.log(chalk.blue('Sending message to F0 agent...'));

      let workspaceContext = undefined;
      if (options.withContext) {
        console.log(chalk.gray('Collecting workspace context...'));
        workspaceContext = collectWorkspaceContext(binding.projectId, binding.sessionId);
      }

      const response = await client.sendChat({
        sessionId: binding.sessionId,
        projectId: binding.projectId,
        message,
        locale: options.locale,
        workspaceContext,
      });

      console.log(chalk.green('\n--- F0 Agent Response ---'));
      console.log(response.replyText);

      if (response.patchSuggestion?.hasPatch) {
        console.log(chalk.yellow('\n--- Patch Suggestion ---'));
        console.log(response.patchSuggestion.patchText);
      }

      if (response.taskKind) {
        console.log(chalk.gray(`\nTask kind: ${response.taskKind}`));
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Chat failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 context
 * Show or upload workspace context
 */
program
  .command('context')
  .description('Show or upload workspace context')
  .option('--upload', 'Upload context to F0', false)
  .option('--show', 'Show context (default)', true)
  .action(async (options) => {
    try {
      const binding = getProjectBinding();
      if (!binding) {
        console.error(chalk.red('✗ No project linked. Run "f0 init <projectId>" first.'));
        process.exit(1);
      }

      if (!binding.sessionId) {
        console.error(chalk.red('✗ No active session. Run "f0 session" first.'));
        process.exit(1);
      }

      const authManager = new AuthManager(binding.apiBase);
      const client = new F0Client(authManager);

      console.log(chalk.blue('Collecting workspace context...'));
      const context = collectWorkspaceContext(binding.projectId, binding.sessionId);

      if (options.upload) {
        console.log(chalk.blue('Uploading context to F0...'));
        await client.uploadContext(context);
        console.log(chalk.green('✓ Context uploaded successfully!'));
      } else {
        console.log(chalk.green('\n--- Workspace Context ---'));
        console.log(JSON.stringify(context, null, 2));
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Context operation failed:'), err.message);
      process.exit(1);
    }
  });

/**
 * f0 status
 * Show current configuration and authentication status
 */
program
  .command('status')
  .description('Show current configuration and authentication status')
  .action(async () => {
    try {
      const binding = getProjectBinding();
      const authManager = new AuthManager(binding?.apiBase);

      console.log(chalk.blue('--- F0 CLI Status ---\n'));

      console.log('Authentication:', authManager.isAuthenticated() ? chalk.green('✓ Logged in') : chalk.red('✗ Not logged in'));
      console.log('API Base:', binding?.apiBase || chalk.gray('(not configured)'));
      console.log('Project ID:', binding?.projectId || chalk.gray('(not linked)'));
      console.log('Session ID:', binding?.sessionId || chalk.gray('(no active session)'));

      if (!binding) {
        console.log(chalk.yellow('\nRun "f0 init <projectId>" to link this directory to a project'));
      } else if (!binding.sessionId) {
        console.log(chalk.yellow('\nRun "f0 session" to create an IDE session'));
      }
    } catch (err: any) {
      console.error(chalk.red('✗ Status check failed:'), err.message);
      process.exit(1);
    }
  });

program.parse();
