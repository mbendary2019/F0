// orchestrator/dev-fullAutonomyDemo.ts
// =============================================================================
// Phase 155.7 – Full Autonomy Demo Script
// Tests the complete flow: TASK_PROPOSAL → Plan → Execute → Review → Git
// Run with: pnpm tsx orchestrator/dev-fullAutonomyDemo.ts
// =============================================================================

import { InMemoryAgentBus } from './core/multiAgent/agentBus';
import { InMemoryPlanStore } from './core/multiAgent/planStore';
import { SafeAgentBus, InMemoryPendingActionsStore } from './core/multiAgent/safeAgentBus';
import { BasicSafetyChecker } from './core/multiAgent/basicSafetyChecker';

// Agents
import { PlannerAgent } from './agents/plannerAgent';
import { ReviewAgent } from './agents/reviewAgent';
import { CodeAgent, DummyCodeEngine } from './agents/codeAgent';
import { TestAgent, DummyTestEngine } from './agents/testAgent';
import { ShellAgent, DummyShellEngine } from './agents/shellAgent';
import { BrowserAgent, DummyBrowserEngine } from './agents/browserAgent';
import { GitAgent, DummyGitEngine } from './agents/gitAgent';

import { AgentMessage, ReviewDecisionPayload } from './core/multiAgent/types';

async function main() {
  console.log('\n🚀 Starting Full Autonomy Demo (Phase 155.7)...\n');
  console.log('='.repeat(70));

  // 1. Create inner bus
  const innerBus = new InMemoryAgentBus();

  // 2. Create stores
  const planStore = new InMemoryPlanStore();
  const pendingStore = new InMemoryPendingActionsStore();

  // 3. Create safety checker
  const safetyChecker = new BasicSafetyChecker();

  // 4. Wrap with SafeAgentBus
  const safeBus = new SafeAgentBus(innerBus, safetyChecker, pendingStore);

  console.log('\n📦 Initializing agents...\n');

  // 5. Initialize all agents
  const planner = new PlannerAgent({ bus: safeBus, planStore });
  const review = new ReviewAgent({ bus: safeBus, planStore });
  const code = new CodeAgent({ bus: safeBus, engine: new DummyCodeEngine() });
  const test = new TestAgent({ bus: safeBus, engine: new DummyTestEngine() });
  const shell = new ShellAgent({ bus: safeBus, engine: new DummyShellEngine() });
  const browser = new BrowserAgent({ bus: safeBus, engine: new DummyBrowserEngine() });
  const git = new GitAgent({ bus: safeBus, engine: new DummyGitEngine() });

  console.log('✅ All agents initialized');
  console.log('   - PlannerAgent');
  console.log('   - ReviewAgent');
  console.log('   - CodeAgent');
  console.log('   - TestAgent');
  console.log('   - ShellAgent');
  console.log('   - BrowserAgent');
  console.log('   - GitAgent');

  // 6. Subscribe to broadcasts for monitoring
  safeBus.subscribe('conversation', async (msg: AgentMessage) => {
    if (msg.kind === 'PLAN_UPDATE') {
      const payload = msg.payload as {
        plan: { id: string; goal: string; tasks: unknown[]; metadata?: { inferredGoalType?: string } };
      };
      console.log('\n📋 [MONITOR] Plan Update:');
      console.log(`   Plan ID: ${payload.plan.id}`);
      console.log(`   Goal: ${payload.plan.goal}`);
      console.log(`   Type: ${payload.plan.metadata?.inferredGoalType || 'unknown'}`);
      console.log(`   Tasks: ${payload.plan.tasks.length}`);
    }

    if (msg.kind === 'REVIEW_DECISION') {
      const payload = msg.payload as ReviewDecisionPayload;
      console.log('\n' + '='.repeat(70));
      console.log('🔍 [MONITOR] REVIEW_DECISION:');
      console.log(`   Plan ID: ${payload.planId}`);
      console.log(`   Decision: ${payload.decision}`);
      console.log(`   Summary: ${payload.summary}`);
      if (payload.reasons && payload.reasons.length > 0) {
        console.log('   Reasons:');
        for (const reason of payload.reasons) {
          console.log(`     - ${reason}`);
        }
      }
      console.log('='.repeat(70));
    }

    if (msg.kind === 'INFO_RESPONSE') {
      const payload = msg.payload as { action?: string; result?: unknown; planId?: string };
      if (payload.action === 'commit' || payload.action === 'rollback') {
        console.log('\n🔧 [MONITOR] Git Action Complete:');
        console.log(`   Action: ${payload.action}`);
        console.log(`   Result:`, payload.result);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n📤 Sending TASK_PROPOSAL: "Add user authentication feature"\n');

  // 7. Publish TASK_PROPOSAL (simulating API route)
  await safeBus.publish({
    id: 'demo_proposal_1',
    timestamp: new Date().toISOString(),
    from: 'conversation',
    to: 'planner',
    kind: 'TASK_PROPOSAL',
    context: {
      projectId: 'demo-project-155',
      workspaceId: 'local',
      userId: 'dev-user',
      conversationId: 'conv-demo-155',
    },
    safety: { level: 'medium' },
    payload: {
      goal: 'Add user authentication feature with login and signup',
      projectId: 'demo-project-155',
      constraints: {
        maxSteps: 10,
        preferSafeMode: true,
        allowShell: true,
        allowBrowser: false,
      },
    },
  });

  // 8. Wait for async processing
  console.log('\n⏳ Waiting for agents to process...\n');
  await sleep(2000);

  // 9. Show final state
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Final State:\n');

  const allPlans = await planStore.getAll();
  console.log(`Plans in store: ${allPlans.length}`);

  for (const plan of allPlans) {
    console.log(`\n📋 Plan: ${plan.id}`);
    console.log(`   Goal: "${plan.goal}"`);
    console.log(`   Status: ${plan.status || 'unknown'}`);
    console.log(`   Type: ${plan.metadata?.inferredGoalType || 'unknown'}`);
    console.log(`   Last Decision: ${plan.metadata?.lastDecision || 'none'}`);
    console.log('   Tasks:');
    for (const task of plan.tasks) {
      const statusIcon = {
        PENDING: '⏳',
        RUNNING: '🔄',
        COMPLETED: '✅',
        FAILED: '❌',
        BLOCKED: '🚫',
        SKIPPED: '⏭️',
      }[task.status] || '❓';
      console.log(`     ${statusIcon} ${task.id}: ${task.label} [${task.status}]`);
    }
  }

  // 10. Show pending actions (if any)
  const pending = pendingStore.getAll();
  if (pending.length > 0) {
    console.log('\n⚠️ Pending Actions (require user approval):');
    for (const action of pending) {
      console.log(`   - ${action.id}: ${action.reason} [${action.status}]`);
    }
  } else {
    console.log('\n✅ No pending actions requiring approval');
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 Full Autonomy Demo completed!\n');
  console.log('Next steps:');
  console.log('  1. Wire real engines (CodeEngine, TestEngine, etc.)');
  console.log('  2. Connect to Firestore for persistence');
  console.log('  3. Add real-time UI updates via AgentPlanPanel');
  console.log('  4. Test with actual code generation\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
