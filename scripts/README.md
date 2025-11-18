# Scripts Directory

Utility scripts for project setup, configuration, and maintenance.

---

## 📜 Available Scripts

### `init-feature-flags.js`

**Purpose:** Initialize Feature Flags and App Config for F0 Production Mode

**Usage:**
```bash
cd functions && npm install
node ../scripts/init-feature-flags.js
```

**What it does:**
1. Creates `config/feature_flags` document in Firestore
2. Creates `config/app` document in Firestore
3. Sets all flags to production-ready defaults
4. Configures canary settings (AI eval at 10%)

**Output:**
- Feature flags document with 20+ flags
- App config with mode="F0", allowSignup=true, etc.
- Console confirmation of success

**Requirements:**
- Firebase Admin SDK initialized
- Firestore write permissions
- Project configured with `firebase use`

**Canary Settings:**
- `ai_eval.sampleRate = 0.10` (start at 10%)
- `reviews.img_mod_required = false` (auto-approve initially)

**When to run:**
- First-time F0 activation
- After major config changes
- To reset flags to defaults

**Safe to re-run:** Yes (uses `merge: true`)

---

## 🔧 Prerequisites

### Firebase Admin SDK Setup
```bash
# Login to Firebase
firebase login

# Select project
firebase use --add

# Install dependencies
cd functions
npm install
```

### Environment Variables
No environment variables required. Uses Firebase default credentials.

---

## 📊 Post-Script Verification

### Check Firestore Documents
```bash
# View feature flags
firebase firestore:get config/feature_flags

# View app config
firebase firestore:get config/app
```

### Verify in Firebase Console
1. Open Firebase Console → Firestore Database
2. Navigate to `config` collection
3. Check documents:
   - `feature_flags` - Should have all flags
   - `app` - Should have mode="F0"

### Test Admin UI
1. Deploy hosting: `npm run build && firebase deploy --only hosting`
2. Login as admin
3. Visit `/admin/config/feature-flags`
4. Verify all toggles work

---

## 🆘 Troubleshooting

### Error: "Firebase app not initialized"
**Fix:**
```bash
firebase login
firebase use your-project-id
```

### Error: "Permission denied"
**Fix:** Ensure Firestore rules allow admin write:
```javascript
match /config/{doc} {
  allow read: if true;
  allow write: if isAdmin();
}
```

### Error: "Module not found"
**Fix:**
```bash
cd functions
npm install
cd ..
node scripts/init-feature-flags.js
```

---

## 📝 Adding New Scripts

When adding new scripts to this directory:

1. **Name:** Use kebab-case (e.g., `migrate-data.js`)
2. **Shebang:** Start with `#!/usr/bin/env node`
3. **Documentation:** Add section to this README
4. **Error Handling:** Use try/catch with `process.exit(1)` on error
5. **Logging:** Use console.log with emoji prefixes (🚀, ✅, ❌)
6. **Idempotent:** Make scripts safe to re-run

**Template:**
```javascript
#!/usr/bin/env node

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function yourScript() {
  console.log('🚀 Starting your script...');

  try {
    // Your logic here
    console.log('✅ Success!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

yourScript();
```

---

## 📚 Related Documentation

- [F0_ACTIVATION.md](../F0_ACTIVATION.md) - F0 Production Mode activation guide
- [GO_LIVE_SPRINT_19.md](../GO_LIVE_SPRINT_19.md) - Sprint 19 deployment playbook
- [CHANGELOG.md](../CHANGELOG.md) - Version history

---

**Last Updated:** 2025-01-30
**Version:** 20.0.0
