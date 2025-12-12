// orchestrator/core/media/prompts/visionAnalysisPrompt.ts
// Phase 171: Vision Analysis Prompts

import type { AnalysisIntent, MediaType } from '../mediaTypes';

/**
 * System prompt for vision analysis
 */
export function getVisionSystemPrompt(intent: AnalysisIntent, mediaType: MediaType): string {
  const basePrompt = `You are an expert visual analyst and software engineer. You analyze images and documents with precision and provide structured, actionable insights.

Your analysis should be:
- Accurate and detailed
- Structured with clear sections
- Actionable with specific recommendations
- Technical when appropriate`;

  const intentPrompts: Record<AnalysisIntent, string> = {
    general_description: `${basePrompt}

Focus on:
- Main subjects and content
- Key visual elements
- Context and purpose
- Notable details`,

    ui_extraction: `${basePrompt}

You specialize in UI/UX analysis. Focus on:
- Component identification (buttons, forms, cards, etc.)
- Layout structure and hierarchy
- Design patterns used
- Color palette and typography
- Spacing and alignment
- Accessibility considerations`,

    code_extraction: `${basePrompt}

You specialize in code recognition from screenshots. Focus on:
- Accurate code transcription
- Language detection
- Syntax preservation
- Line numbers if visible
- File context if identifiable`,

    document_summary: `${basePrompt}

Focus on document analysis:
- Main topic and purpose
- Key sections and structure
- Important data points
- Conclusions or recommendations
- Target audience`,

    data_extraction: `${basePrompt}

Focus on data extraction:
- Tables and their content
- Charts and graphs interpretation
- Numerical data points
- Labels and legends
- Data relationships`,

    error_analysis: `${basePrompt}

You specialize in debugging and error analysis. Focus on:
- Error message identification
- Stack trace analysis
- Potential root causes
- Suggested fixes
- Severity assessment`,

    design_feedback: `${basePrompt}

You are a senior UI/UX designer. Focus on:
- Visual hierarchy effectiveness
- Color and contrast analysis
- Typography choices
- Spacing and rhythm
- User experience flow
- Modern design principles adherence
- Improvement suggestions`,

    accessibility_audit: `${basePrompt}

You are an accessibility expert (WCAG specialist). Focus on:
- Color contrast issues
- Text readability
- Touch target sizes
- Screen reader compatibility
- Keyboard navigation potential
- WCAG 2.1 compliance issues`,
  };

  return intentPrompts[intent];
}

/**
 * User prompt builder based on intent
 */
export function buildUserPrompt(
  intent: AnalysisIntent,
  userQuestion?: string,
  projectContext?: { techStack?: string[]; designSystem?: string }
): string {
  const contextInfo = projectContext
    ? `\n\nProject Context:
- Tech Stack: ${projectContext.techStack?.join(', ') || 'Not specified'}
- Design System: ${projectContext.designSystem || 'Not specified'}`
    : '';

  const intentInstructions: Record<AnalysisIntent, string> = {
    general_description: 'Describe what you see in this image. Provide a comprehensive overview of the content.',

    ui_extraction: `Analyze this UI screenshot and extract:
1. All visible components (buttons, inputs, cards, etc.)
2. The layout structure
3. Color palette (hex codes if possible)
4. Typography observations
5. Design patterns used

Format your response as structured JSON when possible.`,

    code_extraction: `Extract all visible code from this screenshot:
1. Transcribe the code exactly as shown
2. Identify the programming language
3. Note any visible file paths or names
4. Include line numbers if visible

Preserve exact formatting and indentation.`,

    document_summary: `Summarize this document:
1. Main topic and purpose
2. Key points and findings
3. Any data or statistics mentioned
4. Conclusions or recommendations`,

    data_extraction: `Extract all data from this image:
1. Tables (as structured data)
2. Chart values and labels
3. Any numerical data
4. Relationships between data points

Format as JSON when possible.`,

    error_analysis: `Analyze this error:
1. Identify the error type and message
2. Parse any stack trace
3. Identify the likely root cause
4. Suggest specific fixes
5. Rate severity (low/medium/high/critical)`,

    design_feedback: `Provide design feedback on this UI:
1. What works well
2. Areas for improvement
3. Specific actionable suggestions
4. Modern design principle adherence
5. Overall rating (1-10)`,

    accessibility_audit: `Perform an accessibility audit:
1. Color contrast issues (WCAG AA/AAA)
2. Text size and readability
3. Interactive element sizing
4. Potential screen reader issues
5. Keyboard navigation concerns
6. Overall accessibility score`,
  };

  let prompt = intentInstructions[intent];

  if (userQuestion) {
    prompt += `\n\nUser's specific question: ${userQuestion}`;
  }

  prompt += contextInfo;

  return prompt;
}

/**
 * Response format instructions for structured output
 */
export function getResponseFormatInstructions(intent: AnalysisIntent): string {
  const formats: Record<AnalysisIntent, string> = {
    general_description: `Respond with:
{
  "description": "Main description",
  "findings": ["finding1", "finding2"],
  "suggestions": ["suggestion1"],
  "confidence": 0.95
}`,

    ui_extraction: `Respond with:
{
  "description": "Overview of the UI",
  "findings": ["observation1"],
  "uiComponents": [
    {
      "type": "button|input|card|nav|header|footer|modal|list|table|form|other",
      "name": "Component name",
      "description": "What it does",
      "styles": {
        "colors": ["#hex"],
        "typography": "font info",
        "spacing": "spacing info"
      }
    }
  ],
  "suggestions": ["improvement1"],
  "confidence": 0.9
}`,

    code_extraction: `Respond with:
{
  "description": "What this code does",
  "findings": ["observation1"],
  "codeBlocks": [
    {
      "language": "typescript",
      "code": "extracted code here",
      "filename": "if identifiable",
      "confidence": 0.95
    }
  ],
  "confidence": 0.9
}`,

    document_summary: `Respond with:
{
  "description": "Document summary",
  "findings": ["key point 1", "key point 2"],
  "dataPoints": [
    {"label": "metric", "value": "123", "unit": "users"}
  ],
  "suggestions": ["action item"],
  "confidence": 0.9
}`,

    data_extraction: `Respond with:
{
  "description": "Data overview",
  "findings": ["insight1"],
  "dataPoints": [
    {"label": "label", "value": 123, "unit": "unit", "source": "chart/table"}
  ],
  "confidence": 0.9
}`,

    error_analysis: `Respond with:
{
  "description": "Error summary",
  "findings": [
    "Error type: ...",
    "Root cause: ...",
    "Affected area: ..."
  ],
  "suggestions": [
    "Fix 1: ...",
    "Fix 2: ..."
  ],
  "confidence": 0.85
}`,

    design_feedback: `Respond with:
{
  "description": "Design assessment",
  "findings": [
    "Strength: ...",
    "Weakness: ..."
  ],
  "suggestions": [
    "Improvement 1",
    "Improvement 2"
  ],
  "confidence": 0.8
}`,

    accessibility_audit: `Respond with:
{
  "description": "Accessibility assessment",
  "findings": [
    "Issue 1: ... (WCAG X.X)",
    "Issue 2: ..."
  ],
  "suggestions": [
    "Fix 1",
    "Fix 2"
  ],
  "confidence": 0.85
}`,
  };

  return `\n\nIMPORTANT: ${formats[intent]}`;
}
