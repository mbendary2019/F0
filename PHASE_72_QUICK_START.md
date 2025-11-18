# Phase 72: Vercel Integration - Quick Start Guide ✅

## ✅ Implementation Complete

All code has been written and is ready for testing!

---

## What Was Built

### 1️⃣ Backend - Cloud Functions

**File**: `functions/src/integrations/vercel-setup.ts`

Two Cloud Functions created:

1. **`testVercelToken`** - Tests the Vercel token and returns user info + projects
2. **`listVercelProjects`** - Returns list of up to 50 Vercel projects

**Token Storage**: `functions/.env` → `F0_VERCEL_TOKEN=OnrnxbgzDrGHQaOnyuVCb1Qr`

### 2️⃣ Frontend - Settings Page

**File**: `src/app/[locale]/settings/integrations/page.tsx`

Updated `connectVercel()` function (lines 218-244) to:
- Call `testVercelToken` Cloud Function
- Display user info and project count in alert
- Update connection status to "Connected ✅"

### 3️⃣ Exports

**File**: `functions/src/index.ts` (line 432)

```typescript
export { testVercelToken, listVercelProjects } from './integrations/vercel-setup';
```

---

## Testing Instructions

### Step 1: Ensure Emulators Are Running

The Firebase emulators should already be running in the background. They automatically reload when files change.

If you need to restart them manually:

```bash
# Kill any existing emulators
pkill -f "firebase emulators"

# Start fresh
firebase emulators:start --only firestore,auth,functions
```

Wait for: `✔ All emulators ready! It is now safe to connect your app.`

### Step 2: Test in Browser

1. Open: http://localhost:3030/settings/integrations
2. Find the **Vercel ▲** card
3. Click **"Connect"** button
4. You should see an alert with:
   ```
   ✅ Vercel Connected!

   User: [Your Vercel username/email]
   Projects: [Number of projects]
   ```
5. The card status should change to **"Connected ✅"**

### Step 3: Check Logs

In the terminal where emulators are running, you should see:

```
[Vercel] Testing token...
[Vercel] Token OK { user: '...', projectCount: ... }
```

---

## How It Works

```
User clicks "Connect"
         ↓
UI calls httpsCallable(functions, 'testVercelToken')
         ↓
Cloud Function reads F0_VERCEL_TOKEN from functions/.env
         ↓
Makes requests to Vercel API:
  - GET /v2/user (user info)
  - GET /v9/projects?limit=10 (projects)
         ↓
Returns { ok: true, user: {...}, projects: [...] }
         ↓
UI displays alert and updates status
```

---

## Files Modified

| File | Lines | Description |
|------|-------|-------------|
| `functions/.env` | 20 | Added `F0_VERCEL_TOKEN` |
| `functions/src/integrations/vercel-setup.ts` | 1-99 | **New file** - Vercel API integration |
| `functions/src/index.ts` | 432 | Export Vercel functions |
| `src/app/[locale]/settings/integrations/page.tsx` | 218-244 | Updated `connectVercel()` to use Manual Token Mode |

---

## Expected Behavior

### ✅ Success Case:

1. Alert shows: `✅ Vercel Connected!`
2. Shows your Vercel user info (name/username/email)
3. Shows project count
4. Card status changes to "Connected ✅"
5. Console logs: `[Vercel] Token OK`

### ❌ Error Cases:

**Token Not Set:**
```
❌ Vercel Connection Failed
F0_VERCEL_TOKEN is not set in functions/.env or secrets
```

**Invalid Token:**
```
❌ Vercel Connection Failed
Vercel API error: 401 ...
```

**Network Error:**
```
❌ Vercel Connection Failed
Failed to fetch
```

---

## Next Steps (Optional)

After testing succeeds, you can implement:

### 1. Project-Level Integration

Add Vercel project selector in:
`src/app/[locale]/projects/[id]/integrations/page.tsx`

This allows linking specific F0 projects to specific Vercel projects.

### 2. Advanced Features

- Auto-deploy from F0 dashboard
- Webhook integration from Vercel → F0
- Deploy status tracking
- Environment variable management

---

## Troubleshooting

### Functions Not Loaded?

Check emulator output for:
```
✔ functions: Loaded functions definitions from source: ..., testVercelToken, listVercelProjects
```

If not showing, restart emulators:
```bash
pkill -f "firebase emulators" && firebase emulators:start --only firestore,auth,functions
```

### Token Issues?

Verify token in `functions/.env`:
```bash
grep F0_VERCEL_TOKEN functions/.env
```

Should show:
```
F0_VERCEL_TOKEN=OnrnxbgzDrGHQaOnyuVCb1Qr
```

### UI Not Calling Function?

Check browser console for errors. Should see:
```
[Vercel] Testing token...
```

---

## Security Notes

✅ Token stored server-side only (`functions/.env`)
✅ Never exposed to client/browser
✅ Cloud Functions make all API calls
✅ UI only displays results

---

**Status**: ✅ Ready for Testing
**Date**: 2025-11-15
**Phase**: 72 - Vercel Integration (Manual Token Mode)

Test now: http://localhost:3030/settings/integrations 🚀
