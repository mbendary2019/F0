# 🔑 How to Get Your Firebase User UID

**Time:** 30 seconds

---

## Method 1: Firebase Console (Easiest)

### Step-by-Step:

1. **Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/from-zero-84253/authentication/users
   ```

2. **Find Your User:**
   - Look for your email in the users list
   - Example: `your-email@example.com`

3. **Click on User:**
   - Click anywhere on the user row

4. **Copy UID:**
   - Find "User UID" field
   - Click the copy icon next to it
   - Example UID: `gFH6k9mPqXYZ123abc456DEF`

5. **Use It:**
   ```bash
   npx ts-node scripts/grantAdmin.ts gFH6k9mPqXYZ123abc456DEF
   ```

---

## Method 2: Firebase CLI

```bash
# Export users
firebase auth:export users.json --project from-zero-84253

# View UIDs
cat users.json | jq '.users[] | {uid, email}'

# Output:
# {
#   "uid": "gFH6k9mPqXYZ123abc456DEF",
#   "email": "your-email@example.com"
# }
```

---

## Method 3: Browser DevTools

1. **Sign in to your app:**
   ```
   http://localhost:3000
   ```

2. **Open DevTools:**
   - Press `F12` or `Cmd+Option+I`
   - Go to "Console" tab

3. **Run this code:**
   ```javascript
   // Get current user
   firebase.auth().onAuthStateChanged(user => {
     if (user) {
       console.log('Your UID:', user.uid);
       // Automatically copy to clipboard
       navigator.clipboard.writeText(user.uid);
       console.log('✅ UID copied to clipboard!');
     }
   });
   ```

4. **UID is now in your clipboard:**
   ```bash
   npx ts-node scripts/grantAdmin.ts PASTE_HERE
   ```

---

## Method 4: From App Code

If you're already signed in to the app:

```typescript
// In any React component
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  console.log('UID:', user.uid);
  // Copy to clipboard
  navigator.clipboard.writeText(user.uid);
  alert(`UID copied: ${user.uid.slice(0, 10)}...`);
}
```

---

## Quick Reference

**Firebase Console URL:**
```
https://console.firebase.google.com/project/from-zero-84253/authentication/users
```

**Grant Admin Command:**
```bash
npx ts-node scripts/grantAdmin.ts YOUR_UID_HERE
```

**Example:**
```bash
npx ts-node scripts/grantAdmin.ts gFH6k9mPqXYZ123abc456DEF
```

---

## Troubleshooting

### Issue: No users in Firebase Console

**Solution:**
1. Create a user first:
   - Go to: Authentication → Users → Add user
   - Or sign up via your app

### Issue: Multiple users, which one?

**Solution:**
- Use the email you normally sign in with
- If unsure, use the most recent one (check "Created" column)

### Issue: UID is very long

**Solution:**
- That's normal! UIDs are typically 28 characters
- Example: `gFH6k9mPqXYZ123abc456DEF789`
- Just copy-paste it, don't type it manually

---

**🎯 Once you have your UID, run:**

```bash
npx ts-node scripts/grantAdmin.ts YOUR_UID_HERE
```

**Then:**
1. Sign out of your app
2. Sign in again
3. Open `/admin/audits`

**Done! 🎉**


