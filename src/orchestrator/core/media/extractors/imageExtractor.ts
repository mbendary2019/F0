// orchestrator/core/media/extractors/imageExtractor.ts
// Phase 171: Image Content Extractor

import type { MediaInput, ExtractedContent, MediaType } from '../mediaTypes';

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

/**
 * Maximum image size for vision APIs (20MB for most)
 */
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Image validation result
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  suggestedActions?: string[];
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width?: number;
  height?: number;
  format: string;
  sizeBytes: number;
  hasAlpha?: boolean;
  isAnimated?: boolean;
}

/**
 * Validate image input
 */
export function validateImage(input: MediaInput): ImageValidationResult {
  const warnings: string[] = [];
  const suggestedActions: string[] = [];

  // Check MIME type
  if (!SUPPORTED_IMAGE_TYPES.includes(input.mimeType as any)) {
    return {
      valid: false,
      error: `Unsupported image type: ${input.mimeType}. Supported: ${SUPPORTED_IMAGE_TYPES.join(', ')}`,
      suggestedActions: ['Convert image to PNG or JPEG format'],
    };
  }

  // Check size
  if (input.sizeBytes && input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image too large: ${(input.sizeBytes / 1024 / 1024).toFixed(2)}MB. Maximum: 20MB`,
      suggestedActions: ['Compress or resize the image'],
    };
  }

  // Check content type
  if (input.contentType === 'base64') {
    // Validate base64 format
    if (!input.content.match(/^[A-Za-z0-9+/=]+$/)) {
      // Check if it includes data URL prefix
      if (input.content.startsWith('data:image')) {
        suggestedActions.push('Base64 includes data URL prefix - will be stripped');
      } else {
        return {
          valid: false,
          error: 'Invalid base64 encoding',
          suggestedActions: ['Ensure image is properly base64 encoded'],
        };
      }
    }
  }

  // Warnings for large images
  if (input.sizeBytes && input.sizeBytes > 5 * 1024 * 1024) {
    warnings.push('Large image may increase processing time and cost');
    suggestedActions.push('Consider resizing to reduce costs');
  }

  // SVG warning
  if (input.mimeType === 'image/svg+xml') {
    warnings.push('SVG analysis may have limited accuracy for complex vector graphics');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
  };
}

/**
 * Extract base64 content from various input formats
 */
export function extractBase64(input: MediaInput): string {
  if (input.contentType !== 'base64') {
    throw new Error(`Cannot extract base64 from ${input.contentType} input`);
  }

  let base64 = input.content;

  // Strip data URL prefix if present
  if (base64.startsWith('data:')) {
    const commaIndex = base64.indexOf(',');
    if (commaIndex !== -1) {
      base64 = base64.slice(commaIndex + 1);
    }
  }

  return base64;
}

/**
 * Detect media type from image
 */
export function detectMediaType(input: MediaInput): MediaType {
  const filename = input.filename?.toLowerCase() || '';
  const mimeType = input.mimeType.toLowerCase();

  // Check for screenshot indicators
  if (
    filename.includes('screenshot') ||
    filename.includes('screen shot') ||
    filename.includes('capture')
  ) {
    return 'screenshot';
  }

  // Check for UI/design tool exports
  if (
    filename.includes('figma') ||
    filename.includes('sketch') ||
    filename.includes('xd') ||
    filename.includes('frame')
  ) {
    return 'screenshot';
  }

  // Default to image
  return 'image';
}

/**
 * Prepare image for vision API
 */
export function prepareImageForVision(
  input: MediaInput
): { base64: string; mediaType: string } {
  const base64 = extractBase64(input);

  // Map MIME types to what vision APIs expect
  let mediaType = input.mimeType;
  if (mediaType === 'image/jpg') {
    mediaType = 'image/jpeg';
  }

  return { base64, mediaType };
}

/**
 * Extract content from image
 * Note: Actual vision analysis happens in mediaAgent
 * This prepares the image and extracts metadata
 */
export async function extractImageContent(input: MediaInput): Promise<ExtractedContent> {
  // Validate
  const validation = validateImage(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Prepare base64
  const { base64 } = prepareImageForVision(input);

  // Calculate approximate dimensions from base64 size
  // This is a rough estimate - actual dimensions come from vision API
  const estimatedPixels = Math.sqrt((base64.length * 0.75) / 3);

  return {
    // No text extraction for images - that's done by vision API
    metadata: {
      format: input.mimeType,
      sizeBytes: input.sizeBytes || Math.round(base64.length * 0.75),
      filename: input.filename,
      estimatedDimensions: {
        width: Math.round(estimatedPixels),
        height: Math.round(estimatedPixels),
      },
      validationWarnings: validation.warnings,
    },
  };
}

/**
 * Resize image if needed (placeholder - needs sharp or similar)
 */
export async function resizeImageIfNeeded(
  base64: string,
  maxWidth: number = 2048,
  maxHeight: number = 2048
): Promise<string> {
  // In production, use sharp or similar library
  // For now, return as-is
  console.log('[ImageExtractor] Image resize not implemented - using original');
  return base64;
}

/**
 * Convert image URL to base64
 */
export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return { base64, mimeType: contentType };
}

/**
 * Format image for different vision providers
 */
export function formatImageForProvider(
  base64: string,
  mimeType: string,
  provider: 'anthropic' | 'openai' | 'gemini'
): unknown {
  switch (provider) {
    case 'anthropic':
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        },
      };

    case 'openai':
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high',
        },
      };

    case 'gemini':
      return {
        inlineData: {
          mimeType,
          data: base64,
        },
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
