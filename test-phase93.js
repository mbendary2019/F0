/**
 * Test Phase 93: Project Type Classification & Specialized Personas
 */

const API_URL = 'http://localhost:3030/api/agent/run';

async function testProjectType(message, expectedType, testName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test: ${testName}`);
  console.log(`Message: "${message}"`);
  console.log(`Expected Type: ${expectedType}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-phase93',
        intent: 'continue',
        message,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Agent responded successfully\n');

      // Check if response contains specialized knowledge
      const reply = data.reply.toLowerCase();

      // Look for project type specific keywords
      const keywords = {
        MOBILE_APP_BUILDER: ['vibecode', 'flutterflow', 'app builder', 'visual builder', 'component library', 'drag & drop'],
        BOOKING_SYSTEM: ['appointments', 'calendar', 'time slots', 'booking', 'reservation'],
        ECOMMERCE: ['shopping cart', 'checkout', 'product catalog', 'inventory'],
        MARKETPLACE: ['vendors', 'multi-vendor', 'commission', 'payouts'],
      };

      const foundKeywords = [];
      if (keywords[expectedType]) {
        keywords[expectedType].forEach(kw => {
          if (reply.includes(kw)) foundKeywords.push(kw);
        });
      }

      console.log('📝 Response Preview (first 500 chars):');
      console.log('-'.repeat(80));
      console.log(data.reply.substring(0, 500) + '...');
      console.log('-'.repeat(80));

      console.log(`\n📊 Analysis:`);
      console.log(`   - Response length: ${data.reply.length} characters`);
      console.log(`   - Found specialized keywords: ${foundKeywords.length > 0 ? foundKeywords.join(', ') : 'None'}`);
      console.log(`   - Structured sections: ${/📱|🔧|✨|⚠️/.test(data.reply) ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Ready: ${data.ready}`);

    } else {
      console.log('❌ Agent returned error:', data.error);
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

async function runTests() {
  console.log('\n🚀 Starting Phase 93 Tests: Project Type Classification\n');
  console.log('Testing specialized personas for different project types...\n');

  // Test 1: Mobile App Builder (Vibecode-style)
  await testProjectType(
    'عايز اعمل برنامج ساس يعمل تطبيقات من الموبيل زي برنامج vibecode',
    'MOBILE_APP_BUILDER',
    'Arabic: Mobile App Builder (Vibecode-style)'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Booking System
  await testProjectType(
    'I want to build a doctor booking app',
    'BOOKING_SYSTEM',
    'English: Booking System (Doctor Appointments)'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: E-commerce
  await testProjectType(
    'أحتاج متجر إلكتروني لبيع المنتجات',
    'ECOMMERCE',
    'Arabic: E-commerce Store'
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: Marketplace
  await testProjectType(
    'I need a multi-vendor marketplace like Amazon',
    'MARKETPLACE',
    'English: Multi-vendor Marketplace'
  );

  console.log('\n\n✨ Phase 93 Tests Completed!');
  console.log('\n📊 What to look for:');
  console.log('   ✓ Mobile App Builder: mentions "visual builder", "component library", "build pipeline"');
  console.log('   ✓ Booking System: mentions "calendar", "time slots", "appointments"');
  console.log('   ✓ E-commerce: mentions "shopping cart", "checkout", "inventory"');
  console.log('   ✓ Marketplace: mentions "vendors", "commission", "payouts"\n');
}

// Run tests
runTests().catch(console.error);
