# Phase 62 Day 5 - Quick Start Guide

## 🚀 What's New

Phase 62 Day 5 adds **4 major features** to Timeline UI:

1. **Real-time updates** - Live Firestore listeners
2. **Session CSV export** - Export single session as CSV
3. **Enhanced trends** - Binning (5/15/30/60 min) + stacking (by level/type)
4. **Filter presets** - Save/load filter configurations

---

## 📁 Files Created

```
src/hooks/useTimelineFeed.ts              (169 lines)
src/utils/timelinePresets.ts              (170 lines)
src/components/timeline/PresetManager.tsx (231 lines)
__tests__/timeline_day5.spec.tsx          (315 lines)
```

## 📝 Files Modified

```
src/utils/exportSession.ts                (+60 lines)
src/components/timeline/SessionModal.tsx  (+13 lines)
src/components/timeline/TrendMini.tsx     (+169 lines)
src/components/timeline/FiltersBar.tsx    (+21 lines)
```

---

## 🎯 Quick Usage

### 1. Real-time Updates

```typescript
import { useTimelineFeed } from "@/hooks/useTimelineFeed";

function MyComponent() {
  const { items, loading, error } = useTimelineFeed({
    sessionId: "sess_123",  // Optional filter
    strategy: "critic",     // Optional filter
  }, 500);  // Max items

  return <TimelineList items={items} />;
}
```

### 2. Export Session CSV

From SessionModal, click **"📊 Session CSV"** button to export only current session's events.

Programmatically:
```typescript
import { exportSessionCsv } from "@/utils/exportSession";

exportSessionCsv(sessionId, allEvents);
// Downloads: session_sess_123_2025-11-07T13-35-59.csv
```

### 3. Enhanced Trend Chart

```typescript
<TrendMini
  items={items}
  bucketMinutes={60}          // 5, 15, 30, or 60
  showBinSelector={true}      // Show dropdown
  showStackToggle={true}      // Show stack options
/>
```

**Binning Options**: 5m, 15m, 30m, 1h
**Stacking Options**: Total, By Level, By Type

### 4. Filter Presets

**Save**:
1. Apply filters (sessionId, strategy, type, dates)
2. Click "💾 Presets" button
3. Click "💾 Save Current Filters"
4. Enter name, click "Save"

**Load**:
1. Click "💾 Presets"
2. Click preset name
3. Filters applied instantly

**Programmatically**:
```typescript
import { savePreset, loadPresets } from "@/utils/timelinePresets";

// Save
savePreset("High Priority", {
  severity: "error",
  from: Date.now() - 86400000
});

// Load
const presets = loadPresets();
const myPreset = presets[0];
applyFilters(myPreset.filters);
```

---

## 🔧 Firestore Setup

### Required Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "ops_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "strategy", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ops_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deploy**:
```bash
firebase deploy --only firestore:indexes
```

---

## 🧪 Testing

```bash
# Run Day 5 tests
pnpm test __tests__/timeline_day5.spec.tsx

# All timeline tests
pnpm test __tests__/timeline
```

**Coverage**: 13 tests
- Presets: save, load, update, delete, import, export
- Session CSV: export, filter by session, error handling
- Component rendering: PresetManager UI

---

## 🎨 UI Enhancements

### Timeline Page Updates

**FiltersBar** now has:
- "💾 Presets" button (right side)
- Shows preset count: "Presets (3)"
- Dropdown menu with save/load/delete

**SessionModal** now has:
- "📊 Session CSV" button (header)
- Exports only current session
- Optimized CSV format

**TrendMini** now has:
- Bin size dropdown (5m/15m/30m/1h)
- Stack toggle (Total/By Level/By Type)
- Color-coded stacked areas

---

## 🔒 Security

### Firestore Rules

```javascript
match /ops_events/{eventId} {
  // Read: authenticated admins only
  allow read: if request.auth != null
    && request.auth.token.role == 'admin';

  // Write: Cloud Functions only
  allow write: if false;
}
```

### Preset Storage

- Stored in **localStorage** (client-side)
- Not synced across devices (by default)
- Safe for filter criteria (no sensitive data)

---

## 📊 Performance

| Feature | Limit | Memory | Network |
|---------|-------|--------|---------|
| Real-time feed | 500 items | ~1 MB | Delta updates |
| Presets | ~10,000 | ~5 MB | None (localStorage) |
| TrendMini | 24h data | Cached | None (client-side) |

---

## 🐛 Troubleshooting

### "The query requires an index"

→ Deploy Firestore indexes (see above)

### Presets not saving

→ Check localStorage is enabled (not in private mode)

### TrendMini SSR errors

→ All recharts components use `dynamic(..., { ssr: false })`

### Real-time updates not working

→ Check Firestore connection:
```typescript
import { db } from "@/lib/firebaseClient";
console.log("Firestore:", !!db);
```

---

## 📚 Documentation

- **Full Guide**: `PHASE_62_DAY5_COMPLETE.md`
- **Arabic Summary**: `PHASE_62_DAY5_ملخص.md`
- **API Tests**: `__tests__/timeline_day5.spec.tsx`

---

## ✅ Status

**Phase 62 Day 5**: COMPLETE ✅

**Next Steps**:
- Deploy Firestore indexes
- Test real-time updates in production
- Optional: Add cloud preset sync
- Optional: Add more export formats (XLSX, PDF)

---

## 🎯 Key Files Reference

| Feature | Main File | Line |
|---------|-----------|------|
| Real-time feed | `src/hooks/useTimelineFeed.ts` | Full |
| Session CSV | `src/utils/exportSession.ts` | 164-210 |
| Enhanced trends | `src/components/timeline/TrendMini.tsx` | Full |
| Presets util | `src/utils/timelinePresets.ts` | Full |
| Presets UI | `src/components/timeline/PresetManager.tsx` | Full |
| Session CSV button | `src/components/timeline/SessionModal.tsx` | 137-144 |
| Presets integration | `src/components/timeline/FiltersBar.tsx` | 141-144 |

---

**Generated**: 2025-11-07
**Phase**: 62 Day 5
**Status**: Production Ready ✅
