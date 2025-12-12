/**
 * Phase 171: File to Base64 Utility
 * Converts File objects to base64 strings for API transmission
 * Phase 171.5: Fixed base64 encoding to handle binary data correctly
 */

/**
 * Convert a File to base64 string
 * Works in both Electron and browser environments
 * Phase 171.5: Use Buffer.from() in Electron for reliable binary encoding
 */
export async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Phase 171.5: Use Buffer in Electron/Node environment for reliable encoding
  // Buffer.from() handles binary data correctly, unlike btoa() which can fail with non-ASCII bytes
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(arrayBuffer);
    console.log('[fileToBase64] Using Buffer.from(), size:', buffer.length);
    return buffer.toString('base64');
  }

  // Fallback for pure browser (unlikely in Electron)
  // Use FileReader for more reliable base64 encoding
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = dataUrl.split(',')[1];
      console.log('[fileToBase64] Using FileReader, base64 length:', base64?.length);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a File to base64 data URL
 * Includes mime type prefix: data:application/pdf;base64,...
 */
export async function fileToDataUrl(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  return `data:${file.type};base64,${base64}`;
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if file is an analyzable type
 */
export function isAnalyzableFile(file: File): boolean {
  const analyzableTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ];
  return analyzableTypes.includes(file.type) ||
         file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Get file kind for API
 */
export function getFileKind(file: File): 'pdf' | 'image' | 'unknown' {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }
  if (file.type.startsWith('image/')) {
    return 'image';
  }
  return 'unknown';
}
