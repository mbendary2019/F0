# Phase 85.1 - نظام تخطيط Workspace متعدد الملفات ✅

**الحالة**: مكتمل بنجاح 🎉
**التاريخ**: 2025-11-20
**التوافقية**: 100% متوافق مع كل العملاء الحاليين (VS Code, Cursor, Xcode, Web IDE)

---

## ما الذي تم تنفيذه؟

### الفكرة الأساسية
أضفنا للـ IDE Bridge Protocol قدرة التخطيط الذكي على مستوى الـ Workspace كامل، بحيث يقدر الـ AI يحلل المشروع ويعمل خطة منظمة لتغييرات متعددة الملفات.

### ثلاثة أوضاع (Modes)

#### 1. `single-file` (الافتراضي)
- السلوك الموجود من Phase 84.x
- للتعديلات السريعة على ملف واحد
- **لا يؤثر على أي عميل موجود**

#### 2. `multi-file-plan` (جديد)
- ينشئ خطة منظمة بدون patches
- المستخدم يراجع الخطة قبل التطبيق

#### 3. `multi-file-apply` (جديد)
- ينشئ خطة + patches لكل الخطوات
- جاهز للتطبيق الفوري

---

## الملفات المعدلة

### 1️⃣ الـ Types ([src/types/ideBridge.ts](src/types/ideBridge.ts))

**التغييرات**:
```typescript
// جعلنا IdeWorkspaceContext اختياري للمرونة
export interface IdeWorkspaceContext {
  projectId?: string;
  sessionId?: string;
  openedFiles?: { path: string; languageId?: string }[];
  currentFile?: { path: string; languageId?: string };
  changedFiles?: { path: string; status: 'modified' | 'added' | 'deleted' }[];
  packageJson?: { ... };
  timestamp?: number;
}

// أضفنا types جديدة
export interface WorkspacePlanStep {
  id: string;
  title: string;
  description: string;
  targetFiles: string[];
  changeKind: 'refactor' | 'bugfix' | 'performance' | ...;
  estimatedImpact?: string;
}

export interface WorkspacePlan {
  goal: string;
  summary: string;
  steps: WorkspacePlanStep[];
}

// أضفنا نظام Modes
export type IdeChatMode =
  | 'single-file'          // الافتراضي
  | 'multi-file-plan'      // خطة فقط
  | 'multi-file-apply';    // خطة + patches

// وسّعنا الـ Request
export interface IdeChatRequest {
  // ... الحقول الموجودة
  mode?: IdeChatMode;  // ✨ جديد
}

// وسّعنا الـ Response
export interface IdeChatResponse {
  // ... الحقول الموجودة
  kind?: 'single-file' | 'workspace-plan' | 'workspace-plan+patches';
  plan?: WorkspacePlan;
  patches?: Array<{ filePath: string; diff: string }>;
}
```

### 2️⃣ محرك التخطيط ([src/lib/ide/workspacePlanner.ts](src/lib/ide/workspacePlanner.ts)) - جديد

**الوظيفة**:
```typescript
export async function planWorkspaceChanges(
  input: WorkspacePlannerInput
): Promise<WorkspacePlan>
```

**المميزات**:
- يحلل الـ workspace كامل (files, dependencies, changes)
- يستخدم AI لعمل خطة منظمة
- Parsing قوي للـ JSON (يدعم markdown code blocks)
- خطط بديلة (fallback) في حالة الأخطاء
- Logging شامل للـ debugging

### 3️⃣ الـ API Route ([src/app/api/ide/chat/route.ts](src/app/api/ide/chat/route.ts))

**التغييرات**:

```typescript
// استخرجنا الـ mode من الـ request
const { mode = 'single-file', ... } = body;

// أضفنا routing حسب الـ mode
if ((mode === 'multi-file-plan' || mode === 'multi-file-apply') && workspaceContext) {

  // عملنا الخطة
  const plan = await planWorkspaceChanges({ ... });

  if (mode === 'multi-file-plan') {
    // نرجع الخطة فقط
    return { kind: 'workspace-plan', plan };
  }

  if (mode === 'multi-file-apply') {
    // نعمل patches لكل step
    const patches = [];
    for (const step of plan.steps) {
      const patchResult = await previewPatch({ ... });
      patches.push(...patchResult.patches);
    }

    // نرجع الخطة + patches
    return { kind: 'workspace-plan+patches', plan, patches };
  }
}

// السلوك الافتراضي (single-file)
// نفس الكود القديم بدون أي تغيير
```

---

## أمثلة

### مثال 1: وضع الخطة فقط

**الطلب**:
```json
{
  "message": "أضف TypeScript strict mode للمشروع",
  "mode": "multi-file-plan",
  "workspaceContext": {
    "openedFiles": [
      { "path": "tsconfig.json" },
      { "path": "src/index.ts" }
    ]
  }
}
```

**الاستجابة**:
```json
{
  "kind": "workspace-plan",
  "plan": {
    "goal": "أضف TypeScript strict mode للمشروع",
    "summary": "تفعيل strict mode وإصلاح أخطاء الأنواع",
    "steps": [
      {
        "id": "step-1",
        "title": "تحديث tsconfig.json",
        "description": "تفعيل strict mode في compiler options",
        "targetFiles": ["tsconfig.json"],
        "changeKind": "typing"
      },
      {
        "id": "step-2",
        "title": "إصلاح أخطاء الأنواع في index.ts",
        "targetFiles": ["src/index.ts"],
        "changeKind": "typing"
      }
    ]
  }
}
```

### مثال 2: وضع التطبيق الكامل

**الطلب**:
```json
{
  "message": "أعد هيكلة معالجة الأخطاء",
  "mode": "multi-file-apply",
  "workspaceContext": { ... }
}
```

**الاستجابة**:
```json
{
  "kind": "workspace-plan+patches",
  "plan": { ... },
  "patches": [
    {
      "filePath": "src/errors.ts",
      "diff": "--- src/errors.ts\n+++ src/errors.ts\n..."
    },
    {
      "filePath": "src/api/users.ts",
      "diff": "..."
    }
  ]
}
```

### مثال 3: الوضع الافتراضي (single-file)

**الطلب** (من عميل قديم):
```json
{
  "message": "اصلح هذا الـ bug",
  "fileContext": { ... }
  // لاحظ: لا يوجد mode - يستخدم الافتراضي
}
```

**الاستجابة** (نفس Phase 84.x):
```json
{
  "kind": "single-file",
  "replyText": "وجدت المشكلة...",
  "patchSuggestion": { ... }
}
```

---

## الـ Console Logs

### وضع multi-file-plan
```
[IDE Chat] Mode: multi-file-plan, hasWorkspaceContext: true
[IDE Chat] Phase 85.1: Multi-file mode detected: multi-file-plan
[Workspace Planner] Generating plan for goal: أضف TypeScript strict mode
[Workspace Planner] Successfully generated plan with 3 steps
[IDE Chat] Returning workspace plan (plan-only mode)
```

### وضع multi-file-apply
```
[IDE Chat] Mode: multi-file-apply, hasWorkspaceContext: true
[IDE Chat] Phase 85.1: Multi-file mode detected: multi-file-apply
[Workspace Planner] Generated plan with 2 steps
[IDE Chat] Generating patches for 2 steps...
[IDE Chat] Generated 3 patches across 2 steps
```

---

## التوافقية مع العملاء الحاليين

### ✅ كل العملاء يشتغلوا بدون أي تعديل

**ليه؟**
1. الـ `mode` اختياري ويرجع لـ `'single-file'` لو مش موجود
2. كل الـ logic القديم موجود زي ما هو
3. الاستجابات الافتراضية نفس Phase 84.x

**العملاء المدعومين**:
- VS Code Extension ✅
- Cursor IDE ✅
- Xcode Extension ✅
- Web IDE ✅
- أي عميل custom ✅

---

## الاختبار

### اختبار 1: Single-File Mode
```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Fix bug", "fileContext": {...}}'
```
**المتوقع**: `kind: 'single-file'`

### اختبار 2: Multi-File Plan
```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Add strict mode", "mode": "multi-file-plan", "workspaceContext": {...}}'
```
**المتوقع**: `kind: 'workspace-plan'` + `plan`

### اختبار 3: Multi-File Apply
```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Refactor errors", "mode": "multi-file-apply", "workspaceContext": {...}}'
```
**المتوقع**: `kind: 'workspace-plan+patches'` + `plan` + `patches[]`

---

## الملخص النهائي

### ✅ تم بنجاح!

**المميزات الجديدة**:
- 🎯 محرك تخطيط workspace ذكي
- 🔀 ثلاثة أوضاع (single, plan, apply)
- 🔄 100% متوافق مع كل العملاء
- 🤖 AI-driven planning مع error handling قوي
- 📋 خطط منظمة بـ steps و target files
- 🔧 تكامل مع نظام الـ patches (Phase 78)

**الفائدة للمستخدم**:
1. **تعديلات سريعة**: استخدم single-file (الافتراضي)
2. **مراجعة الخطة**: استخدم multi-file-plan للمراجعة أولاً
3. **تغييرات دفعة**: استخدم multi-file-apply للتنفيذ الفوري

**Phase 85.1 كامل! 🎉**

**الـ IDE Bridge Protocol الآن يدعم التخطيط الذكي على مستوى الـ workspace! 🚀**
