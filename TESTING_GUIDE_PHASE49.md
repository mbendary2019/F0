# Phase 49 - Testing & Verification Guide

**Quick Reference for Testing Core Features**

---

## 🚀 Quick Start Commands

### 1. Environment Setup
```bash
# Copy and configure environment
cp .env.local.example .env.local
# Edit .env.local with your Firebase project details

# Install all dependencies
npm install
cd functions && npm install && cd ..
```

### 2. Start Emulators
```bash
# Start all required emulators
firebase emulators:start --only firestore,auth,functions,storage,ui

# Expected output:
# ✔ functions: http://127.0.0.1:5001
# ✔ firestore: http://127.0.0.1:8080
# ✔ auth: http://127.0.0.1:9099
# ✔ storage: http://127.0.0.1:9199
# ✔ ui: http://127.0.0.1:4000
```

### 3. Verify Emulators (New Terminal)
```bash
# Run verification script
chmod +x scripts/verify-emulators.sh
./scripts/verify-emulators.sh

# Should see all green checkmarks ✅
```

### 4. Start Development Server (New Terminal)
```bash
npm run dev

# Access at: http://localhost:3000
```

---

## 🧪 Feature Testing

### Test 1: Firebase Client Initialization

**Objective:** Verify client Firebase is properly initialized without duplicates

**Steps:**
1. Open browser to http://localhost:3000
2. Open browser console (F12)
3. Run these commands:

```javascript
// Check if Firebase is initialized
import { db, auth, functions } from '@/lib/firebaseClient';
console.log('Firestore:', db);
console.log('Auth:', auth);
console.log('Functions:', functions);

// Should see Firebase instances without errors
// Should NOT see any "app already initialized" errors
```

**Expected Result:**
- ✅ All Firebase services initialized
- ✅ No duplicate app errors
- ✅ Connected to emulators (check console logs)

---

### Test 2: Create Test Incident

**Objective:** Create a test incident in Firestore for CSV export testing

**Steps:**

1. Visit Emulator UI: http://127.0.0.1:4000
2. Navigate to Firestore tab
3. Click "Start collection"
4. Collection ID: `ops_incidents`
5. Document ID: (Auto-ID)
6. Add fields:

```json
{
  "source": "manual",
  "level": "error",
  "message": "Test incident for Phase 49 CSV export",
  "stack": "Error: Test error\n  at TestComponent:42",
  "context": {
    "test": true,
    "userId": "test-user-123",
    "timestamp": "2025-11-05T10:00:00Z"
  },
  "status": "open",
  "createdAt": "November 5, 2025 at 10:00:00 AM UTC+3",
  "updatedAt": "November 5, 2025 at 10:00:00 AM UTC+3"
}
```

7. Click Save

**Expected Result:**
- ✅ Incident created successfully
- ✅ Document visible in Firestore UI
- ✅ All fields properly saved

---

### Test 3: CSV Export (HTTP Endpoint)

**Objective:** Test CSV export via HTTP endpoint

**Steps:**

```bash
# Export all incidents (limit 10)
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=10" \
  -o incidents.csv

# View the CSV
cat incidents.csv

# Or open in Excel/Numbers
open incidents.csv  # macOS
```

**Test with Filters:**

```bash
# Export only errors
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?level=error&limit=10" \
  -o errors.csv

# Export by date range
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?dateFrom=2025-11-01&dateTo=2025-11-05" \
  -o date_range.csv

# Export open incidents only
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?status=open" \
  -o open_incidents.csv
```

**Expected Result:**
- ✅ CSV file downloaded
- ✅ Contains headers: ID, Created At, Updated At, Source, Level, Status, Message, Stack Trace, Context
- ✅ Contains incident data
- ✅ Filters work correctly
- ✅ Special characters (commas, quotes) properly escaped

---

### Test 4: CSV Export (Callable Function)

**Objective:** Test CSV export via Firebase callable function

**Steps:**

1. Create a test page/component:

```typescript
// pages/test-csv.tsx or app/test-csv/page.tsx
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseClient';

export default function TestCSV() {
  const handleExport = async () => {
    const exportCsv = httpsCallable(functions, 'exportIncidentsCsvCallable');

    try {
      const result = await exportCsv({
        dateFrom: '2025-11-01',
        dateTo: '2025-11-05',
        level: 'error',
        status: 'open',
        limit: 100
      });

      console.log('Export result:', result.data);

      // Download CSV
      const blob = new Blob([result.data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'incidents.csv';
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <button onClick={handleExport}>
      Export Incidents CSV
    </button>
  );
}
```

2. Visit the test page
3. Click the export button
4. Check console and downloaded file

**Expected Result:**
- ✅ Function called successfully
- ✅ CSV data returned
- ✅ File downloaded
- ✅ Contains correct data

---

### Test 5: Create Test Events for Metrics

**Objective:** Create test events to verify metrics aggregation

**Steps:**

1. Visit Emulator UI: http://127.0.0.1:4000/firestore
2. Create collection `ops_events`
3. Add multiple test events:

```json
// Event 1 - API Request
{
  "type": "api",
  "ts": "November 5, 2025 at 10:00:00 AM UTC+3",
  "uid": "test-user-1",
  "orgId": "test-org-1",
  "n": 1
}

// Event 2 - Token Usage
{
  "type": "tokens",
  "ts": "November 5, 2025 at 10:05:00 AM UTC+3",
  "uid": "test-user-1",
  "n": 1500
}

// Event 3 - Another API Request
{
  "type": "api",
  "ts": "November 5, 2025 at 10:10:00 AM UTC+3",
  "uid": "test-user-2",
  "orgId": "test-org-1",
  "n": 1
}

// Add TTL field (optional)
{
  "type": "api",
  "ts": "November 5, 2025 at 10:00:00 AM UTC+3",
  "uid": "test-user-1",
  "expire": "December 5, 2025 at 10:00:00 AM UTC+3"
}
```

**Expected Result:**
- ✅ Events created successfully
- ✅ Visible in Firestore UI
- ✅ TTL field set correctly

---

### Test 6: Manual Metrics Aggregation

**Objective:** Manually trigger metrics aggregation and verify results

**Steps:**

```bash
# Trigger aggregation for today
firebase functions:call aggregateDailyMetrics_manual --data='{"date":"2025-11-05"}'

# Expected response:
# {
#   "success": true,
#   "date": "2025-11-05",
#   "totalEvents": 3,
#   "eventTypes": 2
# }
```

**Verify Results:**

1. Visit Emulator UI: http://127.0.0.1:4000/firestore
2. Navigate to `ops_metrics_daily` collection
3. Find document with ID `2025-11-05`
4. Verify fields:
   - `date`: "2025-11-05"
   - `totalEvents`: (number)
   - `counts`: { "api": X, "tokens": Y }
   - `dau`: (unique user count)
   - `aggregatedAt`: (timestamp)

**Expected Result:**
- ✅ Function executed successfully
- ✅ Metrics document created
- ✅ Correct counts calculated
- ✅ DAU tracked properly

---

### Test 7: Function Logs

**Objective:** Verify function logs are working and helpful

**Steps:**

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only exportIncidentsCsv

# View logs in real-time
firebase functions:log --follow
```

**Expected Result:**
- ✅ Logs appear in terminal
- ✅ Logs contain useful information
- ✅ Timestamps are correct
- ✅ Error logs are clear

---

### Test 8: Emulator UI Navigation

**Objective:** Familiarize with Emulator UI features

**Access Points:**
- **Main UI:** http://127.0.0.1:4000
- **Firestore:** http://127.0.0.1:4000/firestore
- **Auth:** http://127.0.0.1:4000/auth
- **Functions:** http://127.0.0.1:4000/functions
- **Logs:** http://127.0.0.1:4000/logs

**Key Features to Test:**
1. **Firestore Tab:**
   - ✅ View collections
   - ✅ Create documents
   - ✅ Edit documents
   - ✅ Delete documents
   - ✅ Query data

2. **Auth Tab:**
   - ✅ View users
   - ✅ Create test users
   - ✅ View user tokens
   - ✅ Delete users

3. **Functions Tab:**
   - ✅ View deployed functions
   - ✅ See function details
   - ✅ View execution history

4. **Logs Tab:**
   - ✅ View all logs
   - ✅ Filter by severity
   - ✅ Search logs

---

## 🐛 Troubleshooting Tests

### Issue: "Port already in use"

**Solution:**
```bash
# Kill existing processes
pkill -9 -f "firebase"
pkill -9 -f "java"
sleep 2

# Restart emulators
firebase emulators:start --only firestore,auth,functions,storage,ui
```

### Issue: "Function not found"

**Solution:**
```bash
# Rebuild functions
cd functions
npm run build
cd ..

# Check deployed functions
firebase functions:list

# Restart emulators
```

### Issue: "Cannot connect to emulator"

**Solution:**
```bash
# Check if emulators are running
lsof -i :4000  # Emulator UI
lsof -i :5001  # Functions
lsof -i :8080  # Firestore
lsof -i :9099  # Auth

# Verify .env.local has correct setting
grep EMULATORS .env.local
# Should show: NEXT_PUBLIC_USE_EMULATORS=1
```

### Issue: "CSV export returns 404"

**Solution:**
```bash
# Verify correct URL format
# Should be: http://127.0.0.1:5001/{project-id}/{region}/{function-name}

# Check project ID in .env.local
grep PROJECT_ID .env.local

# Example correct URL:
# http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv
```

### Issue: "No data in CSV"

**Solution:**
```bash
# Create test incidents first (see Test 2)
# Then try export again

# Or check if filters are too restrictive
curl "http://127.0.0.1:5001/from-zero-84253/us-central1/exportIncidentsCsv?limit=1000"
```

---

## ✅ Test Completion Checklist

After running all tests, verify:

- [ ] Firebase client initializes without errors
- [ ] Firebase admin initializes without errors
- [ ] No duplicate initialization warnings
- [ ] Emulators all running (verified by script)
- [ ] Can create incidents in Firestore
- [ ] CSV export HTTP endpoint works
- [ ] CSV export callable function works
- [ ] CSV filters work correctly
- [ ] Can create events in ops_events
- [ ] Manual metrics aggregation works
- [ ] Metrics calculated correctly
- [ ] Function logs are readable
- [ ] Emulator UI accessible and functional

---

## 📊 Performance Benchmarks

Expected performance metrics:

| Operation | Expected Time | Acceptable Range |
|-----------|--------------|------------------|
| CSV Export (100 incidents) | < 1s | 0.5-2s |
| CSV Export (1000 incidents) | < 3s | 2-5s |
| Metrics Aggregation (1000 events) | < 2s | 1-4s |
| Firestore Write (single doc) | < 50ms | 10-100ms |
| Function Cold Start | < 2s | 1-3s |
| Function Warm Request | < 100ms | 50-200ms |

---

## 🔄 Continuous Testing

### Daily Testing Routine

```bash
# Morning setup
firebase emulators:start --only firestore,auth,functions,storage,ui
./scripts/verify-emulators.sh
npm run dev

# Test core features
# - Create test incident
# - Export CSV
# - Run metrics aggregation
# - Check logs

# Shutdown
# Ctrl+C in emulator terminal
# Ctrl+C in dev server terminal
```

### Before Committing Code

```bash
# Run tests
npm test

# Check TypeScript
npm run type-check

# Lint code
npm run lint

# Build functions
cd functions && npm run build && cd ..

# Verify no errors
```

---

## 📝 Test Results Template

Use this template to document test results:

```markdown
# Test Results - [Date]

## Environment
- Node version:
- Firebase CLI version:
- Browser:

## Tests Run
- [ ] Firebase Client Init
- [ ] Firebase Admin Init
- [ ] Emulator Connectivity
- [ ] Create Incident
- [ ] CSV Export HTTP
- [ ] CSV Export Callable
- [ ] Create Events
- [ ] Metrics Aggregation

## Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:

## Performance Notes
- CSV Export (100 incidents): [time]
- Metrics Aggregation: [time]

## Screenshots
- [Attach relevant screenshots]

## Next Steps
- [Action items]
```

---

**Last Updated:** 2025-11-05
**Maintained By:** Phase 49 Implementation Team
