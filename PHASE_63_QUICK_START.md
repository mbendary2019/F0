# Phase 63: Quick Start Guide ⚡

**المرحلة 63: دليل البدء السريع**

---

## Day 1: Daily Metrics Aggregation (اليوم الأول: تجميع المقاييس اليومية)

### Deploy Functions (نشر الدوال)
```bash
./deploy-phase63-day1.sh
```

Or manually:
```bash
cd functions && pnpm build
firebase deploy --only functions:aggregateDailyMetrics,functions:aggregateDailyMetricsBackfill,functions:seedOpsEvents
firebase deploy --only firestore:rules,firestore:indexes
```

### Seed Test Data (توليد بيانات اختبار)
```bash
firebase functions:shell
> seedOpsEvents({ count: 1000 })
```

### Aggregate Metrics (تجميع المقاييس)
```bash
firebase functions:shell
> aggregateDailyMetricsBackfill({ days: 7 })
```

### Verify Data (التحقق من البيانات)
```bash
firebase firestore:get ops_metrics_daily --limit 1
```

---

## Day 2: Analytics Dashboard UI (اليوم الثاني: واجهة لوحة التحليلات)

### Test Locally (اختبار محلي)
```bash
# Ensure dev server is running
pnpm dev

# Open dashboard
open http://localhost:3000/ar/ops/analytics
open http://localhost:3000/en/ops/analytics
```

### Run Tests (تشغيل الاختبارات)
```bash
pnpm test analytics_day2
```

---

## Day 3: Daily Reports Generation (اليوم الثالث: توليد التقارير اليومية)

### Deploy Functions (نشر الدوال)
```bash
cd functions && pnpm build
firebase deploy --only functions:generateDailyReport,functions:generateDailyReportBackfill
firebase deploy --only firestore:rules
```

### Generate Reports (توليد التقارير)
```bash
firebase functions:shell
> generateDailyReportBackfill({ days: 7 })
```

### View Reports in Dashboard (عرض التقارير في لوحة التحكم)
```bash
# Reports panel appears at bottom of analytics dashboard
open http://localhost:3000/ar/ops/analytics
```

### Verify Cloud Storage (التحقق من Cloud Storage)
```bash
# Check reports in Firebase Console
# Storage → reports/daily/{date}/
```

---

## Files Created (الملفات المُنشأة)

### Day 1
- ✅ `functions/src/analytics/aggregateDailyMetrics.ts` - Enhanced aggregation with p50/p95
- ✅ `functions/src/dev/seedOpsEvents.ts` - Test data generator
- ✅ `firestore.rules` - Updated with ops_metrics_daily permissions
- ✅ `firestore.indexes.json` - Added date field indexes
- ✅ `functions/__tests__/aggregateDailyMetrics.spec.ts` - Unit tests

### Day 2
- ✅ `src/app/api/ops/metrics/route.ts` - Protected API endpoint
- ✅ `src/features/ops/analytics/AnalyticsPage.tsx` - Main dashboard component
- ✅ `src/app/[locale]/ops/analytics/page.tsx` - i18n page route
- ✅ `src/components/analytics/KpiCards.tsx` - KPI cards component
- ✅ `src/components/analytics/MetricsTrend.tsx` - Recharts chart component
- ✅ `src/components/analytics/RangeSelector.tsx` - Range selector component
- ✅ `__tests__/analytics_day2.spec.tsx` - UI component tests

### Day 3
- ✅ `functions/src/reports/generateDailyReport.ts` - PDF & XLSX report generation
- ✅ `src/app/api/ops/reports/route.ts` - Reports API with signed URLs
- ✅ `src/features/ops/analytics/ReportsPanel.tsx` - Reports list UI component
- ✅ `firestore.rules` - Updated with ops_reports rules
- ✅ `functions/package.json` - Added exceljs, pdf-lib dependencies

---

## Common Commands (أوامر شائعة)

### Local Development
```bash
# Start dev server
pnpm dev

# Start Firebase emulators
firebase emulators:start --only functions,firestore

# Run tests
pnpm test

# Build functions
cd functions && pnpm build
```

### Deploy
```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore config
firebase deploy --only firestore:rules,firestore:indexes
```

### Data Management
```bash
# View Firestore data
firebase firestore:get ops_events --limit 10
firebase firestore:get ops_metrics_daily --limit 10
firebase firestore:get ops_reports --limit 10

# View function logs
firebase functions:log --only aggregateDailyMetrics
firebase functions:log --only generateDailyReport
```

---

## Troubleshooting (استكشاف الأخطاء)

### No data in dashboard
**Solution**:
1. Check if ops_metrics_daily has documents
2. Run backfill: `aggregateDailyMetricsBackfill({ days: 7 })`
3. Ensure scheduled function is deployed

### Authentication error
**Solution**:
1. Verify user is signed in
2. Check Firebase auth token in browser DevTools
3. Ensure token verification works in API route

### Chart not rendering
**Solution**:
1. Check browser console for Recharts errors
2. Verify recharts package is installed: `pnpm list recharts`
3. Ensure SSR is disabled via dynamic imports

---

## Quick Links (روابط سريعة)

### Documentation
- [Day 1 Complete (EN)](PHASE_63_DAY1_COMPLETE.md)
- [Day 1 Complete (AR)](PHASE_63_DAY1_COMPLETE_AR.md)
- [Day 2 Complete (EN)](PHASE_63_DAY2_COMPLETE.md)
- [Day 2 Complete (AR)](PHASE_63_DAY2_COMPLETE_AR.md)
- [Day 3 Complete (EN)](PHASE_63_DAY3_COMPLETE.md)
- [Day 3 Complete (AR)](PHASE_63_DAY3_COMPLETE_AR.md)
- [Quick Test Guide](PHASE_63_QUICK_TEST.md)

### Dashboard URLs
- Arabic: http://localhost:3000/ar/ops/analytics
- English: http://localhost:3000/en/ops/analytics

### Firebase Console
- Functions: https://console.firebase.google.com/project/from-zero-84253/functions
- Firestore: https://console.firebase.google.com/project/from-zero-84253/firestore

---

## Next Steps

### Testing
1. ✅ Day 1 functions deployed
2. ✅ Day 2 UI components created
3. ✅ Day 3 report generation implemented
4. 🔄 Test dashboard with real data
5. 🔄 Verify scheduled functions run (02:10, 02:20 Asia/Kuwait)
6. 🔄 Test report downloads (PDF & XLSX)
7. 🔄 Monitor API performance

### Future Enhancements
- Add more KPIs (DAU, sessions, etc.)
- Drill-down into specific event types
- Email notifications for reports
- Weekly/monthly summary reports
- Real-time updates
- Custom date range picker
- Comparison with previous period

---

**Status**: Phase 63 Days 1, 2 & 3 Complete ✅
**Ready for**: Testing and deployment
