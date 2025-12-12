// orchestrator/core/media/prompts/uiExtractionPrompt.ts
// Phase 171: Specialized UI Extraction Prompts

/**
 * Detailed UI extraction prompt for comprehensive component analysis
 */
export const UI_EXTRACTION_SYSTEM_PROMPT = `You are an expert UI/UX engineer and designer specializing in component analysis and design system documentation.

Your task is to analyze UI screenshots and extract detailed component information that can be used for:
1. Component library documentation
2. Design system creation
3. Code generation
4. Accessibility auditing

Be extremely precise with:
- Component identification and naming
- Color values (use hex codes)
- Spacing measurements (estimate in pixels)
- Typography (font sizes, weights, families)
- Layout structure (flexbox, grid, etc.)`;

/**
 * Component extraction prompt
 */
export const COMPONENT_EXTRACTION_PROMPT = `Analyze this UI screenshot and extract ALL visible components.

For EACH component, provide:
1. **Type**: button, input, card, nav, header, footer, modal, list, table, form, badge, avatar, icon, divider, other
2. **Variant**: primary, secondary, outline, ghost, destructive, etc.
3. **State**: default, hover, active, disabled, loading, error
4. **Content**: Text or icon description
5. **Position**: Approximate location (top-left, center, etc.)
6. **Styling**:
   - Background color (hex)
   - Text color (hex)
   - Border (color, width, radius)
   - Shadow (if any)
   - Padding/margin estimates

Format as structured JSON:
{
  "components": [
    {
      "id": "comp_1",
      "type": "button",
      "variant": "primary",
      "state": "default",
      "content": "Submit",
      "position": { "area": "bottom-right" },
      "styles": {
        "backgroundColor": "#3B82F6",
        "textColor": "#FFFFFF",
        "borderRadius": "8px",
        "padding": "12px 24px",
        "fontSize": "14px",
        "fontWeight": "600"
      },
      "children": []
    }
  ],
  "layout": {
    "type": "flex|grid|absolute",
    "direction": "column|row",
    "gap": "16px",
    "padding": "24px"
  },
  "colorPalette": ["#hex1", "#hex2"],
  "typography": {
    "headings": "font-family, sizes",
    "body": "font-family, sizes"
  }
}`;

/**
 * Layout analysis prompt
 */
export const LAYOUT_ANALYSIS_PROMPT = `Analyze the layout structure of this UI:

1. **Container Structure**:
   - Main container type (card, page, modal, etc.)
   - Layout system (flexbox, grid, absolute)
   - Responsive hints

2. **Hierarchy**:
   - Visual hierarchy levels
   - Component groupings
   - Section divisions

3. **Spacing System**:
   - Consistent spacing values used
   - Padding patterns
   - Gap/margin patterns

4. **Alignment**:
   - Text alignment
   - Component alignment
   - Grid alignment

Provide analysis as structured JSON.`;

/**
 * Design tokens extraction prompt
 */
export const DESIGN_TOKENS_PROMPT = `Extract design tokens from this UI screenshot:

1. **Colors**:
   - Primary, secondary, accent colors
   - Background colors
   - Text colors
   - Border colors
   - State colors (error, success, warning)

2. **Typography**:
   - Font families used
   - Size scale (xs, sm, base, lg, xl, etc.)
   - Weight scale
   - Line heights

3. **Spacing**:
   - Spacing scale values
   - Common padding/margin values

4. **Borders**:
   - Border radius values
   - Border widths
   - Border styles

5. **Shadows**:
   - Shadow values used
   - Shadow intensity levels

Format as design tokens JSON:
{
  "colors": {
    "primary": { "default": "#hex", "hover": "#hex" },
    "secondary": { "default": "#hex" },
    "background": { "default": "#hex", "muted": "#hex" },
    "text": { "default": "#hex", "muted": "#hex" },
    "border": { "default": "#hex" },
    "error": "#hex",
    "success": "#hex"
  },
  "typography": {
    "fontFamily": { "sans": "...", "mono": "..." },
    "fontSize": { "xs": "12px", "sm": "14px", "base": "16px" },
    "fontWeight": { "normal": "400", "medium": "500", "bold": "700" }
  },
  "spacing": { "1": "4px", "2": "8px", "4": "16px", "6": "24px" },
  "borderRadius": { "sm": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "shadow": { "sm": "...", "md": "...", "lg": "..." }
}`;

/**
 * React component generation prompt
 */
export const REACT_COMPONENT_PROMPT = `Based on this UI screenshot, generate a React component implementation.

Requirements:
1. Use TypeScript
2. Use Tailwind CSS for styling
3. Make it accessible (ARIA labels, semantic HTML)
4. Include proper prop types
5. Add JSDoc comments

Generate:
1. Component code
2. Props interface
3. Example usage
4. Storybook story (optional)

Format:
\`\`\`typescript
// ComponentName.tsx
interface ComponentNameProps {
  // props
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    // JSX
  );
}
\`\`\``;

/**
 * Accessibility-focused UI prompt
 */
export const ACCESSIBILITY_UI_PROMPT = `Analyze this UI for accessibility concerns:

1. **Color Contrast**:
   - Text/background contrast ratios
   - WCAG AA compliance (4.5:1 for normal, 3:1 for large text)
   - WCAG AAA compliance (7:1 for normal, 4.5:1 for large)

2. **Interactive Elements**:
   - Touch target sizes (minimum 44x44px recommended)
   - Focus indicators visibility
   - Button/link distinguishability

3. **Text Readability**:
   - Font size adequacy
   - Line height/spacing
   - Text alignment

4. **Visual Indicators**:
   - Color-only information reliance
   - Icon usage with labels
   - Error state visibility

5. **Recommendations**:
   - Specific fixes needed
   - Priority level (critical, high, medium, low)

Format as accessibility report JSON.`;

/**
 * Get specialized prompt based on extraction type
 */
export function getUIExtractionPrompt(
  type: 'components' | 'layout' | 'tokens' | 'react' | 'accessibility'
): string {
  const prompts = {
    components: COMPONENT_EXTRACTION_PROMPT,
    layout: LAYOUT_ANALYSIS_PROMPT,
    tokens: DESIGN_TOKENS_PROMPT,
    react: REACT_COMPONENT_PROMPT,
    accessibility: ACCESSIBILITY_UI_PROMPT,
  };

  return prompts[type];
}
