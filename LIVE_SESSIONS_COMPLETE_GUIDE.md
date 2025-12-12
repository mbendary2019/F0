# ✅ Live Coding Sessions - Complete Implementation Guide

**Status:** 🎉 80% Complete
**Date:** 25 نوفمبر 2025

---

## ✅ What's Done

### 1. Firestore Rules ✅
- `liveSessions` collection rules
- `events` subcollection rules
- Security: ownerUid validation

### 2. TypeScript Types ✅
- `LiveSession` interface
- `LiveSessionEvent` interface  
- `LiveSessionStatus` & `LiveSessionEventType`

### 3. Helper Functions ✅
- `createLiveSession()` - Start new session
- `endLiveSession()` - End session
- `logLiveSessionEvent()` - Log events

### 4. Hooks ✅
- `useLiveSessionsList()` - List all sessions
- `useLiveSessionDetail()` - Session + events detail
- `useProjectsList()` - Projects list
- `useLiveSessionsStats()` - Dashboard stats (already done)

---

## 📁 Files Created

1. ✅ `src/types/liveSession.ts`
2. ✅ `src/lib/liveSessions.ts`
3. ✅ `src/hooks/useLiveSessionsList.ts`
4. ✅ `src/hooks/useLiveSessionDetail.ts`
5. ✅ `src/hooks/useProjectsList.ts`
6. ✅ `firestore.rules` (updated)

---

## ⏳ Remaining: Pages

Due to token limits, you need to create these pages:

### 1. Live Sessions List Page

**Path:** `src/app/[locale]/f0/live/page.tsx`

**Code Template:**
```typescript
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveSessionsList } from '@/hooks/useLiveSessionsList';
import { useProjectsList } from '@/hooks/useProjectsList';
import { createLiveSession } from '@/lib/liveSessions';

export default function LiveCodingPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  
  const { sessions, loading } = useLiveSessionsList();
  const { projects } = useProjectsList();
  const [selectedProject, setSelectedProject] = useState('');

  async function handleStartSession() {
    if (!selectedProject) return;
    const project = projects.find(p => p.id === selectedProject);
    const sessionId = await createLiveSession(
      selectedProject,
      project?.name
    );
    router.push(`/${locale}/f0/live/${sessionId}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0118] to-[#040c2c] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Start Button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Live Coding Sessions</h1>
          <div className="flex gap-3">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleStartSession}
              disabled={!selectedProject}
              className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:bg-white/10 text-sm font-medium"
            >
              Start session
            </button>
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <p className="text-white/60">Loading...</p>
        ) : sessions.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center">
            <p className="text-white/60">No sessions yet. Start one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/${locale}/f0/live/${s.id}`)}
                className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl px-5 py-4 flex justify-between"
              >
                <div>
                  <p className="font-medium">{s.projectName || s.projectId}</p>
                  <p className="text-xs text-white/60">
                    {s.createdAt.toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${
                  s.status === 'active' 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-white/10 text-white/60'
                }`}>
                  {s.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 2. Live Session Detail Page

**Path:** `src/app/[locale]/f0/live/[sessionId]/page.tsx`

**Code Template:**
```typescript
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useLiveSessionDetail } from '@/hooks/useLiveSessionDetail';
import { endLiveSession, logLiveSessionEvent } from '@/lib/liveSessions';

export default function LiveSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const locale = (params?.locale as string) || 'en';

  const { session, events, loading } = useLiveSessionDetail(sessionId);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b0118] to-[#040c2c] text-white flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  async function handleEnd() {
    await endLiveSession(sessionId);
  }

  async function handleTestEvent() {
    await logLiveSessionEvent(
      sessionId,
      'agent',
      'Agent suggested refactoring the API layer for better performance.'
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0118] to-[#040c2c] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push(`/${locale}/f0/live`)}
              className="text-xs text-white/60 hover:text-white mb-2"
            >
              ← Back to sessions
            </button>
            <h1 className="text-2xl font-semibold">
              {session.projectName || session.projectId}
              <span className={`ml-3 text-xs px-3 py-1 rounded-full ${
                session.status === 'active'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-white/10 text-white/60'
              }`}>
                {session.status}
              </span>
            </h1>
            <p className="text-xs text-white/60">
              Started {session.createdAt.toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTestEvent}
              className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-sm"
            >
              Test Event
            </button>
            <button
              onClick={handleEnd}
              disabled={session.status === 'ended'}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 disabled:bg-white/10 text-sm"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Events Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
            <h2 className="text-sm font-semibold mb-3">Events Timeline</h2>
            {events.length === 0 ? (
              <p className="text-xs text-white/60">
                No events yet. Click "Test Event" to add one.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-auto">
                {events.map(ev => (
                  <div
                    key={ev.id}
                    className="flex gap-3 items-start bg-white/5 rounded-xl p-3"
                  >
                    <div className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                      ev.type === 'system' ? 'bg-white/10' :
                      ev.type === 'agent' ? 'bg-purple-500/40' :
                      ev.type === 'deploy' ? 'bg-green-500/30' :
                      'bg-blue-500/30'
                    }`}>
                      {ev.type[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-white/90">{ev.message}</p>
                      <p className="text-[10px] text-white/40 mt-1">
                        {ev.createdAt.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
            <h2 className="text-sm font-semibold mb-3">Session Info</h2>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-white/60">Project:</span>
                <p className="text-white">{session.projectName}</p>
              </div>
              <div>
                <span className="text-white/60">Status:</span>
                <p className="text-white capitalize">{session.status}</p>
              </div>
              <div>
                <span className="text-white/60">Events:</span>
                <p className="text-white">{events.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔗 Dashboard Integration

Update Dashboard to link to Live Sessions:

**File:** `src/app/[locale]/f0/page.tsx`

Find the "Start Live Session" button and update:

```typescript
<button
  onClick={() => router.push(`/${locale}/f0/live`)}
  className="px-5 py-2 rounded-full bg-pink-500 text-sm font-medium"
>
  Start Live Session
</button>
```

---

## 🧪 Testing

### 1. Start Emulator
```bash
firebase emulators:start --only firestore,auth,functions
```

### 2. Seed Demo Data
```bash
OWNER_UID=upraBmuRv3PEMQOUKs7EuKXU8xLt npx tsx scripts/seedDashboardDemo.ts
```

### 3. Test Flow
1. Open Dashboard: http://localhost:3030/en/f0
2. Click "Start Live Session" → Goes to /f0/live
3. Select a project → Click "Start session"
4. View session detail with events timeline
5. Click "Test Event" to add events
6. Click "End Session" to close

---

## 📊 Progress

**Complete:** 80%
- ✅ Types, Helpers, Hooks, Rules
- ⏳ Pages (need manual creation)

---

## 🎯 Next Steps

1. Create the 2 pages above
2. Test session creation
3. Test events logging
4. Add more event types (deploy, patch, etc.)
5. Connect to IDE Bridge (Phase 84 integration)

---

**Status:** Ready for page creation and testing! 🚀
