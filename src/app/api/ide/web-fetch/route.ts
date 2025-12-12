/**
 * Phase 180.2: Web Fetch API
 * Fetches web content for the Browser Agent
 *
 * POST /api/ide/web-fetch
 * Body: { url: string, locale?: 'ar' | 'en' }
 * Response: { success: boolean, title?: string, content?: string, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Blocked domains for security
 */
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '.local',
  '.internal',
  '.intranet',
];

/**
 * Check if URL is safe to fetch
 */
function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `Invalid protocol: ${parsed.protocol}` };
    }

    // Check for blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (parsed.hostname.includes(blocked) || parsed.hostname.startsWith(blocked)) {
        return { safe: false, reason: `Blocked domain: ${parsed.hostname}` };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

/**
 * Extract readable content from HTML
 */
function extractContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'No title';

  // Remove scripts, styles, and other non-content elements
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert common elements to text
  content = content
    .replace(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi, '\n\n## $1\n\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<code[^>]*>([^<]*)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([^<]*)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([^<]*)<\/i>/gi, '*$1*');

  // Remove remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, content };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log('[WebFetch API] Fetching:', url);

    // Validate URL
    const safety = isUrlSafe(url);
    if (!safety.safe) {
      console.log('[WebFetch API] Blocked:', safety.reason);
      return NextResponse.json(
        { success: false, error: safety.reason },
        { status: 403 }
      );
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'F0-Browser-Agent/1.0 (Documentation Fetcher)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5,ar;q=0.3',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: `HTTP ${response.status}: ${response.statusText}` },
          { status: response.status }
        );
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle different content types
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return NextResponse.json({
          success: true,
          title: 'JSON Response',
          content: JSON.stringify(json, null, 2),
        });
      }

      if (contentType.includes('text/plain')) {
        const text = await response.text();
        return NextResponse.json({
          success: true,
          title: 'Plain Text',
          content: text,
        });
      }

      // Default: HTML
      const html = await response.text();
      const { title, content } = extractContent(html);

      console.log('[WebFetch API] Extracted content:', {
        titleLength: title.length,
        contentLength: content.length,
      });

      return NextResponse.json({
        success: true,
        title,
        content,
      });

    } catch (fetchError: any) {
      clearTimeout(timeout);

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { success: false, error: 'Request timed out (10 seconds)' },
          { status: 408 }
        );
      }

      throw fetchError;
    }

  } catch (error: any) {
    console.error('[WebFetch API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch content' },
      { status: 500 }
    );
  }
}
