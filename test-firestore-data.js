// test-firestore-data.js
// اختبار بسيط لقراءة البيانات من Firestore Emulator

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  connectFirestoreEmulator
} = require('firebase/firestore');
const {
  getAuth,
  connectAuthEmulator
} = require('firebase/auth');

// Firebase config
const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "from-zero-84253.firebaseapp.com",
  projectId: "from-zero-84253",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators
connectFirestoreEmulator(db, 'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

async function testFirestoreData() {
  console.log('🔍 Testing Firestore Emulator Data...\n');

  try {
    // Test ops_projects
    console.log('📁 Checking ops_projects collection:');
    const projectsRef = collection(db, 'ops_projects');
    const projectsSnap = await getDocs(projectsRef);
    console.log(`   Total documents: ${projectsSnap.size}`);

    if (projectsSnap.size > 0) {
      console.log('   Sample documents:');
      projectsSnap.forEach((doc, idx) => {
        if (idx < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}:`, {
            ownerUid: data.ownerUid,
            name: data.name,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
          });
        }
      });
    }
    console.log('');

    // Test ops_deployments
    console.log('📁 Checking ops_deployments collection:');
    const deploymentsRef = collection(db, 'ops_deployments');
    const deploymentsSnap = await getDocs(deploymentsRef);
    console.log(`   Total documents: ${deploymentsSnap.size}`);

    if (deploymentsSnap.size > 0) {
      console.log('   Sample documents:');
      deploymentsSnap.forEach((doc, idx) => {
        if (idx < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}:`, {
            ownerUid: data.ownerUid,
            projectId: data.projectId,
          });
        }
      });
    }
    console.log('');

    // Test billing
    console.log('📁 Checking billing collection:');
    const billingRef = collection(db, 'billing');
    const billingSnap = await getDocs(billingRef);
    console.log(`   Total documents: ${billingSnap.size}`);

    if (billingSnap.size > 0) {
      console.log('   Sample documents:');
      billingSnap.forEach((doc, idx) => {
        if (idx < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}:`, {
            tokens: data.tokens,
            plan: data.plan,
          });
        }
      });
    }
    console.log('');

    // Test users (alternative location for tokens)
    console.log('📁 Checking users collection:');
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    console.log(`   Total documents: ${usersSnap.size}`);

    if (usersSnap.size > 0) {
      console.log('   Sample documents:');
      usersSnap.forEach((doc, idx) => {
        if (idx < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}:`, {
            email: data.email,
            fzTokens: data.fzTokens,
            tokens: data.tokens,
          });
        }
      });
    }

    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFirestoreData();
