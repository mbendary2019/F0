// src/lib/agents/orchestratorBus.ts
// =============================================================================
// Phase 155.7 + 157 + 160 + 161 – Orchestrator Bus Singleton
// Wires all agents together with SafeAgentBus
// Uses global to persist across Next.js hot reloads
// =============================================================================

import { InMemoryAgentBus } from '../../../orchestrator/core/multiAgent/agentBus';
import { InMemoryPlanStore } from '../../../orchestrator/core/multiAgent/planStore';
import { SafeAgentBus, InMemoryPendingActionsStore } from '../../../orchestrator/core/multiAgent/safeAgentBus';
import { BasicSafetyChecker } from '../../../orchestrator/core/multiAgent/basicSafetyChecker';

// Agents
import { PlannerAgent } from '../../../orchestrator/agents/plannerAgent';
import { ReviewAgent } from '../../../orchestrator/agents/reviewAgent';
import { CodeAgent, DummyCodeEngine } from '../../../orchestrator/agents/codeAgent';
import { TestAgent, DummyTestEngine } from '../../../orchestrator/agents/testAgent';
import { ShellAgent, DummyShellEngine } from '../../../orchestrator/agents/shellAgent';
import { BrowserAgent, DummyBrowserEngine } from '../../../orchestrator/agents/browserAgent';
import { GitAgent, DummyGitEngine } from '../../../orchestrator/agents/gitAgent';
import { ConversationAgent } from '../../../orchestrator/agents/conversationAgent';
import { MediaAgent } from '../../../orchestrator/agents/mediaAgent';
import { AudioAgent } from '../../../orchestrator/agents/audioAgent';

// Conversation Store
import { getConversationStore } from '../../../orchestrator/core/conversation/conversationStore';

import type { AgentBus } from '../../../orchestrator/core/multiAgent/types';

// Use global to persist singleton across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __orchestratorBus: SafeAgentBus | undefined;
  // eslint-disable-next-line no-var
  var __planStore: InMemoryPlanStore | undefined;
  // eslint-disable-next-line no-var
  var __pendingStore: InMemoryPendingActionsStore | undefined;
  // eslint-disable-next-line no-var
  var __orchestratorAgents: typeof agents | undefined;
}

// Singleton instance (using global for persistence)
let orchestratorBus: SafeAgentBus | null = global.__orchestratorBus || null;
let planStore: InMemoryPlanStore | null = global.__planStore || null;
let pendingStore: InMemoryPendingActionsStore | null = global.__pendingStore || null;

// Agent instances (for potential future access)
let agents: {
  planner?: PlannerAgent;
  review?: ReviewAgent;
  code?: CodeAgent;
  test?: TestAgent;
  shell?: ShellAgent;
  browser?: BrowserAgent;
  git?: GitAgent;
  conversation?: ConversationAgent;
  media?: MediaAgent;
  audio?: AudioAgent;
} = {};

function initializeOrchestrator(): SafeAgentBus {
  console.log('[155.7][ORCHESTRATOR] Initializing orchestrator bus...');

  // Create inner bus
  const innerBus = new InMemoryAgentBus();

  // Create stores
  planStore = new InMemoryPlanStore();
  pendingStore = new InMemoryPendingActionsStore();

  // Create safety checker
  const safetyChecker = new BasicSafetyChecker();

  // Wrap with SafeAgentBus
  const safeBus = new SafeAgentBus(innerBus, safetyChecker, pendingStore);

  // Initialize all agents with the safe bus
  // Note: Agents subscribe to the inner bus but we publish through safe bus

  // PlannerAgent
  agents.planner = new PlannerAgent({
    bus: safeBus,
    planStore,
  });

  // ReviewAgent
  agents.review = new ReviewAgent({
    bus: safeBus,
    planStore,
  });

  // CodeAgent with DummyEngine (replace with real engine in production)
  agents.code = new CodeAgent({
    bus: safeBus,
    engine: new DummyCodeEngine(),
  });

  // TestAgent with DummyEngine
  agents.test = new TestAgent({
    bus: safeBus,
    engine: new DummyTestEngine(),
  });

  // ShellAgent with DummyEngine
  agents.shell = new ShellAgent({
    bus: safeBus,
    engine: new DummyShellEngine(),
  });

  // BrowserAgent with DummyEngine
  agents.browser = new BrowserAgent({
    bus: safeBus,
    engine: new DummyBrowserEngine(),
  });

  // GitAgent with DummyEngine
  agents.git = new GitAgent({
    bus: safeBus,
    engine: new DummyGitEngine(),
  });

  // ConversationAgent (Phase 157)
  agents.conversation = new ConversationAgent({
    bus: safeBus,
    convStore: getConversationStore(),
  });

  // MediaAgent (Phase 160)
  agents.media = new MediaAgent({
    bus: safeBus,
    config: {
      pollIntervalMs: 5000,
      enableAutoProcessing: true,
    },
  });

  // AudioAgent (Phase 161)
  agents.audio = new AudioAgent({
    bus: safeBus,
    config: {
      pollIntervalMs: 5000,
      enableAutoProcessing: true,
    },
  });

  // Store in global for persistence across hot reloads
  global.__orchestratorBus = safeBus;
  global.__planStore = planStore;
  global.__pendingStore = pendingStore;
  global.__orchestratorAgents = agents;

  console.log('[155.7][ORCHESTRATOR] All agents initialized');
  console.log('[155.7][ORCHESTRATOR] Agents:', Object.keys(agents).join(', '));

  return safeBus;
}

/**
 * Get the singleton orchestrator bus
 * Initializes on first call
 */
export function getOrchestratorBus(): AgentBus {
  if (!orchestratorBus) {
    orchestratorBus = initializeOrchestrator();
  }
  return orchestratorBus;
}

/**
 * Get the safe bus with pending actions support
 */
export function getSafeOrchestratorBus(): SafeAgentBus {
  if (!orchestratorBus) {
    orchestratorBus = initializeOrchestrator();
  }
  return orchestratorBus;
}

/**
 * Get the plan store
 */
export function getPlanStore(): InMemoryPlanStore {
  if (!planStore) {
    getOrchestratorBus(); // Initialize
  }
  return planStore!;
}

/**
 * Get the pending actions store
 */
export function getPendingActionsStore(): InMemoryPendingActionsStore {
  if (!pendingStore) {
    getOrchestratorBus(); // Initialize
  }
  return pendingStore!;
}

/**
 * Get agent instances (for debugging/testing)
 */
export function getAgents() {
  if (!orchestratorBus) {
    getOrchestratorBus(); // Initialize
  }
  return agents;
}

/**
 * Reset orchestrator (for testing)
 */
export function resetOrchestrator(): void {
  orchestratorBus = null;
  planStore = null;
  pendingStore = null;
  agents = {};
  console.log('[155.7][ORCHESTRATOR] Reset complete');
}

console.log('[155.7][ORCHESTRATOR] orchestratorBus module loaded');
