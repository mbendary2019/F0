// desktop/src/lib/agent/tools/index.ts
// Phase 124.3: Agent Tools Index
// Phase 124.4: Added API Inspector Tool
// Phase 124.4.1: Added API Query Router
// Phase 124.5: Added API Logs Debugger
// Exports all agent tools for easy import

// Project Snapshot Tool (Phase 123)
export {
  generateProjectSnapshot,
  type ProjectSnapshot,
  type DependencyStats,
  type RoutesStats,
} from './generateProjectSnapshot';

// Route Resolver Tool (Phase 124.3)
export {
  resolveRouteQuery,
  findApiByPath,
  findPageByPath,
  getRoutesByKind,
  searchRoutesByTag,
  formatRouteForDisplay,
  formatRoutesForDisplay,
  type RouteResolverConfig,
  type RouteResolverResult,
} from './routeResolver';

// Ops Permissions Planner Tool (Phase 124.3)
export {
  planOpsPermissions,
  getRoutePermission,
  requiresAdmin,
  getSuggestedGuardCode,
  formatPermissionsPlan,
  type PermissionLevel,
  type RoutePermission,
  type OpsPermissionsPlan,
} from './opsPermissionsPlanner';

// API Inspector Tool (Phase 124.4)
export {
  inspectApiEndpoint,
  inferApiMetadata,
  walkProjectForConsumers,
  formatApiMetadata,
  getSecurityRecommendations,
  type HttpMethod,
  type AuthHint,
  type ApiEndpointMetadata,
  type ApiConsumerReference,
  type ApiInspectorInput,
  type ApiInspectorOutput,
} from './apiInspector';

// API Logs Debugger Tool (Phase 124.5)
export {
  debugApiEndpoint,
  getApiLogsSummary,
  formatDebugOutput,
  type LogLevel,
  type ApiLogEntry,
  type ApiLogsQueryInput,
  type ApiLogsSummary,
  type DebugApiEndpointInput,
  type DebugApiEndpointOutput,
} from './apiLogsDebugger';

// Issue Fixer Tool (Phase 124.6.2)
// Batch Issue Fixer (Phase 124.7)
export {
  applyIssueFix,
  batchApplyIssueFix,
  buildIssueFixPrompt,
  parseFixResponse,
  generateUnifiedDiff,
  generateLocalFix,
  type ApplyIssueFixInput,
  type ApplyIssueFixResult,
  type BatchApplyIssueFixInput,
  type BatchApplyIssueFixResult,
} from './issueFixer';

// API Query Router (Phase 124.4.1)
export {
  resolveApiIntentFromQuery,
  isApiInspectionQuery,
  isApiDebugQuery,
  type ApiQueryIntent,
} from '../prompts/routeAwarePrompt';

// Re-export types from indexer
export type {
  IndexedRoute,
  RoutesIndex,
  RouteSearchResult,
  RouteKind,
} from '../../../../indexer/types';

/**
 * Tool definitions for agent function calling
 * These can be used to register tools with an LLM agent
 */
export const AGENT_TOOL_DEFINITIONS = {
  RESOLVE_ROUTE: {
    name: 'resolve_route',
    description: 'Find the file path for a page or API route based on natural language query. Supports Arabic and English queries like "فين صفحة تسجيل الدخول؟" or "where is the login page?"',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query to find a route',
        },
        kind: {
          type: 'string',
          enum: ['page', 'api', 'all'],
          description: 'Type of route to search for',
        },
      },
      required: ['query'],
    },
  },

  FIND_API: {
    name: 'find_api',
    description: 'Find the API route handler file for a given URL path like /api/chat',
    parameters: {
      type: 'object',
      properties: {
        urlPath: {
          type: 'string',
          description: 'The API URL path to look up',
        },
      },
      required: ['urlPath'],
    },
  },

  PLAN_OPS_PERMISSIONS: {
    name: 'plan_ops_permissions',
    description: 'Analyze all /ops routes and generate a permissions plan with recommended access levels and guards',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  GET_ROUTE_PERMISSION: {
    name: 'get_route_permission',
    description: 'Get the required permission level for a specific route',
    parameters: {
      type: 'object',
      properties: {
        routePath: {
          type: 'string',
          description: 'The route URL path to check',
        },
      },
      required: ['routePath'],
    },
  },

  LIST_ROUTES: {
    name: 'list_routes',
    description: 'List all routes of a specific kind (page or api)',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['page', 'api'],
          description: 'Type of routes to list',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of routes to return',
        },
      },
      required: ['kind'],
    },
  },

  // Phase 124.4: API Inspector Tool
  INSPECT_API: {
    name: 'inspect_api',
    description: 'Analyze an API endpoint to extract methods (GET/POST/etc), authentication type, validation patterns, error codes, and find frontend consumers. Use for questions like "ما هي الـ methods في /api/chat؟" or "show me auth details for /api/billing"',
    parameters: {
      type: 'object',
      properties: {
        urlPath: {
          type: 'string',
          description: 'The API URL path to inspect (e.g., /api/chat, /api/billing/checkout)',
        },
        includeConsumers: {
          type: 'boolean',
          description: 'Whether to find frontend files that call this API (default: false)',
        },
      },
      required: ['urlPath'],
    },
  },

  GET_API_SECURITY: {
    name: 'get_api_security',
    description: 'Get security recommendations for an API endpoint. Returns suggestions for auth, validation, and error handling improvements.',
    parameters: {
      type: 'object',
      properties: {
        urlPath: {
          type: 'string',
          description: 'The API URL path to analyze for security',
        },
      },
      required: ['urlPath'],
    },
  },

  // Phase 124.5: API Logs Debugger Tool
  DEBUG_API: {
    name: 'debug_api',
    description: 'Debug a failing API endpoint by combining static code inspection and recent runtime logs. Use for questions like "ليه /api/auth/login بيرجع 500؟" or "why is /api/billing failing?"',
    parameters: {
      type: 'object',
      properties: {
        urlPath: {
          type: 'string',
          description: 'The API URL path to debug (e.g., /api/auth/login)',
        },
        query: {
          type: 'string',
          description: 'Natural language query about the API issue',
        },
        minutesBack: {
          type: 'number',
          description: 'How many minutes of logs to analyze (default: 60)',
        },
      },
      required: [],
    },
  },

  // Phase 124.6.2: Apply Issue Fix Tool
  APPLY_ISSUE_FIX: {
    name: 'apply_issue_fix',
    description: 'Generate and apply a code fix for a detected issue. Returns the fixed source code or a unified diff.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file containing the issue',
        },
        source: {
          type: 'string',
          description: 'Current source code of the file',
        },
        issue: {
          type: 'object',
          description: 'The issue object from code review',
          properties: {
            id: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'warning', 'error'] },
            category: { type: 'string', enum: ['logic', 'security', 'performance', 'style', 'best-practice'] },
            message: { type: 'string' },
            lineStart: { type: 'number' },
            lineEnd: { type: 'number' },
            fixPrompt: { type: 'string' },
          },
          required: ['id', 'severity', 'category', 'message', 'lineStart', 'lineEnd'],
        },
      },
      required: ['filePath', 'source', 'issue'],
    },
  },

  // Phase 124.7: Batch Apply Issue Fix Tool
  BATCH_APPLY_ISSUE_FIX: {
    name: 'batch_apply_issue_fix',
    description: 'Apply automatic fixes for multiple issues in a single file in one batch. Skips security issues. Returns the fixed source code with a summary of applied and skipped fixes.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file containing the issues',
        },
        source: {
          type: 'string',
          description: 'Current source code of the file',
        },
        issues: {
          type: 'array',
          description: 'Array of issue objects from code review',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              severity: { type: 'string', enum: ['info', 'warning', 'error'] },
              category: { type: 'string', enum: ['logic', 'security', 'performance', 'style', 'best-practice'] },
              message: { type: 'string' },
              lineStart: { type: 'number' },
              lineEnd: { type: 'number' },
              fixPrompt: { type: 'string' },
            },
            required: ['id', 'severity', 'category', 'message', 'lineStart', 'lineEnd'],
          },
        },
      },
      required: ['filePath', 'source', 'issues'],
    },
  },
};

export default {
  AGENT_TOOL_DEFINITIONS,
};
