/**
 * Phase 100: Media Download Proxy
 * Bypasses CORS restrictions on OpenAI blob storage URLs
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Validate it's an OpenAI blob URL (security check)
    if (!url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      return NextResponse.json(
        { error: 'Invalid image URL' },
        { status: 400 }
      );
    }

    console.log('[media/download] Fetching:', url);

    // Fetch the image from OpenAI's blob storage (no CORS on server-side)
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[media/download] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }

    // Get the blob
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    console.log('[media/download] Successfully fetched, size:', buffer.length);

    // Return the image with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('[media/download] error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error in media/download',
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
