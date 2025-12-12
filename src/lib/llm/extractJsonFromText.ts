/**
 * Phase 87.2: Extract JSON from LLM response text
 * Handles various formats: plain JSON, markdown code blocks, mixed text
 */

/**
 * Extracts JSON from text that might contain markdown code blocks or extra text
 *
 * @param text - Raw text from LLM (might contain ```json blocks or plain JSON)
 * @returns Parsed JSON object
 * @throws Error if no valid JSON found
 */
export function extractJsonFromText(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  // Try 1: Extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (err) {
      // Continue to next strategy
    }
  }

  // Try 2: Extract first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (err) {
      // Continue to next strategy
    }
  }

  // Try 3: Parse the whole text as JSON
  try {
    return JSON.parse(text.trim());
  } catch (err) {
    throw new Error('Failed to extract valid JSON from LLM response');
  }
}
