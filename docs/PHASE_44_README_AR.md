# المرحلة 44 — حزمة الإضافات

**تشمل**: كوتا تجريبية يومية، إضافة VS Code، تكامل Figma، تخصيص ديناميكي للهوية (ألوان/شعار/مسارات/تميمة)، صفحة Marketplace

---

## بدء سريع

```bash
# 1) ضبط متغيرات البيئة
export FIGMA_TOKEN="your-figma-personal-access-token"
export FIGMA_FILE_IDS="معرفات,الملفات,مفصولة,بفواصل"  # اختياري
export BRANDING_ENV="prod"  # أو "staging"

# 2) النشر
chmod +x ./scripts/deploy-phase44.sh
./scripts/deploy-phase44.sh

# 3) إضافة بيانات أولية
firebase firestore:write ops_branding/prod '{"primaryColor":"#7C3AED","accentColor":"#22D3EE"}'

# 4) فتح الصفحات الجديدة
# - /ops/branding (مسؤولون فقط)
# - /ops/marketplace
# - /ops/assets
```

---

## الميزات

### 1. نظام الكوتا اليومية التجريبية

- **الطبقة المجانية**: 500 توكن/يوم لكل مستخدم
- **إعادة ضبط تلقائية**: منتصف الليل بتوقيت الكويت
- **Cloud Function**: `resetDailyQuotas` (مجدولة يوميًا)
- **نقاط API**:
  - `POST /api/billing/consume` - استهلاك التوكنات
  - `GET /api/billing/usage` - التحقق من الكوتا المتبقية

**مثال الاستخدام**:
```ts
const token = await user.getIdToken();
await fetch('/api/billing/consume', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tokens: 100 })
});
```

### 2. تكامل Figma

- **مزامنة تلقائية**: سحب أصول التصميم كل 6 ساعات
- **عند الطلب**: المسؤولون يمكنهم التشغيل عبر `figmaPullOnDemand`
- **التخزين**: الأصول محفوظة في مجموعة `ops_assets`

**الضبط**:
```bash
export FIGMA_TOKEN="figd_..."
export FIGMA_FILE_IDS="fileId1,fileId2"
firebase functions:config:set figma.token="$FIGMA_TOKEN" figma.file_ids="$FIGMA_FILE_IDS"
```

### 3. الهوية الديناميكية

- **قابلة للتخصيص**: الألوان، الشعار، التميمة، مسارات التنقل
- **واجهة المسؤول**: `/ops/branding`
- **التشغيل**: يُسحب عبر `/api/branding`

**نموذج البيانات**:
```json
{
  "primaryColor": "#7C3AED",
  "accentColor": "#22D3EE",
  "logoUrl": "/logo.svg",
  "mascot": { "name": "F0 Spark", "mood": "friendly", "svgUrl": "/mascots/spark.svg" },
  "routes": [
    { "path": "/dashboard", "label": "لوحة التحكم", "visible": true }
  ]
}
```

### 4. سوق الإضافات (Marketplace)

- **تثبيت الإضافات**: تصفح وتثبيت الملحقات
- **حارس السياسات**: جميع التثبيتات تُفحص عبر سياسات المرحلة 39
- **سجل التدقيق**: مُسجل في مجموعة `ops_audit`

### 5. إضافة VS Code

الأوامر:
- `F0: Login to Firebase`
- `F0: Deploy Phase`
- `F0: Open Firebase Dashboard`
- `F0: Tail Cloud Functions Logs`

**التثبيت**:
```bash
cd vscode-extension
npm install
npm run build
code --install-extension ./f0-ops-helper-0.1.0.vsix
```

---

## الأمان

**قواعد Firestore** (المرحلة 44):
- `ops_user_plans`: المستخدمون يقرأون خاصتهم، CF يكتب
- `ops_branding`: قراءة عامة، كتابة للمسؤولين
- `ops_marketplace_items`: قراءة عامة، كتابة للمسؤولين
- `ops_assets`: قراءة عامة، CF يكتب
- `ops_audit`: قراءة للمسؤولين، CF يكتب

---

## المجدولات

| الوظيفة | الجدول | الهدف |
|----------|--------|--------|
| `resetDailyQuotas` | يوميًا 00:00 الكويت | إعادة ضبط كوتا المستخدمين |
| `figmaScheduledPull` | كل 6 ساعات | مزامنة أصول Figma |

---

## حل المشاكل

**الكوتا لا تُعاد الضبط؟**
تحقق من سجلات المُجدول: `firebase functions:log --only resetDailyQuotas`

**Figma لا تُزامن؟**
1. تحقق من ضبط `FIGMA_TOKEN`
2. تحقق من صحة معرفات الملفات
3. تشغيل يدوي: استدعِ `figmaPullOnDemand` من لوحة المسؤول

**تثبيت Marketplace محظور؟**
- تحقق من `ops_audit` لمعرفة سبب حارس السياسات
- تحقق من أن المستخدم لديه الصلاحيات الصحيحة

---

## الخطوات التالية

- **المرحلة 44.1**: خطط مميزة بكوتا أعلى
- **المرحلة 44.2**: مولد تميمة مخصصة
- **المرحلة 44.3**: سوق متقدم مع التقييمات
- **المرحلة 44.4**: مفاتيح API للمطورين للكوتا
