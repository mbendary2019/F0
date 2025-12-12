# Phase 122: RAG-Lite (بدون Embeddings) ✅

## الملخص

تم إنشاء نظام RAG-Lite الذي يمكّن الـ Agent من الإجابة على أسئلة عن الكود باستخدام الـ Project Index بدون الحاجة لـ Embeddings أو Vector Database.

## الملفات المنشأة

### 1. `desktop/src/lib/rag/projectContextFromIndex.ts`
Helper للحصول على ملفات السياق من الـ Index:

```typescript
// الاستخدام
import { getContextFilesFromIndex, getQuickContext } from './projectContextFromIndex';

// الحصول على ملفات سياق لسؤال معين
const files = await getContextFilesFromIndex({
  projectRoot: '/path/to/project',
  query: 'login authentication',
  strategy: 'hybrid', // 'by-symbol' | 'by-text' | 'hybrid'
  maxFiles: 6,
  maxCharsPerFile: 4000,
});

// البحث السريع
const quickFiles = await getQuickContext(projectRoot, query, 5);
```

### 2. `desktop/src/lib/rag/answerWithIndexedContext.ts`
Strategy للـ Agent تبني prompt مع context:

```typescript
import { answerWithIndexedContext, buildContextMessages } from './answerWithIndexedContext';

// الإجابة مع سياق
const result = await answerWithIndexedContext({
  llm: yourLLMClient,
  projectRoot: '/path/to/project',
  userQuestion: 'فين الكود المسؤول عن تسجيل الدخول؟',
  activeFilePath: 'src/app/auth/page.tsx', // optional
  activeFileContent: '...', // optional
  language: 'ar', // 'ar' | 'en'
});

console.log(result.answer);
console.log(result.contextFiles); // الملفات المستخدمة
console.log(result.tokensEstimate);

// بناء الرسائل فقط (للـ streaming)
const { messages, contextFiles } = await buildContextMessages({
  projectRoot,
  userQuestion,
  activeFilePath,
  activeFileContent,
});
```

### 3. `desktop/src/lib/rag/index.ts`
تصدير كل الـ utilities:

```typescript
export {
  getContextFilesFromIndex,
  getQuickContext,
  answerWithIndexedContext,
  buildContextMessages,
  type ContextFile,
  type ChatMessage,
  // ...
} from './';
```

### 4. `desktop/src/hooks/useRagContext.ts`
React Hook لإدارة RAG context:

```typescript
import { useRagContext } from './hooks/useRagContext';

function AgentPanel() {
  const { state, getContext, buildMessages, clearContext } = useRagContext();

  const handleQuestion = async (question: string) => {
    const files = await getContext(projectRoot, question);
    // استخدم الملفات في الـ prompt
  };

  return (
    <div>
      {state.isLoading && <span>Loading...</span>}
      {state.contextFiles.map(f => <div key={f.path}>{f.path}</div>)}
    </div>
  );
}
```

### 5. `desktop/src/components/RagContextPanel.tsx`
Component لعرض ملفات السياق:

```tsx
import { RagContextPanel } from './components/RagContextPanel';

<RagContextPanel
  contextFiles={contextFiles}
  isLoading={isLoading}
  isArabic={true}
  onClose={() => setShowContext(false)}
/>
```

## كيف يعمل النظام

```
┌──────────────────────────────────────────────────────────────┐
│                    سؤال المستخدم                             │
│  "فين الكود المسؤول عن تسجيل الدخول؟"                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Project Index                              │
│  .f0/index/project-index.json                                │
│  ├── files[] with symbols, exports, snippets                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              searchProjectIndex()                             │
│  1. Symbol search (functions, classes, hooks)                │
│  2. Export search (exported names)                           │
│  3. File name search                                         │
│  4. Text search (in snippets)                                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            getContextFilesFromIndex()                         │
│  - Merge & dedupe results                                    │
│  - Sort by score                                             │
│  - Read file contents                                        │
│  - Limit to maxFiles & maxCharsPerFile                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│           buildContextMessages()                              │
│  System: "You are F0 Code Agent..."                          │
│  Assistant: "Project files:\n📄 FILE: src/auth/..."          │
│  User: "فين الكود المسؤول عن..."                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      LLM Response                             │
│  "الكود المسؤول عن تسجيل الدخول موجود في:                    │
│   - src/app/auth/page.tsx (صفحة تسجيل الدخول)               │
│   - src/lib/firebase.ts (Firebase Auth setup)               │
│   ..."                                                       │
└──────────────────────────────────────────────────────────────┘
```

## أمثلة للاستخدام

### سؤال عن البنية
```
"اشرحلي بنية المشروع ده بشكل عام؟"
```
→ يبحث عن: `app`, `page`, `layout`, `route`, `component`
→ يرجع ملفات مثل: `src/app/page.tsx`, `src/app/layout.tsx`, etc.

### سؤال عن ميزة
```
"فين الكود اللي مسؤول عن الدفع؟"
```
→ يبحث عن: `payment`, `checkout`, `billing`, `stripe`
→ يرجع ملفات مثل: `src/lib/stripe.ts`, `src/app/api/billing/...`

### سؤال عن hook معين
```
"إزاي useAuth بتشتغل؟"
```
→ يبحث بالـ symbol: `useAuth`
→ يرجع الملف اللي فيه الـ hook

## CSS Styles

تم إضافة styles للـ `RagContextPanel` في `styles.css`:
- `.f0-rag-context-panel` - الـ container
- `.f0-rag-header` - header مع title و count
- `.f0-rag-files` - قائمة الملفات
- `.f0-rag-file` - كل ملف
- RTL support

## المميزات

1. **بدون Embeddings** - لا حاجة لـ OpenAI Embeddings أو Vector DB
2. **سريع** - يستخدم الـ index المحلي فقط
3. **ذكي** - يجمع بين symbol + text + file search
4. **يدعم العربية** - prompts و UI بالعربي
5. **يتكامل مع Active File** - الملف المفتوح في الـ editor يضاف تلقائياً للسياق

## الخطوة القادمة

Phase 123 - Project Snapshot Memory:
- زرار "Generate Project Overview" في IDE
- يخزن ملخص ثابت في Firestore
- يتحدث كل ما تعمل re-index
