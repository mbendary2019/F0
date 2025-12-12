# Dashboard Quick Test Guide - دليل الاختبار السريع 🚀

**Date:** November 25, 2025
**Status:** ✅ Ready to Test

---

## ✅ Current System Status

### Running Processes:
```
✅ Firebase Emulator (Java)
   PID: 18772
   Firestore: localhost:8080
   Functions: localhost:5001

✅ Next.js Dev Server
   PID: 20240
   URL: http://localhost:3030
```

### Firestore Data:
```
✅ ops_projects:    17 documents
✅ ops_deployments: 6 documents
✅ users:           1 document (fzTokens: 1250, planId: 'pro')
✅ billing:         1 document (backward compatibility)
```

---

## 🎯 Testing Steps

### 1. Open Dashboard
```
http://localhost:3030/en/f0
```

### 2. Expected Values

| Metric | Expected Value | Source |
|--------|---------------|--------|
| **Total Projects** | 17 | ops_projects collection |
| **Projects This Week** | 2-3 | ops_projects (filtered by createdAt) |
| **Deployments** | 6 | ops_deployments collection |
| **FZ Tokens** | 1,250 | users/{uid}.fzTokens |
| **Plan** | Pro ($29/mo) | users/{uid}.planId |
| **Progress Bar** | 12.5% | (1,250 / 10,000) × 100 |

### 3. Visual Check

**Progress Bar Should Look Like:**
```
▓░░░░░░░░░ 12.5%
Pro - $29 / mo (1,250/10,000 FZ)
```

**Header Should Show:**
```
👋 Welcome back, [Username]
```

**Stats Cards:**
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Total Projects  │  │ Live Sessions   │  │ Deployments     │
│      17         │  │       0         │  │       6         │
│ +2 this week ✅ │  │  Active now     │  │  All projects ✅│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🔧 Quick Commands

### Verify Data:
```bash
node test-firestore-admin.js
```

### Check Processes:
```bash
# Firebase Emulator
ps aux | grep java | grep 8080

# Next.js Dev Server
ps aux | grep next-server
```

### Restart if Needed:
```bash
# Kill processes
killall -9 node
killall -9 java

# Restart Firebase Emulator
firebase emulators:start

# Restart Next.js (in new terminal)
PORT=3030 pnpm dev
```

---

## 🐛 Common Issues

### Issue 1: Dashboard shows 0 projects
**Solution:** Check if logged in with correct user (UID: wXjoMFHxcMjl9CbXpQNxM8VPLRQO)

### Issue 2: Progress bar at 0%
**Solution:** Run migration script:
```bash
node migrate-billing-to-users.js
```

### Issue 3: Permission denied errors
**Solution:** Ensure logged in at `http://localhost:3030/en/auth`

---

## 📊 Data Model Reference

### users/{uid} Document:
```json
{
  "fzTokens": 1250,
  "planId": "pro",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### ops_projects Document:
```json
{
  "ownerUid": "wXjoMFHxcMjl9CbXpQNxM8VPLRQO",
  "name": "Project Name",
  "createdAt": "Timestamp"
}
```

### ops_deployments Document:
```json
{
  "ownerUid": "wXjoMFHxcMjl9CbXpQNxM8VPLRQO",
  "projectId": "some-project-id",
  "status": "success",
  "createdAt": "Timestamp"
}
```

---

## 🎉 Success Criteria

When opening `http://localhost:3030/en/f0`, you should see:

✅ Loading skeleton appears briefly
✅ Dashboard loads with real data
✅ Total Projects shows **17**
✅ Projects This Week shows **2-3**
✅ Deployments shows **6**
✅ Progress bar shows **12.5%** filled (pink/purple gradient)
✅ Token display shows **1,250/10,000 FZ**
✅ Plan shows **Pro - $29 / mo**
✅ No console errors
✅ Smooth transitions on progress bar

---

## 📝 Implementation Details

### Hook Location:
```
src/hooks/useDashboardStats.ts (lines 76-87 modified)
```

### Dashboard Page:
```
src/app/[locale]/f0/page.tsx
```

### Migration Script:
```
migrate-billing-to-users.js
```

### Test Script:
```
test-firestore-admin.js
```

---

## 🚀 Ready to Test!

Everything is configured and running. Open the Dashboard now:

```
http://localhost:3030/en/f0
```

---

**Status:** ✅ ALL SYSTEMS GO
**Last Verified:** November 25, 2025
**UID in Use:** wXjoMFHxcMjl9CbXpQNxM8VPLRQO
