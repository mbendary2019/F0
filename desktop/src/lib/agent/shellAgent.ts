/**
 * Phase 180.1: Shell Agent
 * Detects shell command intent from natural language and executes safely
 *
 * Supports Arabic and English commands like:
 * - "اعرضلي محتويات فولدر src" → ls src
 * - "شغّل npm test" → npm test
 * - "show me the contents of the src folder" → ls src
 */

export interface ShellCommandIntent {
  detected: boolean;
  command?: string;
  args?: string[];
  fullCommand?: string;
  description?: string;
  isSafe: boolean;
  blockedReason?: string;
}

/**
 * Pattern matchers for shell command detection
 */
const SHELL_PATTERNS = {
  // Directory listing patterns
  listDirectory: {
    ar: [
      /(?:اعرضلي|اعرض|شوفني|وريني)\s*(?:محتويات|ملفات|محتوى)?\s*(?:فولدر|مجلد|الفولدر|المجلد)?\s*["`']?([^"`'\n]+)["`']?/i,
      /(?:ايه|شو)\s*(?:الملفات|المحتويات)\s*(?:في|فى|داخل)\s*(?:فولدر|مجلد)?\s*["`']?([^"`'\n]+)["`']?/i,
      /(?:لستلي|عدّدلي)\s*(?:ملفات|محتويات)?\s*(?:فولدر|مجلد)?\s*["`']?([^"`'\n]+)["`']?/i,
    ],
    en: [
      /(?:show|list|display|get)\s*(?:me)?\s*(?:the)?\s*(?:contents?|files?)\s*(?:of|in|inside)?\s*(?:folder|directory|dir)?\s*["`']?([^"`'\n]+)["`']?/i,
      /(?:what's|what\s+is)\s*(?:in|inside)\s*(?:the)?\s*(?:folder|directory|dir)?\s*["`']?([^"`'\n]+)["`']?/i,
      /ls\s+["`']?([^"`'\n]+)["`']?/i,
    ],
  },

  // Run npm/pnpm/yarn commands
  // Phase 180.6: Stop at Arabic text or common explanation words
  runPackageManager: {
    ar: [
      // Match: "شغّل npm test في المشروع ده" → extracts "npm test"
      // Uses non-greedy match and stops at ANY Arabic character or common Arabic words
      /(?:شغّل|شغل|نفّذ|نفذ|ران)\s*(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9\-_:@./\s]+?)(?:\s+(?:في|فى|على|عشان|لان|بعد|قبل|و|ثم|داخل|هنا|دلوقتي|الآن|المشروع|الملف|الفولدر|ده|دي|دا|هذا|هذه)|[\u0600-\u06FF]|$)/i,
      /(?:شغّل|شغل|نفّذ|نفذ)\s*(?:الأمر|الكوماند)?\s*(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9\-_:@./\s]+?)(?:\s+(?:في|فى|على|عشان|لان|بعد|قبل|و|ثم|داخل|هنا|دلوقتي|الآن|المشروع|الملف|الفولدر|ده|دي|دا|هذا|هذه)|[\u0600-\u06FF]|$)/i,
    ],
    en: [
      /(?:run|execute|start)\s*(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9\-_:@./\s]+?)(?:\s+(?:in|on|for|to|from|here|now|please|this|the)|$)/i,
      /(?:please)?\s*(?:can you)?\s*(?:run|execute)\s*(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9\-_:@./\s]+?)(?:\s+(?:in|on|for|to|from|here|now|please|this|the)|$)/i,
    ],
  },

  // Run node commands
  runNode: {
    ar: [
      /(?:شغّل|شغل|نفّذ|نفذ)\s*(?:ملف)?\s*["`']?([^"`'\n]+\.(?:js|ts|mjs|cjs))["`']?/i,
      /(?:شغّل|شغل)\s*(?:سكريبت|ملف)\s*["`']?([^"`'\n]+)["`']?/i,
    ],
    en: [
      /(?:run|execute)\s*(?:the)?\s*(?:file|script)?\s*["`']?([^"`'\n]+\.(?:js|ts|mjs|cjs))["`']?/i,
      /node\s+["`']?([^"`'\n]+)["`']?/i,
    ],
  },

  // Git commands
  runGit: {
    ar: [
      /(?:شغّل|شغل|نفّذ|نفذ)\s*git\s+(.+)/i,
      /(?:اعمل|سوي)\s*(?:git)?\s*(commit|push|pull|status|log|diff|branch|checkout|merge)/i,
    ],
    en: [
      /(?:run|execute|do)\s*(?:a)?\s*git\s+(.+)/i,
      /git\s+(status|log|diff|branch|checkout|merge|pull|push|commit)/i,
    ],
  },

  // General safe commands
  generalCommand: {
    ar: [
      /(?:شغّل|شغل|نفّذ|نفذ)\s*(?:الأمر|الكوماند|كوماند)?\s*["`']([^"`']+)["`']/i,
    ],
    en: [
      /(?:run|execute)\s*(?:the)?\s*(?:command)?\s*["`']([^"`']+)["`']/i,
      /(?:can you|please)?\s*(?:run|execute)\s*["`']([^"`']+)["`']/i,
    ],
  },
};

/**
 * Dangerous patterns that should NEVER be executed
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /rm\s+-r\s+[\/~]/i,
  /rm\s+[\/~]/i,
  /rmdir/i,
  /del\s+\/[sf]/i,
  /format\s+[a-z]:/i,
  />\s*\/dev\/null/i,
  /\|\s*bash/i,
  /\|\s*sh/i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
  /sudo/i,
  /chmod\s+777/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,  // Fork bomb
  />\s*\/etc\//i,
  /eval\s*\(/i,
  /\$\(.*\)/,  // Command substitution can be dangerous
];

/**
 * Allowed command prefixes (safe commands)
 */
const ALLOWED_PREFIXES = [
  'ls', 'dir', 'tree',
  'cat', 'head', 'tail', 'less', 'more',
  'pwd', 'cd',
  'npm', 'pnpm', 'yarn', 'bun', 'npx',
  'node', 'tsx', 'ts-node',
  'git',
  'echo', 'printf',
  'grep', 'find', 'which', 'whereis',
  'wc', 'sort', 'uniq',
  'date', 'cal',
  'env', 'printenv',
];

/**
 * Check if a command is safe to execute
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim().toLowerCase();

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Dangerous pattern detected: ${pattern}` };
    }
  }

  // Get the base command
  const baseCommand = trimmed.split(/\s+/)[0];

  // Check if command starts with allowed prefix
  const isAllowed = ALLOWED_PREFIXES.some(prefix =>
    baseCommand === prefix || baseCommand.startsWith(prefix + '.')
  );

  if (!isAllowed) {
    return { safe: false, reason: `Command "${baseCommand}" is not in the allowed list` };
  }

  return { safe: true };
}

/**
 * Detect shell command intent from user message
 */
export function detectShellCommandIntent(
  message: string,
  locale: 'ar' | 'en' = 'en'
): ShellCommandIntent {
  const msg = message.trim();

  // Try directory listing patterns
  for (const pattern of SHELL_PATTERNS.listDirectory[locale]) {
    const match = msg.match(pattern);
    if (match) {
      const path = match[1]?.trim() || '.';
      const command = `ls -la ${path}`;
      const safety = isCommandSafe(command);

      console.log(`[ShellAgent] Detected list directory intent: "${path}"`);

      return {
        detected: true,
        command: 'ls',
        args: ['-la', path],
        fullCommand: command,
        description: locale === 'ar'
          ? `عرض محتويات المجلد: ${path}`
          : `List contents of: ${path}`,
        isSafe: safety.safe,
        blockedReason: safety.reason,
      };
    }
  }

  // Also check the other locale as fallback
  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  for (const pattern of SHELL_PATTERNS.listDirectory[otherLocale]) {
    const match = msg.match(pattern);
    if (match) {
      const path = match[1]?.trim() || '.';
      const command = `ls -la ${path}`;
      const safety = isCommandSafe(command);

      console.log(`[ShellAgent] Detected list directory intent (fallback): "${path}"`);

      return {
        detected: true,
        command: 'ls',
        args: ['-la', path],
        fullCommand: command,
        description: locale === 'ar'
          ? `عرض محتويات المجلد: ${path}`
          : `List contents of: ${path}`,
        isSafe: safety.safe,
        blockedReason: safety.reason,
      };
    }
  }

  // Try package manager patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of SHELL_PATTERNS.runPackageManager[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const pm = match[1].toLowerCase();
        const args = match[2].trim();
        const command = `${pm} ${args}`;
        const safety = isCommandSafe(command);

        console.log(`[ShellAgent] Detected package manager command: ${command}`);

        return {
          detected: true,
          command: pm,
          args: args.split(/\s+/),
          fullCommand: command,
          description: locale === 'ar'
            ? `تشغيل: ${command}`
            : `Run: ${command}`,
          isSafe: safety.safe,
          blockedReason: safety.reason,
        };
      }
    }
  }

  // Try node patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of SHELL_PATTERNS.runNode[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const file = match[1].trim();
        const command = file.endsWith('.ts') ? `npx tsx ${file}` : `node ${file}`;
        const safety = isCommandSafe(command);

        console.log(`[ShellAgent] Detected node command: ${command}`);

        return {
          detected: true,
          command: file.endsWith('.ts') ? 'npx' : 'node',
          args: file.endsWith('.ts') ? ['tsx', file] : [file],
          fullCommand: command,
          description: locale === 'ar'
            ? `تشغيل ملف: ${file}`
            : `Run file: ${file}`,
          isSafe: safety.safe,
          blockedReason: safety.reason,
        };
      }
    }
  }

  // Try git patterns
  for (const lang of [locale, otherLocale]) {
    for (const pattern of SHELL_PATTERNS.runGit[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const gitArgs = match[1].trim();
        const command = `git ${gitArgs}`;
        const safety = isCommandSafe(command);

        console.log(`[ShellAgent] Detected git command: ${command}`);

        return {
          detected: true,
          command: 'git',
          args: gitArgs.split(/\s+/),
          fullCommand: command,
          description: locale === 'ar'
            ? `تنفيذ أمر Git: ${gitArgs}`
            : `Run Git command: ${gitArgs}`,
          isSafe: safety.safe,
          blockedReason: safety.reason,
        };
      }
    }
  }

  // Try general command patterns (with quotes)
  for (const lang of [locale, otherLocale]) {
    for (const pattern of SHELL_PATTERNS.generalCommand[lang]) {
      const match = msg.match(pattern);
      if (match) {
        const command = match[1].trim();
        const safety = isCommandSafe(command);
        const parts = command.split(/\s+/);

        console.log(`[ShellAgent] Detected general command: ${command}`);

        return {
          detected: true,
          command: parts[0],
          args: parts.slice(1),
          fullCommand: command,
          description: locale === 'ar'
            ? `تنفيذ: ${command}`
            : `Execute: ${command}`,
          isSafe: safety.safe,
          blockedReason: safety.reason,
        };
      }
    }
  }

  // Check for dangerous intent (delete, remove, etc.)
  const dangerousIntentPatterns = {
    ar: [
      /(?:امسح|احذف|شيل)\s*(?:كل|جميع)?\s*(?:الملفات|الفولدر|المجلد|المشروع)/i,
      /(?:امسح|احذف)\s*(?:فولدر|مجلد)\s*(.+)/i,
    ],
    en: [
      /(?:delete|remove|erase)\s*(?:all|the|entire)?\s*(?:files?|folder|directory|project)/i,
      /(?:delete|remove)\s*(?:the)?\s*(?:folder|directory)\s*(.+)/i,
    ],
  };

  for (const lang of [locale, otherLocale]) {
    for (const pattern of dangerousIntentPatterns[lang]) {
      if (pattern.test(msg)) {
        console.log(`[ShellAgent] Detected dangerous intent - blocking`);
        return {
          detected: true,
          isSafe: false,
          blockedReason: locale === 'ar'
            ? 'عذراً، لا أستطيع تنفيذ أوامر الحذف. هذا لحماية ملفاتك.'
            : 'Sorry, I cannot execute delete commands. This is to protect your files.',
        };
      }
    }
  }

  return { detected: false, isSafe: true };
}

/**
 * Parse and format ls -la output into a clean list
 */
function formatLsOutput(output: string, locale: 'ar' | 'en'): string {
  const lines = output.trim().split('\n');
  if (lines.length === 0) return output;

  // Skip the "total X" line if present
  const startIdx = lines[0].startsWith('total ') ? 1 : 0;

  const directories: string[] = [];
  const files: string[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse ls -la output: permissions links owner group size month day time name
    // Example: drwxr-xr-x 26 abdo staff 832 Dec 7 14:06 .
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const permissions = parts[0];
    const size = parts[4];
    const name = parts.slice(8).join(' ');

    // Skip . and .. entries and hidden files starting with .
    if (name === '.' || name === '..') continue;

    // Format size
    const sizeNum = parseInt(size, 10);
    let formattedSize = size;
    if (sizeNum >= 1024 * 1024) {
      formattedSize = `${(sizeNum / (1024 * 1024)).toFixed(1)}MB`;
    } else if (sizeNum >= 1024) {
      formattedSize = `${(sizeNum / 1024).toFixed(1)}KB`;
    } else {
      formattedSize = `${sizeNum}B`;
    }

    // Determine type and add to appropriate list
    if (permissions.startsWith('d')) {
      directories.push(`📁 **${name}/**`);
    } else if (permissions.startsWith('l')) {
      files.push(`🔗 ${name}`);
    } else {
      files.push(`📄 ${name} (${formattedSize})`);
    }
  }

  // Build output
  const result: string[] = [];

  if (directories.length > 0) {
    if (locale === 'ar') {
      result.push(`**المجلدات (${directories.length}):**`);
    } else {
      result.push(`**Folders (${directories.length}):**`);
    }
    result.push(directories.join('\n'));
  }

  if (files.length > 0) {
    if (result.length > 0) result.push(''); // Add spacing
    if (locale === 'ar') {
      result.push(`**الملفات (${files.length}):**`);
    } else {
      result.push(`**Files (${files.length}):**`);
    }
    result.push(files.join('\n'));
  }

  return result.join('\n');
}

/**
 * Check if the error is a "missing script" error
 */
function detectMissingScriptError(output: string): string | null {
  // npm: "npm ERR! missing script: test"
  const npmMatch = output.match(/npm ERR! missing script:\s*(\S+)/i);
  if (npmMatch) return npmMatch[1];

  // pnpm: "ERR_PNPM_NO_SCRIPT  Missing script: test"
  const pnpmMatch = output.match(/Missing script:\s*(\S+)/i);
  if (pnpmMatch) return pnpmMatch[1];

  // yarn: "error Command "test" not found"
  const yarnMatch = output.match(/error Command "(\S+)" not found/i);
  if (yarnMatch) return yarnMatch[1];

  return null;
}

/**
 * Format shell command result for display
 */
export function formatShellResult(
  intent: ShellCommandIntent,
  output: string,
  exitCode: number,
  locale: 'ar' | 'en' = 'en'
): string {
  const success = exitCode === 0;

  // Special formatting for ls commands
  const isLsCommand = intent.command === 'ls' || intent.fullCommand?.startsWith('ls');
  let formattedOutput = output;

  if (success && isLsCommand && output.trim()) {
    formattedOutput = formatLsOutput(output, locale);
  }

  // Phase 180.8: Handle missing script errors gracefully
  if (!success) {
    const missingScript = detectMissingScriptError(output);
    if (missingScript) {
      if (locale === 'ar') {
        return `⚠️ **السكريبت "${missingScript}" مش موجود**

الملف \`package.json\` مفيهوش السكريبت ده.

**الحل:**
أضف السكريبت في \`package.json\`:
\`\`\`json
{
  "scripts": {
    "${missingScript}": "your-command-here"
  }
}
\`\`\`

أو شغّل أمر تاني زي: \`npm run build\` أو \`npm start\``;
      }
      return `⚠️ **Script "${missingScript}" not found**

The \`package.json\` file doesn't have this script defined.

**Solution:**
Add the script to \`package.json\`:
\`\`\`json
{
  "scripts": {
    "${missingScript}": "your-command-here"
  }
}
\`\`\`

Or try a different command like: \`npm run build\` or \`npm start\``;
    }
  }

  if (locale === 'ar') {
    if (!success) {
      return `❌ **فشل تنفيذ الأمر** (\`${intent.fullCommand}\`)

\`\`\`
${output}
\`\`\``;
    }

    if (isLsCommand) {
      return `✅ **تم تنفيذ الأمر:** \`${intent.fullCommand}\`

${formattedOutput}`;
    }

    return `✅ **تم تنفيذ الأمر:** \`${intent.fullCommand}\`

\`\`\`
${output}
\`\`\``;
  }

  if (!success) {
    return `❌ **Command failed** (\`${intent.fullCommand}\`)

\`\`\`
${output}
\`\`\``;
  }

  if (isLsCommand) {
    return `✅ **Executed:** \`${intent.fullCommand}\`

${formattedOutput}`;
  }

  return `✅ **Executed:** \`${intent.fullCommand}\`

\`\`\`
${output}
\`\`\``;
}

/**
 * Format blocked command message
 */
export function formatBlockedMessage(
  intent: ShellCommandIntent,
  locale: 'ar' | 'en' = 'en'
): string {
  if (locale === 'ar') {
    return `🚫 **تم حظر الأمر**\n\n${intent.blockedReason}\n\nلأسباب أمنية، لا أستطيع تنفيذ الأوامر التي قد تضر بملفاتك أو نظامك.`;
  }
  return `🚫 **Command Blocked**\n\n${intent.blockedReason}\n\nFor security reasons, I cannot execute commands that might harm your files or system.`;
}
