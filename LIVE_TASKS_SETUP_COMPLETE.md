# ✅ Live Tasks Dashboard - Setup Complete

## 🎯 System Status

### Services Running
- ✅ **Next.js:** http://localhost:3000
- ✅ **F0 Orchestrator:** http://localhost:8787
- ✅ **Live Dashboard:** http://localhost:3000/tasks

### Environment Variables
```env
# .env.local
NEXT_PUBLIC_F0_BASE=http://localhost:8787    # Client-side (public)
F0_API_KEY=40553a48...                       # Server-side (secret)
```

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    LIVE TASKS SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser → http://localhost:3000/tasks                     │
│     ↓                                                       │
│  Frontend → GET /api/tasks (every 5s)                      │
│     ↓                                                       │
│  Next.js API → GET localhost:8787/api/last                 │
│     ↓        (with x-f0-key header)                        │
│  F0 Orchestrator → Returns task data                        │
│     ↓                                                       │
│  UI Updates → Status cards, table, counts                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Commands

### 1. Check Orchestrator Health
```bash
# Should return: {"ok": true}
curl -s http://localhost:8787/readyz | jq
```

### 2. Test API Key
```bash
# Should return task list
curl -s -H "x-f0-key: $F0_API_KEY" \
  http://localhost:8787/api/last | jq
```

### 3. Create Task via Next.js API
```bash
curl -s -X POST http://localhost:3000/api/tasks/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write 3 bullets about the 29$/month plan with FZ recharge.",
    "tags": ["demo", "web"]
  }' | jq
```

### 4. Create Task Directly on F0
```bash
curl -s -X POST http://localhost:8787/api/run \
  -H "Content-Type: application/json" \
  -H "x-f0-key: $F0_API_KEY" \
  -d '{
    "prompt": "Generate a one-paragraph PRD intro for FZ Credits.",
    "tags": ["docs"]
  }' | jq
```

### 5. Fetch Tasks via Next.js API
```bash
# Should show all tasks
curl -s http://localhost:3000/api/tasks | jq
```

---

## 📊 Dashboard Features

### Auto-Refresh (Every 5 Seconds)
- ✅ Polls `/api/tasks` endpoint
- ✅ Updates status cards
- ✅ Updates task table
- ✅ Green pulse indicator

### Status Cards
```
┌─────────────┬──────────────┬───────────────┐
│   Queued    │   Running    │   Completed   │
│    (##)     │    (##)      │    (##)       │
│  Clock icon │  Play icon   │  Check icon   │
└─────────────┴──────────────┴───────────────┘
```

### Task Table Columns
1. **Task Name** - Prompt text
2. **Tags** - Task categories
3. **Started** - Timestamp
4. **Duration** - Execution time
5. **Status** - Badge with icon

### Controls
- 🔍 **Search** - By prompt or tags
- 📋 **Filter** - By status (dropdown)
- 🔄 **Refresh** - Manual update button
- ➕ **Run Task** - Create new task

---

## 🐛 Troubleshooting

### Issue: "Failed to connect to F0 API"

**Check:**
```bash
# 1. Is Orchestrator running?
curl http://localhost:8787/readyz

# 2. Is API key correct?
echo $F0_API_KEY

# 3. Test direct connection
curl -H "x-f0-key: $F0_API_KEY" \
  http://localhost:8787/api/last
```

**Fix:**
```bash
# Restart Orchestrator
cd orchestrator
pnpm dev
```

---

### Issue: "F0_API_KEY not configured"

**Check `.env.local`:**
```bash
grep F0_API_KEY .env.local
```

**Fix:**
```bash
# Add to .env.local
echo "F0_API_KEY=40553a48faf4ab1e9f77670df6444229535be8ff7ad4d511d3ee0d87ce1a936a" >> .env.local

# IMPORTANT: Restart Next.js
# Press Ctrl+C in pnpm dev terminal, then:
pnpm dev
```

---

### Issue: No tasks showing

**Check:**
```bash
# 1. Fetch tasks directly from F0
curl -H "x-f0-key: $F0_API_KEY" \
  http://localhost:8787/api/last | jq

# 2. Check Next.js API
curl http://localhost:3000/api/tasks | jq
```

**Fix:**
```bash
# Create a test task
curl -X POST http://localhost:3000/api/tasks/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test task","tags":["demo"]}' | jq

# Wait 5 seconds and refresh dashboard
```

---

### Issue: Tasks not updating

**Possible causes:**
1. Auto-refresh disabled (check console errors)
2. Network issues (check Network tab)
3. API endpoint error (check terminal logs)

**Fix:**
```bash
# 1. Open browser DevTools (F12)
# 2. Go to Network tab
# 3. Watch for /api/tasks requests
# 4. Should see requests every 5 seconds

# Manual refresh test:
curl http://localhost:3000/api/tasks | jq
```

---

## 🎯 Expected Behavior

### 1. Initial Load
```
Loading live data...
↓
✅ Connected to F0 Orchestrator
↓
Status cards update
↓
Tasks table populates
↓
Green pulse indicator appears
```

### 2. Auto-Refresh Cycle
```
Wait 5 seconds
↓
Silent API call to /api/tasks
↓
Data received
↓
UI updates (status cards + table)
↓
Repeat
```

### 3. Run Task Flow
```
Click "Run Task" button
↓
POST /api/tasks/run
↓
F0 creates task
↓
Response: {ok: true}
↓
Alert: "Task started successfully!"
↓
loadTasks() called
↓
New task appears in table
```

---

## 📝 API Endpoints

### GET `/api/tasks`
**Purpose:** Fetch tasks from F0 Orchestrator

**Headers:** None (API key in server-side code)

**Response:**
```json
{
  "ok": true,
  "tasks": [
    {
      "id": "task_001",
      "prompt": "Generate README",
      "tags": ["docs"],
      "status": "completed",
      "createdAt": 1728667200000
    }
  ],
  "total": 1
}
```

### POST `/api/tasks/run`
**Purpose:** Create a new task on F0

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "prompt": "Your task description",
  "tags": ["tag1", "tag2"]
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "merged": { "files": [] },
    "steps": [],
    "checks": { "lint": "ok", "test": "ok", "build": "ok" }
  }
}
```

---

## 🔐 Security Notes

### API Key Handling
- ✅ `F0_API_KEY` - Server-side only (in API routes)
- ✅ `NEXT_PUBLIC_F0_BASE` - Client-side (safe)
- ❌ Never expose `F0_API_KEY` in client code
- ❌ Never commit `.env.local` to git

### Best Practices
1. API key stays on server (API routes)
2. Client only sees public endpoint URLs
3. All F0 requests proxied through Next.js API
4. CORS handled by Next.js

---

## 📊 Monitoring

### Browser Console Logs
```
Fetching tasks from: http://localhost:8787/api/last
Fetched 5 tasks
Running F0 task: { prompt: "...", tags: [...] }
F0 task response: { ok: true, ... }
```

### Next.js Terminal Logs
```
Fetching tasks from: http://localhost:8787/api/last
Creating checkout session: { ... }
Running F0 task: { ... }
F0 task response: { ok: true }
```

### Network Tab (DevTools)
```
GET /api/tasks           200  (every 5s)
POST /api/tasks/run      200  (on button click)
```

---

## ✨ Quick Start

### 1. Ensure Services Running
```bash
# Terminal 1 - Next.js
cd /Users/abdo/Downloads/from-zero-starter
pnpm dev

# Terminal 2 - Orchestrator
cd /Users/abdo/Downloads/from-zero-starter/orchestrator
pnpm dev
```

### 2. Open Dashboard
```bash
open http://localhost:3000/tasks
```

### 3. Run Test Task
Click the **"Run Task"** button in the dashboard

### 4. Watch Live Updates
- ✅ Task appears immediately
- ✅ Status updates every 5 seconds
- ✅ Stats cards update
- ✅ Green pulse indicator active

---

## 🎬 Demo Scenario

1. **Open dashboard:** http://localhost:3000/tasks
2. **See:** "Connected to F0 Orchestrator" message
3. **Click:** "Run Task" button
4. **See:** Alert "Task started successfully!"
5. **Wait:** 5 seconds
6. **See:** Task appears in table
7. **Use:** Search to filter by tags
8. **Use:** Status filter dropdown
9. **Click:** Refresh button (manual update)
10. **Monitor:** Status cards update in real-time

---

## 📚 Additional Resources

### Documentation Files
- `STRIPE_INTEGRATION_COMPLETE.md` - Stripe & payments
- `STRIPE_SETUP_FINAL.md` - Setup instructions
- `PRD_FZ_WALLET.md` - Product requirements
- `PHASE_28R_v1_COMPLETE.md` - Platform architecture

### Key Files
- `src/app/tasks/page.tsx` - Dashboard UI
- `src/app/api/tasks/route.ts` - Fetch tasks API
- `src/app/api/tasks/run/route.ts` - Run task API
- `src/components/BuyButton.tsx` - Payment button

---

**Status:** ✅ All systems operational!

**Last Updated:** October 11, 2025


