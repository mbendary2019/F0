# Phase 62 — Timeline UI Quick Reference 🚀

## 📍 Access Timeline

```bash
# English
http://localhost:3030/ops/timeline

# Arabic
http://localhost:3030/ar/ops/timeline

# With filters (deep link)
http://localhost:3030/ops/timeline?sessionId=sess_abc123&strategy=smart

# Production
https://your-app.com/ops/timeline
```

---

## 🎯 Features Overview

| Feature | Day | Status |
|---------|-----|--------|
| **Timeline API** | Day 1 | ✅ `/api/ops/timeline` |
| **Session API** | Day 1 | ✅ `/api/ops/timeline/[sessionId]` |
| **Filters** | Day 2 | ✅ sessionId, strategy, type, dates |
| **Virtualization** | Day 2 | ✅ react-window |
| **Infinite Scroll** | Day 2 | ✅ Intersection Observer |
| **Session Modal** | Day 2 | ✅ Detailed view |
| **URL Sync** | Day 3 | ✅ Deep linking |
| **Export CSV** | Day 3 | ✅ Spreadsheet format |
| **Export JSON** | Day 3 | ✅ Full data |
| **Stats Strip** | Day 3 | ✅ Overview metrics |
| **Loading States** | Day 3 | ✅ Skeletons |
| **Empty States** | Day 3 | ✅ Friendly messages |
| **Error States** | Day 3 | ✅ Retry support |
| **Keyboard Nav** | Day 3 | ✅ Esc to close |

---

## 🔧 Common Tasks

### **Filter by Session**
```
/ops/timeline?sessionId=sess_abc123
```

### **Filter by Strategy**
```
/ops/timeline?strategy=smart
```

### **Filter by Type**
```
/ops/timeline?type=rag.validate
```

### **Filter by Date Range**
```
/ops/timeline?from=1699999999000&to=1700000999000
```

### **Combine Filters**
```
/ops/timeline?sessionId=sess_abc&strategy=smart&type=rag.validate
```

### **Export Data**
1. Navigate to timeline
2. Click "📊 Export CSV" or "📄 Export JSON"
3. File downloads automatically

### **View Session Details**
1. Click "Open" on any event
2. Or use deep link: `?sessionId=sess_abc123`
3. Press `Esc` to close modal

---

## 🧪 Testing Commands

```bash
# Run Day 3 tests
pnpm test __tests__/timeline_day3.spec.tsx

# Run all timeline tests
pnpm test __tests__/timeline

# Start dev server
pnpm dev

# Open timeline
open http://localhost:3030/ops/timeline
```

---

## 📊 API Endpoints

### **GET /api/ops/timeline**
**Query Parameters**:
- `sessionId` (string): Filter by session
- `strategy` (string): Filter by strategy
- `type` (string): Filter by event type
- `from` (number): Start timestamp (ms)
- `to` (number): End timestamp (ms)
- `limit` (number): Items per page (default: 100)
- `cursor` (string): Pagination cursor

**Response**:
```json
{
  "items": [
    {
      "id": "evt_123",
      "ts": 1699999999,
      "type": "rag.validate",
      "sessionId": "sess_abc",
      "label": "Validation",
      "severity": "info",
      "meta": { "score": 0.85 }
    }
  ],
  "nextCursor": "doc_456"
}
```

### **GET /api/ops/timeline/[sessionId]**
**Response**:
```json
{
  "sessionId": "sess_abc",
  "startedAt": 1699999999,
  "endedAt": 1700000099,
  "durationMs": 100,
  "events": [...],
  "stats": {
    "validations": {
      "count": 5,
      "avgScore": 0.82,
      "passed": 4,
      "failed": 1
    }
  }
}
```

---

## 🎨 Component Reference

### **useTimeline Hook**
```tsx
const { items, loading, error, hasMore, loadMore, filters, setFilters, refresh } = useTimeline();
```

### **useUrlSync Hook**
```tsx
useUrlSync(filters); // Syncs to URL
```

### **useDebounced Hook**
```tsx
const debouncedValue = useDebounced(value, 300); // 300ms delay
```

### **FiltersBar Component**
```tsx
<FiltersBar value={filters} onChange={setFilters} />
```

### **TimelineList Component**
```tsx
<TimelineList
  items={items}
  hasMore={hasMore}
  loadMore={loadMore}
  onOpenSession={setOpenSession}
/>
```

### **SessionModal Component**
```tsx
<SessionModal sessionId={openSession} onClose={handleClose} />
```

### **ExportMenu Component**
```tsx
<ExportMenu items={items} />
```

### **StatsStrip Component**
```tsx
<StatsStrip items={items} />
```

### **EmptyState Component**
```tsx
<EmptyState />
```

### **ErrorState Component**
```tsx
<ErrorState message="Failed to load" onRetry={refresh} />
```

### **SkeletonRow Component**
```tsx
<SkeletonRow />
```

---

## 🐛 Troubleshooting

### **"No events yet"**
✅ **Solution**: Start Firebase emulators and seed data
```bash
firebase emulators:start
```

### **"ECONNREFUSED 127.0.0.1:8080"**
✅ **Solution**: Firestore emulator not running
```bash
firebase emulators:start
```

### **Filters not working**
✅ **Solution**: Check URL parameters are updating (debounced by 300ms)

### **Export not downloading**
✅ **Solution**: Check browser download settings / allow popups

### **Modal won't close with Esc**
✅ **Solution**: Verify Day 3 updates to SessionModal.tsx

### **Page not found**
✅ **Solution**: Dev server running? Check port 3030 (not 3000)
```bash
lsof -ti:3030
```

---

## 📁 File Structure

```
src/
├── hooks/
│   ├── useTimeline.ts         # Timeline data fetching
│   ├── useUrlSync.ts          # URL synchronization
│   └── useDebounced.ts        # Value debouncing
├── utils/
│   ├── csv.ts                 # CSV export
│   └── json.ts                # JSON export
├── components/
│   └── timeline/
│       ├── FiltersBar.tsx     # Filter controls
│       ├── TimelineList.tsx   # Virtualized list
│       ├── TimelineItem.tsx   # Individual event
│       ├── SessionModal.tsx   # Session details
│       ├── SeverityBadge.tsx  # Severity indicator
│       ├── ExportMenu.tsx     # Export buttons
│       ├── StatsStrip.tsx     # Statistics
│       ├── SkeletonRow.tsx    # Loading state
│       ├── EmptyState.tsx     # No results
│       ├── ErrorState.tsx     # Error display
│       └── CopyLink.tsx       # Deep linking
pages/
└── ops/
    └── timeline.tsx           # Main timeline page
__tests__/
├── timeline_ui.spec.tsx       # Day 2 tests
└── timeline_day3.spec.tsx     # Day 3 tests
```

---

## 🎯 Performance Tips

### **Reduce API Calls**
```tsx
// ✅ Good - debounced
const debouncedFilters = useDebounced(filters, 300);

// ❌ Bad - too many calls
setFilters(newFilters); // Fires immediately
```

### **Optimize Rendering**
```tsx
// ✅ Good - virtualized list
<TimelineList items={items} />

// ❌ Bad - renders all items
{items.map(item => <Item key={item.id} item={item} />)}
```

### **Efficient Pagination**
```tsx
// ✅ Good - cursor-based
?cursor=doc_last_id&limit=100

// ❌ Bad - offset-based (slow with large datasets)
?offset=1000&limit=100
```

---

## 📊 Metrics & Stats

### **Stats Strip Calculations**
- **Total Events**: `items.length`
- **Validations**: `items.filter(i => i.type === 'rag.validate').length`
- **Avg Score**: `sum(scores) / count(validations)`
- **By Severity**: `items.filter(i => i.severity === 'error').length`

### **Severity Mapping**
- `score < 0.45` → **error** (red)
- `0.45 ≤ score ≤ 0.55` → **warn** (yellow)
- `score > 0.55` → **info** (green)

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Test with real data (100+ events)
- [ ] Verify all filters work
- [ ] Test export CSV/JSON with large datasets
- [ ] Verify URL deep linking
- [ ] Test keyboard navigation (Esc)
- [ ] Check mobile responsiveness
- [ ] Run all tests: `pnpm test __tests__/timeline`
- [ ] Verify error states display correctly
- [ ] Test with slow network (loading states)
- [ ] Check Firestore indexes deployed

---

## 📚 Related Documentation

- [PHASE_62_DAY1_COMPLETE.md](PHASE_62_DAY1_COMPLETE.md) - APIs & Normalizers
- [PHASE_62_DAY2_COMPLETE.md](PHASE_62_DAY2_COMPLETE.md) - UI Components
- [PHASE_62_DAY3_COMPLETE.md](PHASE_62_DAY3_COMPLETE.md) - UX & Performance

---

**Quick Start**:
```bash
pnpm dev
open http://localhost:3030/ops/timeline
```

**Need Help?** Check [PHASE_62_DAY3_COMPLETE.md](PHASE_62_DAY3_COMPLETE.md) for detailed documentation.
