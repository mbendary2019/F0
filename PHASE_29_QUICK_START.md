# Phase 29: Admin Observability - Quick Start

## 🎉 تم الإكمال بنجاح!

### ما تم بناؤه
✅ Admin Dashboard (`/admin/dashboard`)  
✅ Audit Viewer (`/admin/audit`)  
✅ Metrics API (`/api/admin/metrics/summary`)  
✅ CSV Export (`/api/admin/audit/export`)  
✅ Cloud Functions (collectApiMetrics, notifyAdminEvents)  
✅ Firestore Indexes  

---

## 🚀 تشغيل سريع (3 دقائق)

### 1. تشغيل محلي
```bash
npm run dev
```

### 2. افتح المتصفح
```bash
# Dashboard
open http://localhost:3000/admin/dashboard

# Audit Viewer
open http://localhost:3000/admin/audit
```

### 3. اختبار API
```bash
# Get metrics
curl http://localhost:3000/api/admin/metrics/summary

# Get audit logs  
curl "http://localhost:3000/api/admin/metrics/summary?audit=1"

# Export CSV
curl "http://localhost:3000/api/admin/audit/export" > audit.csv
```

---

## 📦 النشر إلى الإنتاج

### A. نشر Next.js
```bash
npm run build
vercel deploy --prod
```

### B. نشر Cloud Functions
```bash
cd functions
npm run build

firebase deploy --only \
  functions:collectApiMetrics,\
  functions:notifyAdminEvents
```

### C. نشر Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### D. إعداد البيئة
```bash
# Required
export NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Optional (Slack alerts)
firebase functions:config:set \
  slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

---

## 🧪 الاختبار

### ✅ Dashboard
1. افتح `/admin/dashboard`
2. يجب أن تظهر:
   - بطاقات المقاييس (Calls, Errors, Latency)
   - رسم بياني للـ 7 أيام
   - System Health
   - Quick Actions

### ✅ Audit Viewer
1. قم بعمل admin action:
   ```bash
   curl -X POST http://localhost:3000/api/admin/users/test-uid/grant \
     -H "Content-Type: application/json" \
     -d '{"role":"moderator"}'
   ```

2. افتح `/admin/audit`
3. يجب أن تظهر:
   - السجل الجديد
   - الفلاتر تعمل
   - زر Export CSV

### ✅ Slack Alerts
1. إعداد webhook:
   ```bash
   firebase functions:config:set slack.webhook_url="YOUR_URL"
   ```

2. قم بعمل grant/revoke action
3. تحقق من Slack channel

---

## 📊 الملفات الجديدة

```
src/
├── app/admin/
│   ├── dashboard/page.tsx        ← Dashboard
│   └── audit/page.tsx            ← Audit Viewer
├── components/admin/
│   ├── AdminStatCard.tsx         ← Stat cards
│   ├── AdminAreaChart.tsx        ← Charts
│   └── AuditTable.tsx            ← Audit table
├── lib/admin/
│   ├── observability.ts          ← Metrics & queries
│   └── csv.ts                    ← CSV export
└── app/api/admin/
    ├── metrics/summary/route.ts  ← Metrics API
    └── audit/export/route.ts     ← Export API

functions/src/metrics/
├── collectApiMetrics.ts          ← Collect metrics
└── notifyAdminEvents.ts          ← Slack alerts

firestore.indexes.json            ← Updated (admin_audit)
docs/ADMIN_OBSERVABILITY.md       ← Full documentation
```

---

## 🎯 المزايا

### Dashboard
- API Calls (24h)
- Errors (24h)  
- p95 Latency
- 7-day timeseries
- System health

### Audit Viewer
- Filter by action
- Filter by actor
- Date range filtering
- CSV export
- Real-time updates

### Automation
- Metrics collection (every 5 min)
- Slack alerts (grant/revoke)
- Daily aggregation

---

## 🔒 الأمان

- ✅ `assertAdminReq()` على جميع المسارات
- ✅ Rate limiting (60 req/min)
- ✅ CSRF protection
- ✅ Session verification
- ✅ Admin role check

---

## 📞 مشاكل شائعة

### Dashboard فارغ؟
```bash
# سبب: لا توجد بيانات بعد
# حل: قم بعمل admin actions أو انتظر collectApiMetrics
```

### Slack alerts لا تعمل؟
```bash
# تحقق من:
1. SLACK_WEBHOOK_URL configured
2. Webhook URL valid
3. Function logs: firebase functions:log
```

### CSV Export فارغ؟
```bash
# سبب: لا توجد audit entries
# حل: قم بعمل grant/revoke action
```

---

## 📚 الوثائق الكاملة

- `docs/ADMIN_OBSERVABILITY.md` - دليل شامل
- `PHASE_29_OBSERVABILITY_SUMMARY.md` - الملخص الكامل

---

## ✅ Checklist

- [x] TypeScript: 0 errors
- [x] All files created
- [x] Dashboard works
- [x] Audit viewer works
- [x] API endpoints work
- [x] Cloud functions ready
- [x] Firestore indexes updated
- [x] Documentation complete

---

**🎉 جاهز للاستخدام!**

```bash
npm run dev
open http://localhost:3000/admin/dashboard
```

---

**Phase 29 Complete** ✅  
**Date**: 2025-10-10  
**Status**: Production Ready

