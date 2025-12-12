// src/lib/editor/formatCode.ts
// =============================================================================
// Phase 152.4 – Prettier formatter (browser-side)
// Uses standalone Prettier with language-specific parsers
// =============================================================================
// Phase 152 – Web Code Editor v1 (LOCKED)
// NOTE: Any major behavioral changes should be done in Phase >= 153.
// =============================================================================

import prettier from 'prettier/standalone';
import parserTypescript from 'prettier/plugins/typescript';
import parserBabel from 'prettier/plugins/babel';
import parserHtml from 'prettier/plugins/html';
import parserCss from 'prettier/plugins/postcss';
import parserMarkdown from 'prettier/plugins/markdown';
import parserYaml from 'prettier/plugins/yaml';
import prettierPluginEstree from 'prettier/plugins/estree';

// =============================================================================
// Language to Parser Mapping
// =============================================================================
type ParserName = 'typescript' | 'babel' | 'json' | 'css' | 'scss' | 'html' | 'markdown' | 'yaml';

const LANG_PARSER_MAP: Record<string, ParserName> = {
  // TypeScript/TSX
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',

  // JavaScript/JSX
  js: 'babel',
  jsx: 'babel',
  javascript: 'babel',

  // JSON
  json: 'json',

  // CSS/SCSS
  css: 'css',
  scss: 'scss',

  // HTML
  html: 'html',

  // Markdown
  md: 'markdown',
  markdown: 'markdown',

  // YAML
  yaml: 'yaml',
  yml: 'yaml',
};

// =============================================================================
// Format Function
// =============================================================================
export async function formatCode(
  code: string,
  language: string | null
): Promise<string> {
  const lang = language?.toLowerCase() || 'typescript';
  const parser = LANG_PARSER_MAP[lang] || 'babel';

  console.log('[152.4][WEB][FORMAT] Formatting code', { language, parser, codeLength: code.length });

  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins: [
        parserTypescript,
        parserBabel,
        parserHtml,
        parserCss,
        parserMarkdown,
        parserYaml,
        prettierPluginEstree,
      ],
      // Prettier options
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
      useTabs: false,
      printWidth: 100,
      bracketSpacing: true,
      arrowParens: 'always',
      endOfLine: 'lf',
    });

    console.log('[152.4][WEB][FORMAT] Formatted successfully', {
      originalLength: code.length,
      formattedLength: formatted.length,
    });

    return formatted;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[152.4][WEB][FORMAT] Failed to format', { error: errorMessage });
    throw new Error(`Format failed: ${errorMessage}`);
  }
}

// =============================================================================
// Check if language is supported for formatting
// =============================================================================
export function isFormattable(language: string | null): boolean {
  if (!language) return true; // Default to typescript which is supported
  return language.toLowerCase() in LANG_PARSER_MAP;
}

export default formatCode;
