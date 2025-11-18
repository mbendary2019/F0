/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Deterministic user color generation based on id/name
 * Ensures stable colors across sessions
 */

const hues = [12, 28, 45, 90, 120, 168, 198, 220, 262, 290, 320, 350];

/**
 * Generate a deterministic hue value from a seed string
 * Same seed will always produce the same hue
 */
export const userHue = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hues[h % hues.length];
};

/**
 * Generate a consistent HSL color for a user
 * @param seed - User ID or name
 * @param saturation - Color saturation (0-100)
 * @param lightness - Color lightness (0-100)
 */
export const userColor = (
  seed: string,
  saturation = 85,
  lightness = 56
): string => {
  return `hsl(${userHue(seed)} ${saturation}% ${lightness}%)`;
};

/**
 * Convert HSL color to HSLA with transparency
 * @param hsl - HSL color string
 * @param alpha - Alpha value (0-1)
 */
export const translucent = (hsl: string, alpha = 0.18): string => {
  return hsl.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
};
