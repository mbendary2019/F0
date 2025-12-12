# Phase 84 — Live IDE Bridge (VS Code / Cursor Level)

**Status:** 🟡 Spec Ready
**Goal:** توصيل F0 Agent مباشرة مع الـ IDE (VS Code كبداية) لتطبيق الباتشات، قراءة الملفات، والتفاعل مع الكود محليًا بشكل حي، بنفس مستوى Cursor / Copilot Workspace.

---

## 1. 🎯 Overview

حتى الآن:

- ✅ عندنا Patch Engine كامل (Phases 78–82)
- ✅ عندنا Error Recovery + Patch Pipeline (81)
- ✅ عندنا VFS + GitHub + PRs (Phase 83)
- ✅ عندنا Chat + PatchMessage + PatchViewer UI

Phase 84 هدفها:

> جعل F0 Agent يقدر:
> - يقرأ الملفات من الـ workspace المحلي للمستخدم (VS Code)
> - يطبق الباتشات مباشرة على ملفات المستخدم محليًا
> - يشتغل live أثناء ما المستخدم بيكتب
> - من غير ما يحتاج كل مرّة يروح GitHub أو VFS

**اللّي هننفّذه في Phase 84:**

1. VS Code Extension مبدئي اسمه: `f0-live-bridge`
2. Communication Protocol بين:
   - VS Code Extension ↔ F0 API
3. Local Patch Application Engine (في VS Code)
4. Project Linking (VS Code workspace ↔ F0 projectId)
5. Live Chat Panel جوه VS Code مع نفس Agent
6. Basic Commands:
   - "Ask F0 about this file"
   - "Fix this error"
   - "Refactor selected code"

---

## 2. 🧱 High-Level Architecture

### Components:

1. **F0 Cloud (Current System)**
   - `/api/chat` endpoint (موجود)
   - Patch pipeline (Phase 78–81)
   - Token tracking, plans، projectMemory…

2. **F0 IDE Bridge API (New, Phase 84)**
   - Endpoints خاصة بـ IDE:
     - `POST /api/ide/session`
     - `POST /api/ide/chat`
     - (لاحقًا) `POST /api/ide/events`

3. **VS Code Extension: `f0-live-bridge`**
   - Webview Panel: "F0 Assistant"
   - Communication:
     - VS Code ←→ Webview (postMessage)
     - Webview ←→ F0 API (fetch HTTPS)
   - Local File Ops:
     - قراءة محتوى الملفات في workspace
     - تطبيق الباتشات على الملفات عبر TextEdit

4. **Patch Application (Local)**
   - نفس unified diff format المستخدم في F0
   - Parsing في الـ extension
   - تطبيق patch على محتوى الملفات
   - حفظ الملف التلقائي أو حسب خيار المستخدم

---

## 3. 🧩 Mini-Phases Inside Phase 84

1. **84.1 — IDE Protocol & API Shape**
2. **84.2 — VS Code Extension Skeleton**
3. **84.3 — Local Patch Application (diff → file edits)**
4. **84.4 — Project Linking + Auth**
5. **84.5 — Chat + Context (file / selection / diagnostics)**

---

## 4. 84.1 — IDE Protocol & API Shape

### 4.1.1 New Types

**File:** `src/types/ideBridge.ts`

```ts
export type IdeClientKind = 'vscode' | 'cursor-like';

export interface IdeSession {
  id: string;
  projectId: string;
  clientKind: IdeClientKind;
  createdAt: string;
  createdBy: string; // uid
}

export interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;
  locale?: string;
  fileContext?: {
    filePath: string;
    content: string;
    languageId?: string;
    selection?: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
    };
  };
}

export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: {
    hasPatch: boolean;
    patchText?: string; // unified diff block
  };
  taskKind?: string;
}
```

### 4.1.2 New API Endpoints

**(A) POST /api/ide/session**

**File:** `src/app/api/ide/session/route.ts`

**Input:**
- `projectId`
- `clientKind = 'vscode'`

**Output:**
- `{ sessionId, projectId, clientKind }`

**(B) POST /api/ide/chat**

**File:** `src/app/api/ide/chat/route.ts`

**Input:** `IdeChatRequest`

**Pipeline:**
- يستخدم نفس الـ Agent Core الموجود في `/api/chat`
- يمر عبر task classifier (Phase 76)
- يستعمل projectMemory + projectAnalysis (Phases 74–75)
- يطلب من الـ Agent إنتاج:
  - نص
  - (للـ code_edit/bug_fix/refactor) unified diff block
- يعيد النتيجة كـ `IdeChatResponse`

**Output:**
- النص
- patchText (إن وجد)

هذه الـ route هي الـ "brain endpoint" للـ VS Code extension.

---

## 5. 84.2 — VS Code Extension Skeleton

### 5.1 Structure

Create a new folder/repo (أو package داخل monorepo):

```
/ide/vscode-f0-bridge/
```

Inside:
- `package.json`
- `tsconfig.json`
- `src/extension.ts`
- `src/panels/F0Panel.ts`
- `src/webview/main.tsx` (React UI للـ webview)

### 5.2 package.json (مختصر)

```json
{
  "name": "f0-live-bridge",
  "displayName": "F0 Live Bridge",
  "description": "Connect VS Code workspace with F0 AI Agent (live patch editing).",
  "version": "0.0.1",
  "publisher": "from-zero",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onCommand:f0.openAssistant"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "f0.openAssistant",
        "title": "F0: Open Assistant"
      },
      {
        "command": "f0.fixSelection",
        "title": "F0: Fix Selected Code"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "webpack --mode production",
    "watch": "webpack --watch"
  }
}
```

### 5.3 extension.ts Skeleton

```typescript
import * as vscode from 'vscode';
import { F0Panel } from './panels/F0Panel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.openAssistant', () => {
      F0Panel.createOrShow(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('f0.fixSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor');
        return;
      }
      const selection = editor.selection;
      const text = editor.document.getText(selection);
      // سيتم توصيل ده لاحقًا بفلو الـ IDE Chat (84.5)
      vscode.window.showInformationMessage('F0: Selected code captured (future hook).');
    })
  );
}

export function deactivate() {}
```

---

## 6. 84.3 — Local Patch Application (Diff → File Edits)

### الهدف

استلام unified diff من F0 → تحويله لـ edits في VS Code:
- نقرأ محتوى الملف الحالي
- نطبّق الـ patch
- نكتب المحتوى الجديد في الـ document

### 6.1 Patch Engine في الـ Extension

**File:** `src/patch/applyPatch.ts`

الفكرة:
- إمّا:
  - تستخدم نسخة خفيفة من نفس الـ patch parser اللي عندك (من Phase 78) وتشاركها،
  - أو تكتب نسخة خاصة بالـ extension.

**Pseudo:**

```typescript
import * as vscode from 'vscode';

export async function applyUnifiedDiffToWorkspace(
  patchText: string,
  workspaceRoot: vscode.Uri
) {
  // 1) parse patchText إلى file patches
  const files = parseUnifiedDiff(patchText); // TODO: implement or import

  for (const filePatch of files) {
    const fileUri = vscode.Uri.joinPath(workspaceRoot, filePatch.filePath);
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const original = doc.getText();

    const newContent = applyPatchToContent(original, filePatch); // TODO

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(original.length)
    );
    edit.replace(fileUri, fullRange, newContent);
    await vscode.workspace.applyEdit(edit);
    await doc.save();
  }
}
```

المهم: نستخدم نفس الـ format اللي بترجّعه Phase 81.

---

## 7. 84.4 — Project Linking + Auth (VS Code ↔ F0 Project)

### الهدف

كل workspace في VS Code لازم يعرف:
- `projectId` الخاص به في F0
- `apiKey` أو `authToken` للوصول للـ F0 API

### 7.1 Settings

في VS Code extension استعمل:
- `vscode.workspace.getConfiguration("f0")`

مثال config:

```json
// settings.json
"f0.projectId": "abc123",
"f0.apiBase": "https://app.from-zero.ai",
"f0.apiKey": "F0_xxx" // أو استخدام Firebase auth token لاحقًا
```

داخل extension:

```typescript
const config = vscode.workspace.getConfiguration('f0');
const projectId = config.get<string>('projectId');
const apiBase = config.get<string>('apiBase');
const apiKey = config.get<string>('apiKey');
```

### 7.2 Session Creation

عند أول فتح لـ F0Panel:
- ينادي `/api/ide/session`
- يخزن `sessionId` في memory (داخل webview أو extension)

---

## 8. 84.5 — Chat + Context (file / selection / error)

### Chat Webview UI

تعمل Webview React UI شبيهة بـ:
- قائمة رسائل
- Input
- زر "Send"
- أزرار Quick Actions (Fix Selection, Explain Code…)

### Flow:

1. **User يكتب سؤال في الـ webview**

2. **Webview:**
   - يقرأ config (projectId, apiKey) من extension عبر postMessage
   - لو فيه "Attach current file":
     - extension يرسل محتوى الملف + path

3. **Webview يرسل `IdeChatRequest` إلى `/api/ide/chat`**

4. **F0:**
   - يستخدم agent pipeline
   - لو نوع المهمة bug_fix / code_edit / refactor → يرجع unified diff

5. **Webview:**
   - تعرض النص للمستخدم
   - تبعت الـ patch للـ extension عبر postMessage

6. **Extension:**
   - يستدعي `applyUnifiedDiffToWorkspace(patchText, workspaceRoot)`
   - يحدّث الملفات
   - يعرض notification: "Patch applied to 2 files"

---

## 9. 🧪 Testing Scenarios

### 1. Basic Chat without patch

- **Ask:** "What does this file do?"
- **Agent:** يرد نص فقط
- **UI:** تعمل render من غير Patch

### 2. Fix Selected Code

- حدّد block فيه error
- Run command "F0: Fix Selected Code"
- Extension يرسل:
  - fileContext (path + content + selection)
- F0 يرجّع patch
- Extension يطبّقه
- الملف يتصلّح

### 3. Multi-file Patch

- Agent يقترح تعديل في 2–3 ملفات
- patchText فيه multiple files
- Extension يطبّقهم كلهم

### 4. Patch Conflict Locally

- المستخدم عدّل الملف بعد ما اتولّد الـ patch
- applyPatch يفشل
- تُعرض رسالة للمستخدم
- (Phase لاحق: نحط Recovery محلي أو نطلب من F0 Patch جديد)

---

## 10. 🚀 Future Phases After 84

**Phase 85:**
Live Diagnostics Integration (قراءة مشاكل TypeScript, ESLint, build errors وإرسالها للـ Agent تلقائيًا)

**Phase 86:**
Terminal Commands Execution (run tests, build, lint من داخل F0 Agent)

**Phase 87:**
Xcode Bridge / Android Studio Bridge (نفس الفكرة لكن لـ iOS/Android)

---

## ✅ Phase 84 Deliverables

- [ ] PHASE_84_LIVE_IDE_BRIDGE_SPEC.md (هذا الملف)
- [ ] `/api/ide/session` backend route
- [ ] `/api/ide/chat` backend route (Agent integration)
- [ ] VS Code extension skeleton (f0-live-bridge)
- [ ] Local unified diff patch application
- [ ] Settings + project linking
- [ ] Webview chat UI (MVP)
- [ ] Basic commands:
  - [ ] F0: Open Assistant
  - [ ] F0: Fix Selected Code
  - [ ] (Optional) F0: Explain This Code

---

**Next Step:** بدء تنفيذ Phase 84.1 - Backend API endpoints

**Date:** 2025-11-18
