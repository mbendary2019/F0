// desktop/src/lib/ace/testGenerationPrompts.ts
// Phase 133.2: Test Generation Prompts for ACE

/**
 * Build a prompt for generating tests for a source file
 */
export const buildTestGenerationPrompt = (params: {
  sourcePath: string;
  sourceCode: string;
  framework?: 'vitest' | 'jest';
}): string => {
  const { sourcePath, sourceCode, framework = 'vitest' } = params;

  // Determine test file path
  const testFilePath = sourcePath.replace(/\.(tsx|ts|js|jsx)$/i, '.spec.ts');

  return `
You are an expert ${framework.toUpperCase()} test writer inside the F0 IDE.

I am working on this source file:
- Path: \`${sourcePath}\`

### Source code:
\`\`\`ts
${sourceCode}
\`\`\`

### Your task

1. Generate a **comprehensive test file** for this module using **${framework}**.
2. Cover at least:
   - Main "happy path" flows
   - Important edge cases
   - Error handling branches (if any)
3. Use clear \`describe\` / \`it\` blocks with meaningful names.
4. Include proper imports and mocks where needed.

### Output format (VERY IMPORTANT)

- Return ONLY a unified diff patch that can be applied to the project.
- Create a new test file at: \`${testFilePath}\`
- Use this exact format:

\`\`\`diff
*** BEGIN PATCH
*** Add File: ${testFilePath}
+ // Test file contents here...
+ import { describe, it, expect } from '${framework}';
+ // ... rest of tests
*** END PATCH
\`\`\`

No explanations, no markdown outside the patch. Only the diff patch.
`.trim();
};

/**
 * Build a prompt for adding tests to an existing test file
 */
export const buildAddTestsPrompt = (params: {
  sourcePath: string;
  sourceCode: string;
  existingTestPath: string;
  existingTestCode: string;
  framework?: 'vitest' | 'jest';
}): string => {
  const { sourcePath, sourceCode, existingTestPath, existingTestCode, framework = 'vitest' } = params;

  return `
You are an expert ${framework.toUpperCase()} test writer inside the F0 IDE.

I have a source file and its existing test file. I need you to add more test coverage.

### Source file: \`${sourcePath}\`
\`\`\`ts
${sourceCode}
\`\`\`

### Existing test file: \`${existingTestPath}\`
\`\`\`ts
${existingTestCode}
\`\`\`

### Your task

1. Analyze the source code and existing tests.
2. Identify uncovered functions, branches, or edge cases.
3. Add new test cases to improve coverage.

### Output format (VERY IMPORTANT)

- Return ONLY a unified diff patch to modify the existing test file.
- Use this exact format:

\`\`\`diff
*** BEGIN PATCH
*** Update File: ${existingTestPath}
@@ ... @@
- old line
+ new line
*** END PATCH
\`\`\`

No explanations, no markdown outside the patch. Only the diff patch.
`.trim();
};

/**
 * Detect test framework from package.json or project structure
 */
export const detectTestFramework = (packageJson?: {
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}): 'vitest' | 'jest' => {
  if (!packageJson) return 'vitest';

  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (deps['vitest']) return 'vitest';
  if (deps['jest']) return 'jest';

  // Default to vitest for modern projects
  return 'vitest';
};
