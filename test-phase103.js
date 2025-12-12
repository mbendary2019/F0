/**
 * Phase 103: Test F0 JSON Processor API
 *
 * Tests:
 * 1. POST /api/f0/process-json with complete JSON
 * 2. Verifies phases, tasks, and actions are created
 */

const API_BASE = 'http://localhost:3030';

async function testProcessJson() {
  console.log('\n🧪 Phase 103: Testing F0 JSON Processor\n');

  // Test Data: Trading platform plan
  const testJson = {
    projectId: 'test',
    lang: 'ar',
    intent: 'plan',
    summary: 'منصة تداول للأسهم الأمريكية للمستثمرين في الخليج',
    target_users: ['المستثمرين الأفراد في الخليج', 'المحللين الماليين'],
    platforms: ['web', 'mobile'],
    clarity_score: 1.0,
    assumptions: {
      frontend: 'Next.js 14 + TypeScript',
      backend: 'Firebase Functions v2',
      db: 'Firestore',
      auth: 'Firebase Auth',
      payments: 'Stripe',
      realtime_data: 'Stock API (Alpha Vantage)',
    },
    phases: [
      {
        id: 'mvp',
        title: 'Phase 1 — MVP',
        goals: ['إطلاق سريع للسوق', 'التحقق من الفكرة'],
        features: [
          'تسجيل الدخول والتحقق من الهوية',
          'عرض أسعار الأسهم الأمريكية الحية',
          'محفظة بسيطة لتتبع الصفقات',
        ],
      },
      {
        id: 'phase2',
        title: 'Phase 2 — التحسينات',
        features: [
          'رسوم بيانية للأسعار (Charts)',
          'قوائم المراقبة (Watchlists)',
          'إشعارات تنبيه السعر',
        ],
      },
      {
        id: 'phase3',
        title: 'Phase 3 — أدوات احترافية',
        features: [
          'مؤشرات فنية (Technical Indicators)',
          'أخبار السوق (News Feed)',
          'دعم اللغات المتعددة',
        ],
      },
    ],
    next_actions: [
      { type: 'preflight' },
      { type: 'execute_task', phase: 'mvp', taskTitle: 'إنشاء واجهة المستخدم الأساسية' },
    ],
  };

  console.log('📤 Sending JSON to /api/f0/process-json...\n');

  try {
    const response = await fetch(`${API_BASE}/api/f0/process-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testJson),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }

    console.log('✅ Success! API Response:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n📊 Results:');
    console.log(`   - Phases Created: ${data.phasesCreated}`);
    console.log(`   - Tasks Created: ${data.tasksCreated}`);
    console.log(`   - Actions Queued: ${data.actionsQueued}`);

    console.log('\n🔍 Next Steps:');
    console.log('   1. Open Firestore Emulator: http://localhost:4000/firestore');
    console.log('   2. Navigate to: projects/test/phases');
    console.log('   3. Check that 3 phase documents exist (mvp, phase2, phase3)');
    console.log('   4. Navigate to: projects/test/tasks');
    console.log(`   5. Check that ${data.tasksCreated} task documents exist`);
    console.log('   6. Navigate to: projects/test/queued_actions');
    console.log(`   7. Check that ${data.actionsQueued} action documents exist`);
    console.log('   8. Check: projects/test should have "memory" field');

    console.log('\n✅ Phase 103 Test Complete!\n');
  } catch (err) {
    console.error('❌ Test Error:', err.message);
  }
}

// Run test
testProcessJson();
