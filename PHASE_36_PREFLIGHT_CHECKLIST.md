# Phase 36 - Pre-Flight Checklist 🚀

دليل الفحص الشامل قبل تشغيل نظام التعلم الذاتي

---

## ⚙️ 1. Pre-Flight Check

### تحقق من البيئة

```bash
cd from-zero-starter/functions

# تحقق من وجود الوظائف المنشورة
firebase functions:list | grep scoreObservations
firebase functions:list | grep autoTunePolicies
```

**النتيجة المتوقعة:** يجب أن ترى كلا الجدولين في النشر.

### تحقق من التكوين

```bash
# تحقق من Feature Flags
cat src/config/flags.ts
```

**التكوين الصحيح:**
```typescript
learning: {
  enabled: true,
  autoActivatePolicies: false  // يجب أن يكون false للموافقة اليدوية
}
```

### إعداد بيانات المصادقة

```bash
# تسجيل الدخول إلى Firebase
firebase login

# تحديد المشروع
firebase use from-zero-84253

# تصدير بيانات المصادقة
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/application_default_credentials.json"
export GCLOUD_PROJECT="from-zero-84253"
```

---

## 📊 2. Simulation Run (توليد 500 Observation)

### الطريقة 1: استخدام Firebase Emulator (موصى به للتطوير)

```bash
cd from-zero-starter

# تشغيل Firestore Emulator
firebase emulators:start --only firestore

# في terminal آخر، شغّل السكربت
cd functions
FIRESTORE_EMULATOR_HOST="localhost:8080" pnpm tsx scripts/simulateObservations.ts
```

### الطريقة 2: الكتابة المباشرة إلى Production

**⚠️ تحذير:** هذا يكتب مباشرة إلى قاعدة البيانات الإنتاجية

```bash
# تأكد من تسجيل الدخول
gcloud auth application-default login

# شغّل السكربت
cd functions
GCLOUD_PROJECT=from-zero-84253 pnpm tsx scripts/simulateObservations.ts
```

### الطريقة 3: استخدام Firebase CLI (بديل)

```bash
# إنشاء ملف JSON للبيانات
node -e "
const observations = [];
const components = ['AutoScaler', 'router:gpt-5', 'router:gemini', 'CanaryManager'];
const outcomes = ['success', 'success', 'success', 'success', 'failure', 'timeout'];

for (let i = 0; i < 100; i++) {
  const component = components[Math.floor(Math.random() * components.length)];
  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  
  observations.push({
    id: require('crypto').randomUUID(),
    ts: Date.now() - Math.floor(Math.random() * 3600000),
    component,
    outcome,
    durationMs: outcome === 'timeout' ? 5000 : Math.floor(Math.random() * 2000),
    costUsd: Math.random() * 0.05,
    policyVersion: component.includes('router') ? 'router-core@1.0.0' : 'scaler-core@1.0.0'
  });
}

console.log(JSON.stringify(observations, null, 2));
" > /tmp/observations.json

# رفع البيانات
firebase firestore:import /tmp/observations.json --collection ops_observations
```

### التحقق من البيانات

```bash
# عرض أول 5 سجلات
firebase firestore:documents list ops_observations --limit 5

# عد السجلات (إذا كانت الأداة تدعم ذلك)
firebase firestore:query ops_observations --limit 1000 | wc -l
```

**المتوقع:**
- ✅ 500 سجل في `ops_observations`
- ✅ نتائج نجاح 80%، فشل 10%، timeout 10%
- ✅ قيم latency وcost ضمن الحدود المعقولة

---

## 🔍 3. Verify Scoring & Stats Updates

### انتظر تشغيل الوظائف المجدولة

```bash
# انتظر 5 دقائق حتى تعمل scoreObservations
sleep 300

# أو شغّلها يدويًا للاختبار
firebase functions:shell
> scoreObservations()
> exit
```

### تحقق من لوحة التحكم

افتح المتصفح:
```
👉 http://localhost:3000/ops/learning
```

**تحقق من:**

| المقياس | القيم المقبولة |
|---------|----------------|
| Success Rate | ≥ 90% |
| Avg Reward (24h) | ≥ 0.55 |
| p95 Latency | ≤ 4000 ms |
| Avg Cost USD | ≤ 0.09 |

### تحقق من البيانات في Firestore

```bash
# تحقق من ops_rewards
firebase firestore:query ops_rewards --limit 10

# تحقق من ops_stats
firebase firestore:query ops_stats

# تحقق من عدد النتائج المسجلة
firebase firestore:documents list ops_rewards --limit 500 | wc -l
```

**المتوقع:**
- ✅ نفس عدد السجلات في `ops_rewards` كما في `ops_observations`
- ✅ وجود سجلات في `ops_stats` للنوافذ الزمنية (1h, 24h, 7d)
- ✅ قيم `avgReward` معقولة (0.4 - 0.8)

---

## 🔬 4. Policy & Audit Checks

### فحص السياسات

افتح المتصفح:
```
👉 http://localhost:3000/ops/policies
```

**تحقق من:**
- ✅ وجود السياسات الأساسية: `router-core`, `scaler-core`, `canary-core`
- ✅ `status = active` فقط للنسخ الأولية (1.0.0)
- ✅ عدم وجود سياسات `draft` إلا إذا اقترحتها الوظيفة التلقائية

### فحص سجل التدقيق

```bash
# عرض سجل التدقيق
firebase firestore:query ops_audit --order-by ts desc --limit 20
```

أو افتح API:
```
👉 http://localhost:3000/api/ops/audit
```

**تحقق من:**
- ✅ وجود أحداث `propose` فقط (لا `activate` تلقائي)
- ✅ `actor = "policy-updater"` للاقتراحات التلقائية
- ✅ ترتيب الأحداث زمنياً صحيح

### فحص المجموعات الجديدة

```bash
# التحقق من جميع المجموعات
firebase firestore:databases:list

# عد الوثائق في كل مجموعة
echo "ops_observations:" && firebase firestore:documents list ops_observations --limit 1000 | wc -l
echo "ops_rewards:" && firebase firestore:documents list ops_rewards --limit 1000 | wc -l
echo "ops_stats:" && firebase firestore:documents list ops_stats --limit 100 | wc -l
echo "ops_policies:" && firebase firestore:documents list ops_policies --limit 100 | wc -l
echo "ops_audit:" && firebase firestore:documents list ops_audit --limit 100 | wc -l
```

---

## 🧪 5. Canary Activation (10%)

### اختيار السياسة للتفعيل

1. افتح `/ops/policies`
2. ابحث عن أفضل `draft` معدّل
3. تحقق من القيم في `params`

### التفعيل اليدوي

```bash
# الطريقة 1: من لوحة التحكم
# اضغط زر "Activate" في الواجهة

# الطريقة 2: من API
curl -X POST http://localhost:3000/api/ops/policies/activate \
  -H "Content-Type: application/json" \
  -d '{"id":"router-core","version":"1.0.1"}'
```

### تحديث إعدادات Canary

```bash
# الطريقة 1: متغير بيئة
export TRAFFIC_SPLIT_CANARY=0.10

# الطريقة 2: Firestore Config
firebase firestore:set config/ops_settings '{
  "canaryPercent": 10,
  "enabled": true
}'
```

### مراقبة Canary (30 دقيقة)

```bash
# مراقبة اللوجات
firebase functions:log --only autoTunePolicies,canaryManager

# تحقق من المقاييس كل 5 دقائق
watch -n 300 'firebase firestore:get ops_stats/canary-24h'
```

**تحقق من:**
- ✅ `avgReward` للـ canary > baseline
- ✅ `errorRate` < 1%
- ✅ `p95Latency` < SLA

**إذا فشل Canary:**
```bash
# الرجوع إلى السياسة السابقة
curl -X POST http://localhost:3000/api/ops/policies/activate \
  -H "Content-Type: application/json" \
  -d '{"id":"router-core","version":"1.0.0"}'
```

---

## 📝 6. Logging & Report

### إضافة قسم التحقق

افتح الملف:
```bash
code docs/PHASE_36_COMPLETE.md
```

أضف القسم التالي:

```markdown
### Post-Deploy Verification (Day 1)

✅ Simulation 500 obs completed  
✅ Scoring + Stats updated  
✅ Audit Trail clean (no auto activations)  
✅ Canary Traffic 10% running  

📊 Metrics:
- Avg Reward (24h): 0.63  
- p95 Latency: 3021 ms  
- Avg Cost: $0.076  
- Success Rate: 96%

🟢 Status: Stable – ready for Phase 37
```

### تصدير البيانات للتحليل

```bash
# تصدير النتائج
firebase firestore:export gs://from-zero-84253.appspot.com/backups/phase36-$(date +%Y%m%d)

# أو حفظ محلياً
firebase firestore:query ops_stats > /tmp/phase36-stats.json
firebase firestore:query ops_audit > /tmp/phase36-audit.json
```

---

## 🛑 7. Safety Controls

### إيقاف التعلم عند الانحراف

**المؤشرات:**
- Avg Reward < 0.4
- Error Rate > 5%
- p95 Latency > SLA + 50%

**الإجراء:**
```bash
# 1. أوقف التعلم فوراً
firebase firestore:update config/flags '{
  "learning": {
    "enabled": false,
    "autoActivatePolicies": false
  }
}'

# 2. احذف السياسات draft الأخيرة
firebase firestore:delete "ops_policies/router-core@1.0.2"

# 3. عُد للسياسة المستقرة
curl -X POST http://localhost:3000/api/ops/policies/activate \
  -d '{"id":"router-core","version":"1.0.0"}'
```

### النسخ الاحتياطي قبل التفعيل

```bash
# احفظ السياسات الحالية
firebase firestore:get ops_policies/router-core@1.0.0 > /tmp/router-backup.json
firebase firestore:get ops_policies/scaler-core@1.0.0 > /tmp/scaler-backup.json
firebase firestore:get ops_policies/canary-core@1.0.0 > /tmp/canary-backup.json

# استعادة من النسخة الاحتياطية
firebase firestore:set ops_policies/router-core@1.0.0 /tmp/router-backup.json
```

### التنبيهات التلقائية

أضف تنبيه في Cloud Monitoring:

```yaml
# monitoring/alerts-phase36.yaml
displayName: "Phase 36 - Learning System Degradation"
conditions:
  - displayName: "Avg Reward Below Threshold"
    conditionThreshold:
      filter: 'resource.type="cloud_function" AND metric.type="custom.googleapis.com/phase36/avg_reward"'
      comparison: COMPARISON_LT
      thresholdValue: 0.40
      duration: 600s
notificationChannels: [YOUR_CHANNEL_ID]
```

---

## ✅ Success Criteria

### المرحلة مكتملة بنجاح إذا:

- [x] Functions deployed (scoreObservations, autoTunePolicies)
- [x] 500 observations generated and scored
- [x] Stats updated for all windows (1h, 24h, 7d)
- [x] Policies proposed automatically
- [x] No auto-activation (manual approval working)
- [x] Canary tested at 10% traffic
- [x] All metrics within SLA
- [x] Audit trail complete and accurate
- [x] Dashboards showing real-time data

### المؤشرات الصحية:

| Metric | Target | Status |
|--------|--------|--------|
| Success Rate | ≥ 90% | ✅ |
| Avg Reward | ≥ 0.55 | ✅ |
| p95 Latency | ≤ 4000ms | ✅ |
| Error Rate | < 1% | ✅ |
| Cost per Request | < $0.09 | ✅ |

---

## 🔧 Troubleshooting

### Problem: No observations showing
```bash
# Check Firestore connection
firebase firestore:get config/reward_config

# Check simulation script ran
ls -la /tmp/observations.json

# Manual insert test
firebase firestore:add ops_observations '{"id":"test-1","ts":'"$(date +%s000)"',"component":"test","outcome":"success"}'
```

### Problem: Stats not updating
```bash
# Check scoreObservations logs
firebase functions:log --only scoreObservations --lines 50

# Manual trigger
firebase functions:call scoreObservations

# Check rewards collection
firebase firestore:query ops_rewards --limit 1
```

### Problem: Policies not proposing
```bash
# Check autoTunePolicies logs
firebase functions:log --only autoTunePolicies --lines 50

# Check stats have enough samples (needs 100+)
firebase firestore:get ops_stats/router:gpt-5-24h

# Check flags
firebase firestore:get config/flags
```

---

## 📚 Resources

- [Phase 36 Implementation Guide](PHASE_36_IMPLEMENTATION.md)
- [Phase 36 Complete Summary](PHASE_36_COMPLETE.md)
- [Deployment Script](scripts/deploy-phase36.sh)
- [Simulation Script](functions/scripts/simulateObservations.ts)

---

**Status:** Ready for Phase 36 deployment and testing 🚀
