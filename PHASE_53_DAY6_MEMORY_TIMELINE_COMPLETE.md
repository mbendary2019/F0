# Phase 53 Day 6: Memory Timeline & Session Management - COMPLETE ✅

## Overview
Successfully implemented a persistent memory timeline system that tracks AI summaries, manual pins, and session history across daily collaboration sessions.

**Date**: November 6, 2025
**Status**: ✅ **Client-Side Complete** | ⏳ **Deployment Pending**

---

## 🎯 What Was Built

### 1. Firestore Collections (Database Schema)

#### `ops_collab_sessions`
One session per room per day (format: `roomId__YYYYMMDD`)

```typescript
{
  sessionId: 'ide-file-demo-page-tsx__20251106',
  roomId: 'ide-file-demo-page-tsx',
  startedAt: Timestamp,
  lastActivityAt: Timestamp,
  createdBy: { uid, name } | null,
  title: string | null,
  messageCount: number,
  summaryCount: number
}
```

#### `ops_collab_memory`
Timeline items (auto-summaries, manual pins, system notes)

```typescript
{
  roomId: string,
  sessionId: string,
  type: 'auto-summary' | 'manual-pin' | 'system-note',
  content: string,  // The summary/note text
  span: { fromTs: Timestamp, toTs: Timestamp } | null,
  stats: { messages: number, participants: number } | null,
  participants: Array<{ uid: string | null, name: string }>,
  createdAt: Timestamp,
  createdBy: { uid: string, name: string } | null,
  writer: 'cf' | 'user' | 'system',
  pinned: boolean
}
```

### 2. Cloud Functions

#### `commitSummaryToMemory` (Firestore Trigger)
**Location**: [functions/src/collab/commitSummaryToMemory.ts](functions/src/collab/commitSummaryToMemory.ts)

**Trigger**: `onCreate` on `ops_collab_summaries/{summaryId}`

**What it does**:
1. **Upserts session document** (creates new or updates existing)
2. **Adds memory item** with summary content
3. **Tracks metadata** (message count, participants, timestamps)
4. **Uses transactions** for atomic session updates

**Key Features**:
- Date-based session ID generation (`yyyymmdd` helper)
- Transaction-based session management
- Service account bypasses Firestore rules

**Example**:
```typescript
// When AI summary is created, this trigger fires automatically
const sessionId = `${roomId}__20251106`;

// Upsert session
await tx.set(sessionRef, {
  roomId,
  sessionId,
  startedAt: createdAt,
  lastActivityAt: createdAt,
  summaryCount: 1
}, { merge: true });

// Add memory item
await memRef.set({
  roomId,
  sessionId,
  type: 'auto-summary',
  content: data.summary,
  writer: 'cf',
  pinned: false
});
```

### 3. Client SDK

#### `useMemoryTimeline` Hook
**Location**: [src/lib/collab/memory/useMemoryTimeline.ts](src/lib/collab/memory/useMemoryTimeline.ts)

**Features**:
- Real-time Firestore listener (`onSnapshot`)
- Flexible filtering (room-only, room+session)
- Pagination support
- Error handling
- Loading states

**Usage**:
```typescript
const { items, loading, error } = useMemoryTimeline({
  roomId: 'my-room',
  sessionId: 'my-room__20251106',  // Optional
  pageSize: 100
});
```

#### `pinMemory` Function
**Location**: [src/lib/collab/memory/pinMemory.ts](src/lib/collab/memory/pinMemory.ts)

**Features**:
- Validates input (non-empty content)
- Requires user authentication
- Creates manual pin with `writer='user'`
- Returns memory item ID

**Usage**:
```typescript
await pinMemory({
  roomId: 'my-room',
  sessionId: 'my-room__20251106',
  content: 'Important decision: Use GPT-4 for all summaries',
  me: { uid: 'user123', name: 'John Doe' }
});
```

### 4. User Interface

#### Memory Timeline Page
**Location**: [src/app/[locale]/ops/memory/page.tsx](src/app/[locale]/ops/memory/page.tsx)

**Features**:
- 🔍 **Filter Inputs**: Room ID and Session ID filters
- 🔗 **URL Synchronization**: Query params update URL automatically
- 🎨 **Beautiful Card Layout**: Gradient borders, type badges
- 📌 **Pin Indicators**: Visual pin icon for pinned items
- 📊 **Stats Display**: Message count and participant count
- 🔁 **Replay Links**: Click to jump back to collab page
- 🌙 **Dark Mode Support**: Full dark mode styling

**Visual Design**:
```
┌─────────────────────────────────────────┐
│ Memory Timeline                         │
├─────────────────────────────────────────┤
│ Filter: Room ID  [______________]       │
│ Filter: Session  [______________]       │
├─────────────────────────────────────────┤
│ ┌────────────────────────────────────┐  │
│ │ 📌 Manual Pin                      │  │
│ │ 2025-11-06 14:30:45               │  │
│ │ by John Doe                       │  │
│ │ ─────────────────────────────     │  │
│ │ Important decision: Use GPT-4...  │  │
│ │                                   │  │
│ │ 💬 15 messages | 👥 3 participants│  │
│ │ [Replay Session]                  │  │
│ └────────────────────────────────────┘  │
│ ┌────────────────────────────────────┐  │
│ │ 🤖 Auto Summary                   │  │
│ │ 2025-11-06 14:29:00               │  │
│ │ Generated by AI                   │  │
│ │ ─────────────────────────────     │  │
│ │ Team discussed architecture...    │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Collab Page Integration
**Location**: [src/app/[locale]/dev/collab/page.tsx](src/app/[locale]/dev/collab/page.tsx)

**New Features**:
1. **Session ID Generation**: `getTodaySessionId()` creates `roomId__YYYYMMDD`
2. **View Timeline Button**: Opens memory timeline in new tab
3. **Pin Note Button**: Opens modal to create manual pin
4. **Pin Modal**: Beautiful modal with textarea and submit

**Header Updates**:
```typescript
// Session ID: roomId__YYYYMMDD
const sessionId = getTodaySessionId(ROOM_ID);

// View Timeline Button
<a href={`/en/ops/memory?room=${roomId}&session=${sessionId}`}>
  View Timeline
</a>

// Pin Note Button
<button onClick={() => setShowPinModal(true)}>
  Pin Note
</button>
```

**Pin Modal**:
- Beautiful gradient header with bookmark icon
- Textarea for note content
- Cancel and submit buttons
- Loading state during pin
- Auto-close on success

### 5. Security Rules

**Location**: [firestore.rules](firestore.rules)

```javascript
// Sessions (CF/Admin only)
match /ops_collab_sessions/{id} {
  allow read: if isSignedIn();
  allow create, update: if isAdmin();
  allow delete: if false;  // Immutable
}

// Memory Timeline
match /ops_collab_memory/{id} {
  allow read: if isSignedIn();

  // Users can create manual pins
  allow create: if isSignedIn() &&
    request.resource.data.writer == 'user' &&
    request.resource.data.createdBy.uid == request.auth.uid;

  // Users can toggle their own pins
  allow update: if isSignedIn() && (
    (resource.data.writer == 'user' &&
     resource.data.createdBy.uid == request.auth.uid &&
     request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pinned'])) ||
    isAdmin()
  );

  allow delete: if isAdmin();
}
```

### 6. Firestore Indexes

**Location**: [firestore.indexes.phase56.json](firestore.indexes.phase56.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "ops_collab_memory",
      "fields": [
        { "fieldPath": "roomId", "order": "ASCENDING" },
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_collab_sessions",
      "fields": [
        { "fieldPath": "roomId", "order": "ASCENDING" },
        { "fieldPath": "lastActivityAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_collab_memory",
      "fields": [
        { "fieldPath": "roomId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 📁 Files Created/Modified

### New Files
1. ✅ `functions/src/collab/commitSummaryToMemory.ts` - Cloud Function trigger
2. ✅ `firestore.indexes.phase56.json` - Composite indexes
3. ✅ `src/lib/collab/memory/useMemoryTimeline.ts` - React hook
4. ✅ `src/app/[locale]/ops/memory/page.tsx` - Timeline UI page
5. ✅ `src/lib/collab/memory/pinMemory.ts` - Pin helper function

### Modified Files
1. ✅ `functions/src/index.ts` - Added `commitSummaryToMemory` export
2. ✅ `firestore.rules` - Added rules for sessions and memory
3. ✅ `src/app/[locale]/dev/collab/page.tsx` - Added session ID, buttons, modal

---

## 🏗️ Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      MEMORY TIMELINE SYSTEM                  │
└─────────────────────────────────────────────────────────────┘

1. USER SENDS MESSAGES
   ↓
2. AI SUMMARIZATION (Every 60s)
   ↓ Cloud Function: summarizeRoom
   ↓
3. CREATES ops_collab_summaries/{id}
   ↓
4. FIRESTORE TRIGGER: commitSummaryToMemory
   ↓
5. UPSERT ops_collab_sessions/{sessionId}
   │ • Create if first summary today
   │ • Update lastActivityAt + increment counts
   ↓
6. ADD ops_collab_memory/{id}
   │ • type: 'auto-summary'
   │ • writer: 'cf'
   │ • content: AI summary text
   ↓
7. REAL-TIME UPDATE IN UI
   └─> Memory Timeline Page displays new item
   └─> Chat Panel shows AI summary as system message

PARALLEL: MANUAL PINS
   │
   User clicks "Pin Note" button
   ↓
   Modal opens → User types note → Submits
   ↓
   pinMemory() function
   ↓
   CREATE ops_collab_memory/{id}
   │ • type: 'manual-pin'
   │ • writer: 'user'
   │ • createdBy: { uid, name }
   ↓
   Real-time update in Memory Timeline
```

### Session Management Pattern

```typescript
// Session ID Format: roomId__YYYYMMDD
const sessionId = `ide-file-demo-page-tsx__20251106`;

// ONE session per room per day
// All summaries and pins from same day go to same session
// New day = New session

Session Document:
┌────────────────────────────────┐
│ sessionId: "room__20251106"   │
│ roomId: "room"                │
│ startedAt: Timestamp          │  (First activity)
│ lastActivityAt: Timestamp     │  (Latest activity)
│ messageCount: 150             │  (Total messages)
│ summaryCount: 12              │  (Total summaries)
└────────────────────────────────┘
```

---

## 🚀 Deployment Steps

### Prerequisites
- Ensure emulators are running (Firestore, Functions, Auth)
- Ensure all dependencies are installed (`pnpm install`)

### Step 1: Build Cloud Functions
```bash
cd functions
pnpm build
```

### Step 2: Deploy Cloud Function Trigger
```bash
firebase deploy --only functions:commitSummaryToMemory
```

### Step 3: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Step 4: Deploy Firestore Indexes
```bash
# Copy phase56 indexes to main file
cp firestore.indexes.phase56.json firestore.indexes.json

# Deploy indexes
firebase deploy --only firestore:indexes
```

### Step 5: Verify Deployment
```bash
# Check function is deployed
firebase functions:list

# Check indexes are building (may take a few minutes)
firebase firestore:indexes
```

---

## 🧪 Testing Guide

### Test 1: Auto-Summary to Memory
1. Open collab page: http://localhost:3030/en/dev/collab
2. Type at least 3 messages in chat
3. Wait 60 seconds for auto-summarization
4. Check Firestore Emulator UI:
   - `ops_collab_summaries`: Should have new document
   - `ops_collab_sessions`: Should have session document
   - `ops_collab_memory`: Should have memory item with `type: 'auto-summary'`

### Test 2: Manual Pin
1. Open collab page
2. Click "Pin Note" button in header
3. Enter: "Important decision: Use TypeScript strict mode"
4. Click "Pin to Timeline"
5. Check Firestore Emulator UI:
   - `ops_collab_memory`: Should have new item with `type: 'manual-pin'`

### Test 3: Memory Timeline UI
1. Open timeline page: http://localhost:3030/en/ops/memory
2. Enter room ID: `ide-file-demo-page-tsx`
3. Enter session ID: `ide-file-demo-page-tsx__20251106` (today's date)
4. Should see:
   - AI summaries with "Auto Summary" badge
   - Manual pins with "Manual Pin" badge and 📌 icon
   - Sorted by timestamp (newest first)
   - Stats display (message count, participant count)
5. Click "Replay Session" link → Should open collab page in new tab

### Test 4: URL Synchronization
1. Open: http://localhost:3030/en/ops/memory
2. Enter room ID: `test-room`
3. URL should update to: `?room=test-room`
4. Enter session ID: `test-session`
5. URL should update to: `?room=test-room&session=test-session`
6. Refresh page → Filters should persist

### Test 5: Session Persistence
1. Create session today (send messages + wait for summary)
2. Check session document:
   - `startedAt`: First summary timestamp
   - `lastActivityAt`: Latest summary timestamp
   - `messageCount`: Total messages summarized
   - `summaryCount`: Number of summaries
3. Create another summary (send more messages + wait)
4. Check session document again:
   - `messageCount` should increment
   - `summaryCount` should increment
   - `lastActivityAt` should update

---

## 📊 Expected Data Examples

### Session Document
```javascript
{
  sessionId: 'ide-file-demo-page-tsx__20251106',
  roomId: 'ide-file-demo-page-tsx',
  startedAt: Timestamp(2025, 10, 6, 14, 0, 0),
  lastActivityAt: Timestamp(2025, 10, 6, 16, 30, 0),
  createdBy: null,  // AI-generated
  title: null,
  messageCount: 245,
  summaryCount: 15
}
```

### Auto-Summary Memory Item
```javascript
{
  roomId: 'ide-file-demo-page-tsx',
  sessionId: 'ide-file-demo-page-tsx__20251106',
  type: 'auto-summary',
  content: 'Team discussed implementation of memory timeline system. Key decisions: Use Firestore triggers for auto-commit, implement real-time listeners for UI updates.',
  span: {
    fromTs: Timestamp(2025, 10, 6, 14, 28, 0),
    toTs: Timestamp(2025, 10, 6, 14, 29, 0)
  },
  stats: {
    messages: 12,
    participants: 3
  },
  participants: [
    { uid: null, name: 'John Doe' },
    { uid: null, name: 'Jane Smith' },
    { uid: null, name: 'Bob Wilson' }
  ],
  createdAt: Timestamp(2025, 10, 6, 14, 29, 0),
  createdBy: null,
  writer: 'cf',
  pinned: false
}
```

### Manual Pin Memory Item
```javascript
{
  roomId: 'ide-file-demo-page-tsx',
  sessionId: 'ide-file-demo-page-tsx__20251106',
  type: 'manual-pin',
  content: 'IMPORTANT: Always use serverTimestamp() for createdAt fields',
  span: null,
  stats: null,
  participants: [],
  createdAt: Timestamp(2025, 10, 6, 14, 35, 12),
  createdBy: {
    uid: 'user123',
    name: 'John Doe'
  },
  writer: 'user',
  pinned: true
}
```

---

## 🎨 UI Components Reference

### Memory Timeline Page Components

#### Filter Section
```tsx
<div className="flex gap-4 mb-6">
  <input
    type="text"
    placeholder="Room ID (e.g., my-room)"
    value={roomId}
    onChange={(e) => setRoomId(e.target.value || undefined)}
  />
  <input
    type="text"
    placeholder="Session ID (e.g., my-room__20251106)"
    value={sessionId}
    onChange={(e) => setSessionId(e.target.value || undefined)}
  />
</div>
```

#### Memory Card
```tsx
<div className="border rounded-lg p-4">
  {/* Type Badge */}
  <span className={badgeClass}>{type}</span>

  {/* Timestamp */}
  <div className="text-sm text-neutral-500">
    {formatMemoryTimestamp(item.createdAt)}
  </div>

  {/* Author */}
  {item.createdBy && (
    <div className="text-sm text-neutral-600">
      by {item.createdBy.name}
    </div>
  )}

  {/* Content */}
  <div className="mt-3 text-neutral-900 dark:text-neutral-100">
    {item.content}
  </div>

  {/* Stats */}
  {item.stats && (
    <div className="mt-3 flex gap-4 text-sm">
      <span>💬 {item.stats.messages} messages</span>
      <span>👥 {item.stats.participants} participants</span>
    </div>
  )}

  {/* Actions */}
  <a href={replayUrl} target="_blank">
    Replay Session
  </a>
</div>
```

### Pin Modal Component
```tsx
<PinModal onClose={handleClose} onPin={handlePin}>
  <textarea
    placeholder="Enter an important note, decision, or reminder..."
    rows={4}
  />
  <button type="submit">Pin to Timeline</button>
</PinModal>
```

---

## 🔧 Configuration Reference

### Environment Variables
No new environment variables required. Uses existing Firebase config.

### TypeScript Types
```typescript
// Memory Item Type
export type MemoryItem = {
  id: string;
  roomId: string;
  sessionId: string;
  type: 'auto-summary' | 'manual-pin' | 'system-note';
  content: string;
  span: { fromTs: Timestamp; toTs: Timestamp } | null;
  stats: { messages: number; participants: number } | null;
  participants: Array<{ uid: string | null; name: string }>;
  createdAt: Timestamp;
  createdBy: { uid: string; name: string } | null;
  writer: 'cf' | 'user' | 'system';
  pinned: boolean;
};

// Session Type
export type CollabSession = {
  sessionId: string;
  roomId: string;
  startedAt: Timestamp;
  lastActivityAt: Timestamp;
  createdBy: { uid: string; name: string } | null;
  title: string | null;
  messageCount: number;
  summaryCount: number;
};
```

---

## 🎯 Success Criteria

### ✅ Completed
- [x] Cloud Function trigger creates memory items from summaries
- [x] Session documents are created/updated correctly
- [x] Memory timeline UI displays all items in real-time
- [x] Manual pin functionality works end-to-end
- [x] URL synchronization works correctly
- [x] Firestore rules allow user-created pins
- [x] Firestore indexes defined for efficient queries
- [x] Dark mode support in all UI components
- [x] Beautiful card layout with type badges
- [x] Replay links navigate to collab page
- [x] Pin modal has loading states

### ⏳ Pending Deployment
- [ ] Deploy Cloud Function trigger
- [ ] Deploy Firestore rules
- [ ] Deploy Firestore indexes
- [ ] Test in production environment

---

## 📝 Notes and Best Practices

### Session ID Format
Always use `roomId__YYYYMMDD` format for consistency:
```typescript
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const sessionId = `${roomId}__${today}`;
```

### Transaction Pattern
Always use transactions for session upserts to avoid race conditions:
```typescript
await db.runTransaction(async (tx) => {
  const snap = await tx.get(sessionRef);
  if (!snap.exists) {
    tx.set(sessionRef, newData, { merge: true });
  } else {
    tx.set(sessionRef, updateData, { merge: true });
  }
});
```

### Service Account Bypass
Cloud Functions bypass Firestore rules using service account:
```javascript
// This works even though rules restrict writes
await admin.firestore().collection('ops_collab_memory').add({...});
```

### Real-time Listeners
Always unsubscribe from listeners on cleanup:
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
  return () => unsubscribe();
}, [dependencies]);
```

---

## 🚨 Troubleshooting

### Issue: Summaries created but no memory items
**Check**:
1. Is `commitSummaryToMemory` function deployed?
2. Check Cloud Function logs: `firebase functions:log`
3. Verify trigger path matches collection name

### Issue: "Permission denied" when creating pin
**Check**:
1. User is authenticated (`request.auth.uid` exists)
2. `writer` field is set to `'user'`
3. `createdBy.uid` matches `request.auth.uid`

### Issue: Memory timeline shows no items
**Check**:
1. Firestore indexes are deployed and built
2. Filter values match existing data exactly
3. User is authenticated
4. Items exist in Firestore Emulator UI

### Issue: Session not updating counts
**Check**:
1. Transaction is completing without errors
2. `FieldValue.increment()` is being used correctly
3. Check Cloud Function logs for errors

---

## 🎉 What's Next?

### Future Enhancements
1. **Search Functionality**: Add full-text search across memory items
2. **Export Timeline**: Export session timeline as PDF/Markdown
3. **Pin Categories**: Add categories/tags to pins
4. **Session Analytics**: Visualize session activity over time
5. **Collaborative Pins**: Allow team members to react to pins
6. **Smart Suggestions**: AI suggests important moments to pin
7. **Session Sharing**: Share session timeline with external viewers
8. **Memory Search**: Search across all sessions globally

### Integration with F0 Orchestrator
When F0 Orchestrator is deployed:
1. Update `summarizeRoom` to call real orchestrator API
2. Get richer summaries with better topic extraction
3. Enable multi-language support for summaries

---

## ✅ Sign-Off

**Phase 53 Day 6 Status**: ✅ **CLIENT-SIDE COMPLETE**

All client-side functionality is implemented and tested. The system is ready for deployment. Once Cloud Functions and Firestore configuration are deployed, the Memory Timeline system will be fully operational.

**Next Steps**:
1. Deploy Cloud Functions
2. Deploy Firestore rules and indexes
3. Test in production environment
4. Monitor logs for any issues
5. Proceed to Phase 53 Day 7 (if applicable)

---

## 📚 Related Documentation

- [Phase 53 Day 5: AI Summarization](PHASE_53_DAY5_AI_SUMMARIZATION_COMPLETE.md)
- [Phase 53 Day 4: Chat & Presence](PHASE_53_DAY4_CHAT_PRESENCE_COMPLETE.md)
- [Firestore Security Rules Reference](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firestore Triggers Reference](https://firebase.google.com/docs/functions/firestore-events)
- [Next.js App Router](https://nextjs.org/docs/app)

---

**Generated**: November 6, 2025
**Phase**: 53 Day 6
**Status**: Complete ✅
