// orchestrator/core/uiBuilder/uiPlannerAgent.ts
// =============================================================================
// Phase 167.1 – UI PlannerAgent
// Converts UI Proposal → Generation Plan with file structure
// =============================================================================

import {
  UiGenerationPlan,
  UiGenerationMode,
  UiFilePlan,
  UiComponentPlan,
  UiStyleHints,
  UiLayoutStyleHint,
  UiFileKind,
  BuildPlanRequest,
} from './uiGenerationPlanTypes';

import { ComposedContext } from '../neuralMemory/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Component node from UI proposal (Phase 163)
 */
interface ComponentNode {
  type: string;
  name?: string;
  children?: ComponentNode[];
  props?: Record<string, unknown>;
  sourceMemoryId?: string;
}

/**
 * Media memory node (Phase 165)
 */
interface MediaMemoryNode {
  id: string;
  projectId: string;
  summary: string;
  layoutTypes: string[];
  entities: string[];
  components: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: {
    borderRadius?: string;
    shadowLevel?: number;
    spacing?: string;
    theme?: string;
  };
}

/**
 * UI Generation Proposal (Phase 163)
 */
interface UiGenerationProposal {
  id: string;
  projectId: string;
  attachmentId?: string;
  prompt?: string;
  componentTree: ComponentNode;
  suggestedRoute?: string;
  status: string;
}

/**
 * Parameters for building a plan
 */
export interface BuildUiPlanParams {
  projectId: string;
  proposalId: string;
  proposal: UiGenerationProposal;
  mediaMemory?: MediaMemoryNode;
  relatedMedia?: MediaMemoryNode[];
  neuralContext?: ComposedContext;
  targetRoute?: string;
  modeOverride?: UiGenerationMode;
  styleOverrides?: Partial<UiStyleHints>;
}

// =============================================================================
// ID Generators
// =============================================================================

function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateComponentId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine generation mode based on proposal and existing routes
 */
function determineGenerationMode(
  proposal: UiGenerationProposal,
  existingRoutes: string[] = [],
  modeOverride?: UiGenerationMode,
): UiGenerationMode {
  if (modeOverride) return modeOverride;

  const suggestedRoute = proposal.suggestedRoute || '/new-page';

  // Check if route already exists
  if (existingRoutes.includes(suggestedRoute)) {
    return 'extend_page';
  }

  // Check component tree complexity
  const componentCount = countComponents(proposal.componentTree);

  if (componentCount === 1) {
    return 'create_component';
  }

  return 'create_page';
}

/**
 * Count total components in tree
 */
function countComponents(node: ComponentNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countComponents(child);
    }
  }
  return count;
}

/**
 * Extract layout style hint from media memory
 */
function extractLayoutHint(
  mediaMemory?: MediaMemoryNode,
  componentTree?: ComponentNode,
): UiLayoutStyleHint {
  if (mediaMemory?.layoutTypes) {
    const layouts = mediaMemory.layoutTypes;

    if (layouts.includes('dashboard') || layouts.includes('analytics')) {
      return 'dashboard';
    }
    if (layouts.includes('sidebar')) {
      return 'sidebar';
    }
    if (layouts.includes('cards') || layouts.includes('grid')) {
      return 'cards-grid';
    }
    if (layouts.includes('form')) {
      return 'form-page';
    }
    if (layouts.includes('list') || layouts.includes('table')) {
      return 'list-detail';
    }
    if (layouts.includes('landing') || layouts.includes('hero')) {
      return 'landing';
    }
    if (layouts.includes('auth') || layouts.includes('login')) {
      return 'auth-page';
    }
    if (layouts.includes('settings')) {
      return 'settings';
    }
  }

  // Fallback to analyzing component tree
  if (componentTree?.type) {
    const type = componentTree.type.toLowerCase();
    if (type.includes('dashboard')) return 'dashboard';
    if (type.includes('form')) return 'form-page';
    if (type.includes('card')) return 'cards-grid';
    if (type.includes('list') || type.includes('table')) return 'list-detail';
  }

  return 'dashboard'; // Default
}

/**
 * Extract style hints from media memory
 */
function extractStyleHints(
  mediaMemory?: MediaMemoryNode,
  overrides?: Partial<UiStyleHints>,
): UiStyleHints {
  const hints: UiStyleHints = {};

  if (mediaMemory) {
    hints.primaryColor = mediaMemory.primaryColor || undefined;
    hints.secondaryColor = mediaMemory.secondaryColor || undefined;

    if (mediaMemory.accentColors?.length > 0) {
      hints.accentColor = mediaMemory.accentColors[0];
    }

    if (mediaMemory.styleHints) {
      const mh = mediaMemory.styleHints;

      if (mh.borderRadius) {
        hints.borderRadius = mh.borderRadius as UiStyleHints['borderRadius'];
      }
      if (mh.shadowLevel !== undefined) {
        hints.shadows = mh.shadowLevel as UiStyleHints['shadows'];
      }
      if (mh.spacing) {
        hints.spacing = mh.spacing as UiStyleHints['spacing'];
      }
      if (mh.theme) {
        hints.theme = mh.theme as UiStyleHints['theme'];
      }
    }
  }

  // Apply overrides
  return { ...hints, ...overrides };
}

/**
 * Convert route path to valid page name
 */
function routeToPageName(routePath: string): string {
  const parts = routePath.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || 'Page';

  // Convert kebab-case to PascalCase
  const pascal = last
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return `${pascal}Page`;
}

/**
 * Convert route path to file path
 */
function routeToFilePath(routePath: string, kind: UiFileKind = 'page'): string {
  const cleanRoute = routePath.replace(/^\//, '').replace(/\/$/, '');

  switch (kind) {
    case 'page':
      return `src/app/${cleanRoute}/page.tsx`;
    case 'layout':
      return `src/app/${cleanRoute}/layout.tsx`;
    case 'component':
      return `src/components/${cleanRoute}.tsx`;
    default:
      return `src/app/${cleanRoute}/page.tsx`;
  }
}

/**
 * Convert component tree to component plans
 */
function treeToComponentPlans(
  node: ComponentNode,
  depth = 0,
): UiComponentPlan[] {
  const plans: UiComponentPlan[] = [];

  const plan: UiComponentPlan = {
    id: generateComponentId(),
    type: node.type,
    name: node.name || node.type,
    props: node.props || {},
    sourceMemoryId: node.sourceMemoryId,
    positionHint: depth === 0 ? 'main' : 'inline',
    children: [],
  };

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const childPlans = treeToComponentPlans(child, depth + 1);
      plan.children!.push(...childPlans);
    }
  }

  plans.push(plan);
  return plans;
}

/**
 * Generate file plans from component tree
 */
function generateFilePlans(
  componentTree: ComponentNode,
  routePath: string,
  mode: UiGenerationMode,
  pageName: string,
): UiFilePlan[] {
  const files: UiFilePlan[] = [];
  const components = treeToComponentPlans(componentTree);

  // Main page file
  if (mode === 'create_page' || mode === 'extend_page') {
    files.push({
      id: generateFileId(),
      target: {
        path: routeToFilePath(routePath, 'page'),
        kind: 'page',
        language: 'tsx',
      },
      action: mode === 'create_page' ? 'create' : 'modify',
      description: `Main page component for ${routePath}`,
      components,
      imports: [
        "'use client'",
        "import { useState, useEffect } from 'react'",
      ],
      exports: [`export default function ${pageName}()`],
    });
  }

  // Extract reusable components
  const reusableComponents = extractReusableComponents(componentTree);

  for (const comp of reusableComponents) {
    const componentPath = `src/components/${routePath.replace(/\//g, '-').replace(/^-/, '')}/${comp.name}.tsx`;

    files.push({
      id: generateFileId(),
      target: {
        path: componentPath,
        kind: 'component',
        language: 'tsx',
      },
      action: 'create',
      description: `${comp.name} component extracted from design`,
      components: [comp],
      exports: [`export function ${comp.name}()`],
    });
  }

  return files;
}

/**
 * Extract components that should be separate files
 */
function extractReusableComponents(tree: ComponentNode): UiComponentPlan[] {
  const reusable: UiComponentPlan[] = [];

  // Components with multiple children or specific types should be extracted
  const extractableTypes = [
    'Card', 'CardGrid', 'Table', 'DataTable', 'Chart',
    'Form', 'FilterBar', 'Header', 'Footer', 'Sidebar',
    'Modal', 'Dialog', 'Drawer', 'Tabs', 'TabPanel',
  ];

  function traverse(node: ComponentNode) {
    if (node.children && node.children.length > 2) {
      // Complex component - extract
      reusable.push({
        id: generateComponentId(),
        type: node.type,
        name: node.name || node.type,
        props: node.props || {},
        children: node.children.map(c => ({
          id: generateComponentId(),
          type: c.type,
          name: c.name || c.type,
          props: c.props || {},
        })),
      });
    }

    if (extractableTypes.some(t => node.type.includes(t))) {
      reusable.push({
        id: generateComponentId(),
        type: node.type,
        name: node.name || node.type,
        props: node.props || {},
        sourceMemoryId: node.sourceMemoryId,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree);

  // Deduplicate by name
  const seen = new Set<string>();
  return reusable.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

// =============================================================================
// Main Planner Function
// =============================================================================

/**
 * Build a UI Generation Plan from a proposal
 */
export async function buildUiGenerationPlan(
  params: BuildUiPlanParams,
): Promise<UiGenerationPlan> {
  console.log('[167.1][PLANNER] Building UI generation plan:', params.proposalId);

  const {
    projectId,
    proposalId,
    proposal,
    mediaMemory,
    relatedMedia,
    neuralContext,
    targetRoute,
    modeOverride,
    styleOverrides,
  } = params;

  const now = Date.now();

  // Determine route path
  const routePath = targetRoute || proposal.suggestedRoute || '/new-page';
  const pageName = routeToPageName(routePath);

  // Determine generation mode
  const mode = determineGenerationMode(proposal, [], modeOverride);

  // Extract style hints
  const styleHints = extractStyleHints(mediaMemory, styleOverrides);

  // Extract layout hint
  const layoutStyleHint = extractLayoutHint(mediaMemory, proposal.componentTree);

  // Generate file plans
  const files = generateFilePlans(
    proposal.componentTree,
    routePath,
    mode,
    pageName,
  );

  // Collect memory references
  const mediaMemoryIds: string[] = [];
  if (mediaMemory) mediaMemoryIds.push(mediaMemory.id);
  if (relatedMedia) {
    mediaMemoryIds.push(...relatedMedia.map(m => m.id));
  }

  const neuralContextIds = neuralContext?.chunks.map(c => c.id) || [];

  // Build the plan
  const plan: UiGenerationPlan = {
    id: generatePlanId(),
    projectId,
    proposalId,
    sourceAttachmentId: proposal.attachmentId,

    mode,
    routePath,
    pageName,
    layoutStyleHint,
    styleHints,

    files,

    status: 'PLANNED',

    mediaMemoryIds,
    neuralContextIds,

    createdAt: now,
    updatedAt: now,
  };

  console.log('[167.1][PLANNER] Plan built:', plan.id, 'with', files.length, 'files');

  return plan;
}

/**
 * Build plan with LLM assistance (for complex cases)
 */
export async function buildUiGenerationPlanWithLLM(
  params: BuildUiPlanParams,
  llmClient: {
    complete: (prompt: string) => Promise<string>;
  },
): Promise<UiGenerationPlan> {
  console.log('[167.1][PLANNER] Building plan with LLM assistance');

  // First, build basic plan
  const basicPlan = await buildUiGenerationPlan(params);

  // If the plan is simple enough, return as-is
  if (basicPlan.files.length <= 2 && countComponents(params.proposal.componentTree) <= 5) {
    return basicPlan;
  }

  // For complex plans, use LLM to refine file structure
  const prompt = buildLLMPlannerPrompt(params, basicPlan);

  try {
    const response = await llmClient.complete(prompt);
    const refinedPlan = parseLLMPlanResponse(response, basicPlan);
    return refinedPlan;
  } catch (error) {
    console.warn('[167.1][PLANNER] LLM refinement failed, using basic plan:', error);
    return basicPlan;
  }
}

/**
 * Build prompt for LLM planner
 */
function buildLLMPlannerPrompt(
  params: BuildUiPlanParams,
  basicPlan: UiGenerationPlan,
): string {
  const contextXml = params.neuralContext
    ? `<project_context>\n${JSON.stringify(params.neuralContext.chunks.slice(0, 5), null, 2)}\n</project_context>`
    : '';

  return `You are a UI architecture planner. Given a component tree and project context, refine the file structure.

${contextXml}

<component_tree>
${JSON.stringify(params.proposal.componentTree, null, 2)}
</component_tree>

<basic_plan>
${JSON.stringify(basicPlan.files, null, 2)}
</basic_plan>

<task>
Review and refine the file structure. Consider:
1. Which components should be extracted to separate files?
2. Are there any hooks needed for state management?
3. Should we create utility files?
4. What imports and dependencies are needed?

Return a JSON array of refined UiFilePlan objects.
</task>

<output_format>
{
  "files": [
    {
      "id": "file_xxx",
      "target": { "path": "src/...", "kind": "page|component|hook", "language": "tsx" },
      "action": "create",
      "description": "...",
      "components": [...],
      "imports": [...],
      "exports": [...]
    }
  ],
  "requiredPackages": ["package-name"],
  "reasoning": "Brief explanation"
}
</output_format>`;
}

/**
 * Parse LLM response into plan updates
 */
function parseLLMPlanResponse(
  response: string,
  basicPlan: UiGenerationPlan,
): UiGenerationPlan {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return basicPlan;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.files && Array.isArray(parsed.files)) {
      return {
        ...basicPlan,
        files: parsed.files,
        requiredPackages: parsed.requiredPackages || basicPlan.requiredPackages,
        updatedAt: Date.now(),
      };
    }

    return basicPlan;
  } catch {
    return basicPlan;
  }
}

// =============================================================================
// Utility Exports
// =============================================================================

export {
  determineGenerationMode,
  extractLayoutHint,
  extractStyleHints,
  routeToPageName,
  routeToFilePath,
  treeToComponentPlans,
  generateFilePlans,
};

console.log('[167.1][UI_BUILDER] PlannerAgent loaded');
