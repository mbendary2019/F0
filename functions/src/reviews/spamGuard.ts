/**
 * Spam scoring utility
 * Returns spam score 0-100 (higher = more likely spam)
 */
export function scoreSpam(text: string): number {
  const t = (text || "").toLowerCase();
  let s = 0;

  // Very short reviews
  if (t.length < 5) s += 30;

  // Contains URLs or links
  if (/(http|www\.)/i.test(t)) s += 30;

  // Spam keywords
  if (/(buy now|free money|visit my|click here|check out my)/i.test(t)) s += 40;

  // Repeated characters (e.g., "aaaaaaa")
  if (/(.)\1{6,}/.test(t)) s += 20;

  // All caps
  if (t.length > 10 && t === t.toUpperCase()) s += 15;

  return Math.min(100, s);
}
