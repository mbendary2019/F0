/**
 * Phase 106: OpenAI-Compatible Models Endpoint
 * GET /api/openai_compat/v1/models
 *
 * Returns list of available F0 models for Continue extension.
 */

import { NextResponse } from 'next/server';
import type { F0ModelsListResponse } from '@/types/openaiCompat';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export async function GET() {
  const response: F0ModelsListResponse = {
    object: 'list',
    data: [
      {
        id: 'f0-code-agent',
        object: 'model',
        created: 1732665600, // November 27, 2024
        owned_by: 'f0',
      },
    ],
  };

  return NextResponse.json(response);
}
