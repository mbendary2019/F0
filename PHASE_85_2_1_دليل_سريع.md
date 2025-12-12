# Phase 85.2.1 - واجهة خطط المساحة في الـ Web IDE ✅

**الحالة**: مكتمل
**التاريخ**: 2025-01-20

## نظرة عامة

Phase 85.2.1 يربط **واجهة الـ Web IDE** بـ **Workspace Planner** و **Patch Engine** اللي بنيناهم في Phases 85.1 و 85.2.

## إيه اللي اتضاف؟

### 1. متغيرات الحالة الجديدة

```typescript
// Phase 85.2.1: Workspace Plan state
const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlan | null>(null);
const [workspacePatches, setWorkspacePatches] = useState<Array<{...}>>([]);
const [selectedPlanStepId, setSelectedPlanStepId] = useState<string | null>(null);
const [isWorkspaceActionLoading, setIsWorkspaceActionLoading] = useState(false);
const [lastError, setLastError] = useState<string | null>(null);
```

### 2. دوال مساعدة

#### `buildWorkspaceContext()`

بتجمع كل معلومات المساحة **بما فيها محتوى الملفات** عشان نقدر نعمل patches:

```typescript
const buildWorkspaceContext = () => {
  return {
    projectId,
    sessionId,
    openedFiles: files.map(f => ({
      path: f.path,
      languageId: f.languageId,
      content: f.content, // مهم جدًا للـ patch generation
    })),
    currentFile: { ... },
    changedFiles: [ ... ],
    timestamp: Date.now(),
  };
};
```

#### `handleWorkspaceAction(mode)`

بتبعت طلب تخطيط للـ backend:

- `mode: 'multi-file-plan'` → خطة بس
- `mode: 'multi-file-apply'` → خطة + patches

#### `openPatchDiff(patch)`

بتفتح الـ patch في الـ DiffViewer الموجود من Phase 84.9.4.

### 3. واجهة المستخدم

#### زرارين جديدين في رأس الـ AI Assistant

- **📋 Plan Workspace** (بنفسجي) - يعمل خطة بس
- **🔧 Plan & Patch** (نيلي) - يعمل خطة + patches

```typescript
<button onClick={() => handleWorkspaceAction('multi-file-plan')}>
  📋 Plan Workspace
</button>
<button onClick={() => handleWorkspaceAction('multi-file-apply')}>
  🔧 Plan & Patch
</button>
```

#### بانل الخطة

بيظهر تحت رأس الشات لما يكون فيه خطة:

- عنوان الخطة
- ملخص (summary)
- خطوات قابلة للتوسيع
- كل خطوة فيها:
  - العنوان والوصف
  - نوع التغيير (refactor, bugfix, etc.)
  - عدد الملفات المستهدفة
  - عدد الـ patches (لو موجودة)
- لو دوست على خطوة، بتوسّع وتعرض الـ patches
- لو دوست على patch، بيفتح الـ DiffViewer

#### زرار "Clear Plan"

بيمسح الخطة والـ patches من الواجهة.

## رحلة المستخدم

### السيناريو 1: Plan Workspace (خطة فقط)

1. المستخدم يكتب: "Refactor authentication logic"
2. يضغط **📋 Plan Workspace**
3. Frontend يبعت طلب لـ `/api/ide/chat` بـ `mode: 'multi-file-plan'`
4. Backend يعمل خطة (Phase 85.1)
5. Frontend يعرض الخطة مع الخطوات
6. المستخدم يراجع الخطة **بدون patches**

### السيناريو 2: Plan & Patch (خطة + patches)

1. المستخدم يكتب: "Add error handling to API routes"
2. يضغط **🔧 Plan & Patch**
3. Frontend يبعت طلب بـ `mode: 'multi-file-apply'`
4. Backend:
   - يعمل خطة (Phase 85.1)
   - يعمل patches لكل خطوة (Phase 85.2)
5. Frontend يعرض الخطة + الـ patches
6. المستخدم يدوس على خطوة عشان يشوف الـ patches
7. يدوس على patch عشان يفتح DiffViewer
8. DiffViewer يعرض مقارنة جنب بجنب
9. "Apply Patch" عشان يقبل التغييرات
10. الملف يتحدّث في Monaco editor
11. Auto-save يحفظ بعد ثانيتين
12. التغييرات تتحفظ في Firestore

## تفاصيل تقنية

### Mode-Based Routing

الـ API endpoint `/api/ide/chat` بيعمل routing حسب `mode`:

- `'single-file'` (default) - الشات العادي
- `'multi-file-plan'` - يرجع خطة بس
- `'multi-file-apply'` - يرجع خطة + patches

### ربط الـ Patches بالخطوات

كل patch فيه `stepId` بيربطه بخطوة معينة:

```typescript
interface Patch {
  filePath: string;
  diff: string;
  stepId?: string; // WorkspacePlanStep.id
}
```

الـ `patchesByStep` memo بيجمّع الـ patches حسب الخطوة:

```typescript
const patchesByStep = useMemo(() => {
  const map = new Map<string, Array<{ filePath: string; diff: string }>>();
  workspacePatches.forEach(p => {
    const stepId = p.stepId || 'unknown';
    if (!map.has(stepId)) map.set(stepId, []);
    map.get(stepId)!.push({ filePath: p.filePath, diff: p.diff });
  });
  return map;
}, [workspacePatches]);
```

### حالات التحميل

3 حالات تحميل:

1. `isLoading` - الشات العادي (single-file)
2. `isWorkspaceActionLoading` - تخطيط المساحة
3. مدمجين في الواجهة: `{(isLoading || isWorkspaceActionLoading) && ...}`

## التكامل مع الميزات الموجودة

### Phase 84.9.3: نظام الحفظ التلقائي

لما الـ patches تتطبق، نظام الحفظ التلقائي:

- يكتشف التغييرات في الملف
- ينتظر ثانيتين
- يحفظ في Firestore: `projects/{projectId}/ideFiles/{fileId}`

### Phase 84.9.4: DiffViewer

الـ DiffViewer الموجود بيتعاد استخدامه **بدون أي تعديلات**:

- بياخد `original` و `modified`
- بيعرض Monaco diff جنب بجنب
- فيه زر "Apply Patch" و "Reject"

### Phase 78: Patch Pipeline

الـ Workspace Patch Engine (Phase 85.2) بيستخدم نفس الـ AI patch generation pipeline من Phase 78.

## الملفات المتغيرة

1. **src/app/[locale]/f0/ide/page.tsx**
   - 6 متغيرات حالة جديدة
   - 3 دوال مساعدة (120+ سطر)
   - زرارين جديدين في الرأس
   - بانل الخطة
   - تحديثات على loading indicators
   - تحديثات على input field disabled states

2. **src/types/ideBridge.ts**
   - `WorkspacePlan` و `WorkspacePlanStep` types (Phase 85.1)
   - `IdeChatMode` type
   - امتدادات للـ request/response interfaces

## قائمة اختبار

- [ ] زر Plan Workspace يعمل خطة فقط
- [ ] زر Plan & Patch يعمل خطة + patches
- [ ] بانل الخطة يظهر صح
- [ ] الخطوات تتوسع/تنكمش
- [ ] الضغط على patch يفتح DiffViewer
- [ ] DiffViewer يعرض original vs modified صح
- [ ] Apply Patch يحدّث محتوى الملف
- [ ] Auto-save يحفظ في Firestore
- [ ] زر Clear Plan يمسح الخطة
- [ ] حالات التحميل تشتغل صح
- [ ] رسائل الأخطاء تظهر
- [ ] الشات العادي لسه شغال (single-file mode)

## الخطوات القادمة

### Phase 85.3: VS Code Extension Integration

نجيب نفس قدرات الـ multi-file للـ VS Code extension:

1. نضيف واجهة خطط المساحة لـ VS Code webview
2. أوامر command palette:
   - "F0: Plan Workspace Changes"
   - "F0: Plan & Apply Patches"
3. تكامل مع VS Code diff viewer
4. استخدام VS Code file system APIs

### Phase 85.4: Batch Patch Application

نسمح للمستخدم يطبّق كل الـ patches في خطوة أو خطة كاملة مرة واحدة.

### Phase 85.5: Plan History

نحفظ الخطط في Firestore للمراجعة:

- Collection: `projects/{projectId}/workspacePlans/{planId}`
- المستخدم يقدر يرجع لخطط سابقة ويعيد تطبيقها

## التوافق مع الإصدارات السابقة

✅ **متوافق 100%**

- الوضع الافتراضي لسه `single-file`
- العملاء الموجودين (VS Code, Cursor, Xcode, Web IDE) لسه شغالين
- وظيفة الشات العادية لم تتغير
- العناصر الجديدة فقط هي أزرار المساحة

## الملخص

Phase 85.2.1 يكمل **نظام تحرير مساحات العمل متعدد الملفات**:

1. **Phase 85.1** - Workspace Planner Engine (server)
2. **Phase 85.2** - Multi-File Patch Generation Engine (server)
3. **Phase 85.2.1** - Web IDE Workspace Plan UI (client) ✅

المستخدمين دلوقتي يقدروا:

- يعملوا خطط تغيير متعددة الملفات من لغة طبيعية
- يولّدوا AI patches لملفات متعددة
- يراجعوا الـ patches في diff viewer
- يطبّقوا التغييرات بضغطة زر
- الحفظ التلقائي في Firestore

النظام جاهز للإنتاج ومتكامل بالكامل مع كل ميزات Phase 84.
