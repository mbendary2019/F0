// orchestrator/dev-multiAgentDemo.ts
// =============================================================================
// Phase 155 – Multi-Agent Demo Script (v2)
// Run with: pnpm tsx orchestrator/dev-multiAgentDemo.ts
// =============================================================================

import { InMemoryAgentBus } from './core/multiAgent/agentBus';
import { InMemoryPlanStore } from './core/multiAgent/planStore';
import { PlannerAgent } from './agents/plannerAgent';
import { ReviewAgent } from './agents/reviewAgent';
import {
  AgentMessage,
  TaskResultPayload,
  TaskStatus,
  ReviewDecisionPayload,
} from './core/multiAgent/types';

async function main() {
  console.log('\n🚀 Starting Multi-Agent Demo v2...\n');
  console.log('='.repeat(60));

  const bus = new InMemoryAgentBus();
  const planStore = new InMemoryPlanStore();

  // ✅ Initialize PlannerAgent v2
  const planner = new PlannerAgent({ bus, planStore });

  // ✅ Initialize ReviewAgent v2
  const review = new ReviewAgent({ bus, planStore });

  // ✅ DummyCodeAgent: executes task and returns TASK_RESULT
  bus.subscribe('code', async (msg: AgentMessage) => {
    if (msg.kind !== 'TASK_ASSIGNMENT') return;
    const { task } = msg.payload as { task: { id: string; label: string; kind?: string } };
    console.log(`\n📝 [DummyCodeAgent] Received task: ${task.label}`);
    console.log(`   Kind: ${task.kind || 'unknown'}`);

    // Simulate work
    await sleep(100);

    const result: TaskResultPayload = {
      planId: msg.context.planId!,
      taskId: msg.context.taskId!,
      owner: 'code',
      status: 'COMPLETED' as TaskStatus,
      output: { note: 'Code change simulated successfully.' },
    };

    await bus.publish({
      id: `res_code_${task.id}`,
      timestamp: new Date().toISOString(),
      from: 'code',
      to: 'review',
      kind: 'TASK_RESULT',
      context: msg.context,
      safety: { level: 'medium' },
      payload: result,
    });

    console.log(`   ✅ [DummyCodeAgent] Task ${task.id} completed`);
  });

  // ✅ DummyTestAgent
  bus.subscribe('test', async (msg: AgentMessage) => {
    if (msg.kind !== 'TASK_ASSIGNMENT') return;
    const { task } = msg.payload as { task: { id: string; label: string; kind?: string } };
    console.log(`\n🧪 [DummyTestAgent] Received task: ${task.label}`);

    await sleep(100);

    const result: TaskResultPayload = {
      planId: msg.context.planId!,
      taskId: msg.context.taskId!,
      owner: 'test',
      status: 'COMPLETED' as TaskStatus,
      output: { note: 'Tests written/updated successfully.' },
    };

    await bus.publish({
      id: `res_test_${task.id}`,
      timestamp: new Date().toISOString(),
      from: 'test',
      to: 'review',
      kind: 'TASK_RESULT',
      context: msg.context,
      safety: { level: 'medium' },
      payload: result,
    });

    console.log(`   ✅ [DummyTestAgent] Task ${task.id} completed`);
  });

  // ✅ DummyShellAgent
  bus.subscribe('shell', async (msg: AgentMessage) => {
    if (msg.kind !== 'TASK_ASSIGNMENT') return;
    const { task } = msg.payload as { task: { id: string; label: string } };
    console.log(`\n⚡ [DummyShellAgent] Received task: ${task.label}`);

    await sleep(100);

    const result: TaskResultPayload = {
      planId: msg.context.planId!,
      taskId: msg.context.taskId!,
      owner: 'shell',
      status: 'COMPLETED' as TaskStatus,
      output: { note: 'npm test: All tests passed (simulated).' },
    };

    await bus.publish({
      id: `res_shell_${task.id}`,
      timestamp: new Date().toISOString(),
      from: 'shell',
      to: 'review',
      kind: 'TASK_RESULT',
      context: msg.context,
      safety: { level: 'medium' },
      payload: result,
    });

    console.log(`   ✅ [DummyShellAgent] Task ${task.id} completed`);
  });

  // ✅ Handle review's own task (T4) - auto-complete when received
  // Note: In production, ReviewAgent would handle this differently
  const originalReviewHandler = async (msg: AgentMessage) => {
    if (msg.kind === 'TASK_ASSIGNMENT') {
      const { task } = msg.payload as { task: { id: string; label: string } };
      console.log(`\n👁️ [ReviewAgent] Received self-task: ${task.label}`);

      // Simulate review work
      await sleep(100);

      const result: TaskResultPayload = {
        planId: msg.context.planId!,
        taskId: msg.context.taskId!,
        owner: 'review',
        status: 'COMPLETED' as TaskStatus,
        output: { note: 'Review completed: All checks passed.' },
      };

      // Send result back to review to trigger final decision
      await bus.publish({
        id: `res_review_${task.id}`,
        timestamp: new Date().toISOString(),
        from: 'review',
        to: 'review',
        kind: 'TASK_RESULT',
        context: msg.context,
        safety: { level: 'medium' },
        payload: result,
      });

      console.log(`   ✅ [ReviewAgent] Self-task ${task.id} completed`);
    }
  };
  bus.subscribe('review', originalReviewHandler);

  // ✅ Listen to PLAN_UPDATE broadcasts
  bus.subscribe('conversation', async (msg: AgentMessage) => {
    if (msg.kind === 'PLAN_UPDATE') {
      const payload = msg.payload as { plan: { id: string; goal: string; tasks: unknown[]; metadata?: { inferredGoalType?: string } } };
      console.log('\n📋 [UI/Conversation] Plan Update Received:');
      console.log(`   Plan ID: ${payload.plan.id}`);
      console.log(`   Goal: ${payload.plan.goal}`);
      console.log(`   Goal Type: ${payload.plan.metadata?.inferredGoalType || 'unknown'}`);
      console.log(`   Tasks: ${payload.plan.tasks.length}`);
    }

    if (msg.kind === 'REVIEW_DECISION') {
      const payload = msg.payload as ReviewDecisionPayload;
      console.log('\n' + '='.repeat(60));
      console.log('🔍 [UI/Conversation] REVIEW_DECISION Received:');
      console.log(`   Plan ID: ${payload.planId}`);
      console.log(`   Decision: ${payload.decision}`);
      console.log(`   Summary: ${payload.summary}`);
      if (payload.reasons && payload.reasons.length > 0) {
        console.log(`   Reasons:`);
        for (const reason of payload.reasons) {
          console.log(`     - ${reason}`);
        }
      }
      console.log('='.repeat(60));
    }
  });

  console.log('\n📤 Sending TASK_PROPOSAL to Planner...\n');
  console.log('='.repeat(60));

  // 🔥 Test 1: Bugfix goal (should infer goalType = bugfix)
  await bus.publish({
    id: 'msg_demo_1',
    timestamp: new Date().toISOString(),
    from: 'conversation',
    to: 'planner',
    kind: 'TASK_PROPOSAL',
    context: {
      projectId: 'demo-project',
      workspaceId: 'local',
      userId: 'dev-user',
      conversationId: 'conv-demo',
    },
    safety: { level: 'medium' },
    payload: {
      goal: 'Fix login bug and ensure tests pass',
      projectId: 'demo-project',
    },
    meta: {},
  });

  // Wait for async processing
  await sleep(1000);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Demo v2 completed!\n');

  // Show stored plans
  const allPlans = await planStore.getAll();
  console.log(`📊 Plans in store: ${allPlans.length}`);
  for (const plan of allPlans) {
    console.log(`   - ${plan.id}: "${plan.goal}" (${plan.tasks.length} tasks, type: ${plan.metadata?.inferredGoalType})`);
    for (const task of plan.tasks) {
      console.log(`     • ${task.id}: ${task.label} [${task.status}] (${task.kind || 'N/A'})`);
    }
  }

  console.log('\n🎯 Test different goal types by changing the goal text:');
  console.log('   - "Add user authentication" → feature');
  console.log('   - "Fix login bug" → bugfix');
  console.log('   - "Add tests for API" → tests');
  console.log('   - "Refactor auth module" → refactor');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
