# Phase 72.C - GitHub Repository Link Integration - FIXED ✅

## التاريخ
2025-11-18

## الملخص
تم إصلاح المشاكل الحرجة في Cloud Function `saveProjectIntegrations` حسب ملاحظات المستخدم.

## المشاكل التي تم إصلاحها

### 1. قراءة من Collection خاطئ ❌ → ✅
**المشكلة**: الـ function كانت تقرأ من `ops_projects` للتحقق من الملكية
**الحل**: تم التعديل للقراءة من `projects` collection

```typescript
// ❌ WRONG (قبل)
const projectRef = db.collection("ops_projects").doc(projectId);

// ✅ CORRECT (بعد)
const projectRef = db.collection("projects").doc(projectId);
```

### 2. استخدام Error Type خاطئ ❌ → ✅
**المشكلة**: استخدام `Error` العادي بدلاً من `HttpsError`
**الحل**: استخدام `HttpsError` من firebase-functions/v2

```typescript
// ❌ WRONG (قبل)
throw new Error("UNAUTHENTICATED");
throw new Error("PROJECT_NOT_FOUND");

// ✅ CORRECT (بعد)
throw new HttpsError("unauthenticated", "Authentication required");
throw new HttpsError("not-found", "Project does not exist");
```

### 3. فحص Field خاطئ ❌ → ✅
**المشكلة**: فحص `ownerId` أو `createdBy` بدلاً من `ownerUid`
**الحل**: فحص `data.ownerUid` مباشرة

```typescript
// ❌ WRONG (قبل)
const ownerUid = projectData?.ownerId || projectData?.createdBy;
if (ownerUid !== uid) { ... }

// ✅ CORRECT (بعد)
if (data?.ownerUid !== request.auth.uid) {
  throw new HttpsError("permission-denied", "...");
}
```

## الملفات المعدّلة

### 1. `functions/src/projects/saveProjectIntegrations.ts`
- ✅ إضافة import لـ `HttpsError`
- ✅ تغيير ownership check للقراءة من `projects`
- ✅ استخدام `data.ownerUid` للتحقق من الملكية
- ✅ استخدام `HttpsError` بدلاً من `Error` العادي
- ✅ تحديث منطق error handling
- ✅ عكس ترتيب التحديثات: `projects` أولاً ثم `ops_projects`

### الكود النهائي الصحيح

```typescript
// functions/src/projects/saveProjectIntegrations.ts
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

interface SaveProjectIntegrationsData {
  projectId: string;
  githubRepoUrl?: string | null;
  firebaseProjectId?: string | null;
  firebaseWebAppId?: string | null;
}

export const saveProjectIntegrations = onCall<SaveProjectIntegrationsData>(
  async (request) => {
    try {
      const { projectId, githubRepoUrl, firebaseProjectId, firebaseWebAppId } =
        request.data;

      // التأكد من المصادقة
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      if (!projectId) {
        throw new HttpsError("invalid-argument", "Missing projectId");
      }

      const db = getFirestore();

      // التحقق من ملكية المشروع - يجب القراءة من projects وليس ops_projects
      const projectRef = db.collection("projects").doc(projectId);
      const snap = await projectRef.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", "Project does not exist");
      }

      const data = snap.data();

      if (data?.ownerUid !== request.auth.uid) {
        throw new HttpsError(
          "permission-denied",
          "You do not have permission to modify this project"
        );
      }

      // بناء الـ integrations object
      const integrations: any = {};

      if (githubRepoUrl !== undefined) {
        integrations["integrations.github.repoUrl"] = githubRepoUrl;
      }

      if (firebaseProjectId !== undefined) {
        integrations["integrations.firebase.projectId"] = firebaseProjectId;
      }

      if (firebaseWebAppId !== undefined) {
        integrations["integrations.firebase.webAppId"] = firebaseWebAppId;
      }

      // تحديث في projects (المصدر الأساسي)
      await projectRef.update({
        ...integrations,
        updatedAt: new Date(),
      });

      // تحديث في ops_projects أيضاً
      const opsProjectRef = db.collection("ops_projects").doc(projectId);
      const opsSnap = await opsProjectRef.get();

      if (opsSnap.exists) {
        await opsProjectRef.update({
          ...integrations,
          updatedAt: new Date(),
        });
      }

      logger.info(
        `[saveProjectIntegrations] Updated integrations for project ${projectId}`
      );

      return { ok: true };
    } catch (err: any) {
      logger.error("[saveProjectIntegrations] error", err);

      // HttpsError will be automatically handled by Firebase
      if (err instanceof HttpsError) {
        throw err;
      }

      // For any other errors, wrap in INTERNAL error
      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);
```

## Build Status
✅ Functions built successfully with `pnpm build`

## الملفات الأخرى (بدون تغيير)

### Frontend Files (Already Implemented):
1. ✅ `src/lib/firebase/functions/projectIntegrationsFunctions.ts` - Client utility
2. ✅ `src/app/[locale]/projects/[id]/settings/page.tsx` - UI with Dialog
3. ✅ `src/app/[locale]/projects/[id]/page.tsx` - Quick link updated

## الخطوات التالية

### اختبار (Testing)
1. فتح مشروع `test-123` في المتصفح
2. الانتقال إلى Settings page
3. النقر على "ربط" في GitHub Repository card
4. إدخال repo URL: `https://github.com/username/repo`
5. حفظ والتحقق من نجاح العملية
6. التحقق من حفظ البيانات في كل من:
   - `projects/{projectId}`
   - `ops_projects/{projectId}`

### التحقق من الأذونات
- تجربة المستخدم غير المالك (يجب أن يفشل)
- تجربة المستخدم غير مصادق عليه (يجب أن يفشل)

## ملاحظات مهمة

1. **Collection Priority**: الـ function الآن تقرأ من `projects` للتحقق من الملكية (الأساسي)
2. **Dual Updates**: تحدث في الـ collections الاثنين (`projects` و `ops_projects`)
3. **Error Handling**: استخدام `HttpsError` الصحيح من firebase-functions v2
4. **Security**: التحقق من `data.ownerUid === request.auth.uid`

## Status
🟢 **READY FOR TESTING** - جاهز للاختبار

تم إصلاح جميع المشاكل الحرجة التي حددها المستخدم (80% من المشكلة).
