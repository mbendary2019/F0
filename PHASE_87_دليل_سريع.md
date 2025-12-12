# Phase 87: دليل الاستخدام السريع 🚀

## ✅ ما تم إنجازه

تم دمج VS Code Extension مع Phase 86 Cloud Functions بنجاح! الآن يمكن للـ IDE والـ Dashboard التواصل بشكل ثنائي الاتجاه.

## 📁 الملفات التي تم إنشاؤها

1. **src/types/ideBridge.ts** - Type definitions مشتركة
2. **src/services/apiClient.ts** - HTTP client للـ Cloud Functions
3. **src/bridge/eventSender.ts** - مراقب التغييرات وإرسال الأحداث
4. **src/bridge/commandPoller.ts** - استقبال الأوامر كل 3 ثواني

## 🎯 كيف تستخدم الـ Extension؟

### 1. بناء الـ Extension
```bash
cd ide/vscode-f0-bridge
npm run build
```

### 2. تشغيل الـ Extension في VS Code
- اضغط F5 في VS Code لفتح Extension Development Host
- أو استخدم `vsce package` لإنشاء ملف `.vsix` وتثبيته

### 3. ربط المشروع
- افتح Command Palette (Cmd+Shift+P)
- اكتب `F0: Link Project`
- أدخل الـ project ID من الـ Dashboard

### 4. تشغيل الـ Bridge
- افتح Command Palette
- اكتب `F0: Start Live Bridge`
- الآن الـ Extension يرسل الأحداث ويستقبل الأوامر!

## 📊 تدفق البيانات

### من IDE → Cloud → Dashboard
```
ملف يفتح في VS Code
  ↓
Event Sender يرسل FILE_SNAPSHOT
  ↓
Cloud Function يخزن في Firestore
  ↓
Dashboard يعرض التحديث في الوقت الفعلي
```

### من Dashboard → Cloud → IDE
```
مستخدم يضغط "Apply Patch" في Dashboard
  ↓
Dashboard ينشئ command في Firestore
  ↓
IDE يستلم Command من Polling
  ↓
مستخدم يوافق، Patch يُطبق على الملفات
```

## 🔥 الأحداث التي يرسلها الـ IDE

1. **FILE_SNAPSHOT** - عند فتح ملف
2. **FILE_CHANGED** - عند تعديل ملف
3. **SELECTION_CHANGED** - عند تحديد نص
4. **HEARTBEAT** - كل 30 ثانية (للتأكد من الاتصال)

## 📥 الأوامر التي يستقبلها الـ IDE

1. **APPLY_PATCH** - تطبيق patch على الملفات
2. **OPEN_FILE** - فتح ملف محدد

## 🧪 اختبار النظام

### اختبار إرسال الأحداث
1. شغّل `F0: Start Live Bridge`
2. افتح ملف في workspace
3. عدّل الملف
4. افتح Firebase Console
5. تحقق من `ideSessions/{projectId}/events`
6. يجب أن ترى أحداث `FILE_SNAPSHOT` و `FILE_CHANGED`

### اختبار استقبال الأوامر
1. افتح Dashboard على `http://localhost:3030/en/live`
2. شاهد الـ patches المعلقة
3. اضغط "Apply Patch" على أي patch
4. VS Code يجب أن يظهر رسالة تأكيد
5. اضغط "Apply" لتطبيق التغييرات

## 📝 الأوامر المتاحة في VS Code

- `F0: Start Live Bridge` - تشغيل النظام
- `F0: Stop Live Bridge` - إيقاف النظام
- `F0: Link Project` - ربط المشروع
- `F0: Open Assistant` - فتح الـ chat panel
- `F0: Sign Out` - تسجيل الخروج

## ⚙️ الإعدادات (VS Code Settings)

```json
{
  "f0.projectId": "your-project-id",
  "f0.apiBase": "http://localhost:3030",
  "f0.apiKey": ""
}
```

## 🎨 المميزات

✅ **مراقبة تلقائية للملفات** - كل تغيير يُرسل للـ Cloud
✅ **Polling كل 3 ثواني** - استقبال الأوامر فورًا
✅ **تأكيد المستخدم** - لا patch يُطبق بدون موافقتك
✅ **دعم ملفات متعددة** - Patch واحد يمكن أن يعدل أكثر من ملف
✅ **Heartbeat** - النظام يتأكد من الاتصال كل 30 ثانية

## 🔧 التحسينات المستقبلية

1. إنشاء session حقيقي عبر `/api/ide/session` بدلاً من استخدام projectId
2. دمج كامل مع Phase 84 AuthManager
3. إضافة reconnection تلقائي عند انقطاع الشبكة
4. إرسال diffs بدلاً من الملف الكامل (تحسين الأداء)
5. دعم multi-workspace

## 📚 ملفات ذات صلة

- [Phase 84: VS Code Extension](PHASE_84_FINAL_SUMMARY.md)
- [Phase 86: IDE Bridge Backend](PHASE_86_IDE_BRIDGE_COMPLETE.md)
- [Phase 87: Complete Documentation](PHASE_87_IDE_BRIDGE_INTEGRATION_COMPLETE.md)
- [IDE Bridge Architecture](IDE_BRIDGE_ARCHITECTURE.md)

---

**الحالة:** ✅ جاهز للاستخدام
**التاريخ:** 2025-11-25
**الكود:** مكتمل وجاهز للتشغيل
