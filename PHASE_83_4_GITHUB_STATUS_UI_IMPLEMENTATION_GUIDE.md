# Phase 83.4: GitHub Status UI + PR Links + Patch Integration

**Status:** 📋 Ready to Implement
**Date:** 2025-11-18
**Prerequisite:** Phase 83.1, 83.2, 83.3 (Complete ✅)

---

## 🎯 الهدف

إظهار كل حالة الـ GitHub لكل Patch بشكل واضح — مباشرة داخل F0 — مع روابط GitHub مباشرة، وBadges، وIndicators.

**المستخدم هيشوف:**
- ✅ الفرع اللي اتعمل
- ✅ ال PR اللي اتفتح
- ✅ حالة الباتش: `pending` / `applied_to_branch` / `pr_opened` / `merged`
- ✅ زر "View on GitHub"
- ✅ رابط الـ branch
- ✅ رابط الـ PR
- ✅ زر Sync بعد PR merge

---

## ✅ التنفيذ المطلوب

### 1) إضافة GitHub Status Badge Component

**File:** `src/app/[locale]/projects/[id]/patches/page.tsx`

**أضف بعد imports:**

```typescript
// GitHub Status Badge Component
function GithubStatusBadge({ status, locale }: { status?: string; locale?: 'ar' | 'en' }) {
  const map: Record<string, string> = {
    applied_to_branch: "bg-blue-500 text-white",
    pr_opened: "bg-purple-600 text-white",
    merged: "bg-green-600 text-white",
    not_applied: "bg-gray-500 text-white",
    failed: "bg-red-600 text-white",
    rejected: "bg-red-600 text-white",
  };

  const labelMapEN: Record<string, string> = {
    applied_to_branch: "Applied to Branch",
    pr_opened: "PR Opened",
    merged: "Merged",
    not_applied: "Not Applied",
    failed: "Failed",
    rejected: "Rejected",
  };

  const labelMapAR: Record<string, string> = {
    applied_to_branch: "مُطبَّق على الفرع",
    pr_opened: "PR مفتوح",
    merged: "تم الدمج",
    not_applied: "غير مُطبَّق",
    failed: "فشل",
    rejected: "مرفوض",
  };

  const labelMap = locale === 'ar' ? labelMapAR : labelMapEN;
  const style = map[status ?? "not_applied"] ?? map["not_applied"];
  const label = labelMap[status ?? "not_applied"] ?? "Unknown";

  return (
    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${style}`}>
      {label}
    </span>
  );
}
```

---

### 2) تحديث PatchRecord Interface

**File:** `src/app/[locale]/projects/[id]/patches/page.tsx` (line 12)

**أضف:**
```typescript
interface PatchRecord {
  id: string;
  status: 'pending' | 'applied' | 'failed' | 'rejected' | 'partially_applied';
  patches: Patch[];
  createdAt: any;
  appliedAt?: any;
  attempts?: number;
  recoverySteps?: Array<{
    strategy: string;
    success: boolean;
    skipped?: boolean;
  }>;
  // Phase 83.4: GitHub Integration Data
  github?: {
    status?: 'applied_to_branch' | 'pr_opened' | 'merged' | 'failed' | 'rejected';
    branch?: string;
    baseBranch?: string;
    pullRequestNumber?: number | null;
    filesCount?: number;
    appliedAt?: any;
    appliedBy?: string;
  };
}
```

---

### 3) إضافة عمود GitHub في الجدول

**File:** `src/app/[locale]/projects/[id]/patches/page.tsx`

**تحديث table headers (line 234):**

```typescript
<thead className="bg-gray-800 border-b border-gray-700">
  <tr>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.id}
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.status}
    </th>
    {/* Phase 83.4: GitHub Status Column */}
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      GitHub
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.files}
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.attempts}
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.created}
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
      {labels.actions}
    </th>
  </tr>
</thead>
```

**تحديث table rows (line 257):**

```typescript
{filteredPatches.map((patch) => (
  <tr key={patch.id} className="hover:bg-gray-800/50 transition">
    <td className="px-4 py-3 text-sm text-gray-300 font-mono">
      {patch.id.slice(0, 8)}...
    </td>
    <td className="px-4 py-3 text-sm">{getStatusBadge(patch.status)}</td>

    {/* Phase 83.4: GitHub Status + Links */}
    <td className="px-4 py-3 text-sm">
      {patch.github?.status ? (
        <div className="flex flex-col gap-1">
          <GithubStatusBadge status={patch.github.status} locale={locale} />

          {patch.github.branch && (
            <a
              href={`https://github.com/${githubOwner}/${githubRepo}/tree/${patch.github.branch}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-purple-400 hover:text-purple-300 underline"
            >
              Branch: {patch.github.branch}
            </a>
          )}

          {patch.github.pullRequestNumber && (
            <a
              href={`https://github.com/${githubOwner}/${githubRepo}/pull/${patch.github.pullRequestNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 underline"
            >
              PR #{patch.github.pullRequestNumber}
            </a>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-500">-</span>
      )}
    </td>

    <td className="px-4 py-3 text-sm text-gray-300">
      {patch.patches?.length || 0} {labels.files.toLowerCase()}
    </td>
    <td className="px-4 py-3 text-sm text-gray-300">
      {patch.attempts || 1}
    </td>
    <td className="px-4 py-3 text-sm text-gray-400">
      {formatDate(patch.createdAt)}
    </td>
    <td className="px-4 py-3 text-sm">
      <button
        onClick={() => setSelectedPatch(patch)}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition"
      >
        {labels.view}
      </button>
    </td>
  </tr>
))}
```

---

### 4) جلب GitHub Owner/Repo من المشروع

**File:** `src/app/[locale]/projects/[id]/patches/page.tsx`

**أضف state جديد (بعد line 31):**

```typescript
const [githubOwner, setGithubOwner] = useState<string>('');
const [githubRepo, setGithubRepo] = useState<string>('');
```

**أضف useEffect لجلب بيانات المشروع:**

```typescript
// Load project GitHub info
useEffect(() => {
  async function loadProjectInfo() {
    try {
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      if (projectDoc.exists()) {
        const github = projectDoc.data().github;
        if (github?.owner && github?.repo) {
          setGithubOwner(github.owner);
          setGithubRepo(github.repo);
        }
      }
    } catch (err) {
      console.error('Failed to load project info:', err);
    }
  }

  loadProjectInfo();
}, [projectId]);
```

---

### 5) تحديث PatchMessage Component

**File:** `src/features/agent/PatchMessage.tsx`

**أضف بعد recovery steps section (line 251):**

```typescript
{/* Phase 83.4: GitHub Information */}
{githubInfo && (
  <div className="mt-3 pt-3 border-t border-gray-700">
    <div className="text-xs text-purple-400 mb-2">
      🔗 {locale === 'ar' ? 'تم التطبيق على GitHub' : 'Applied to GitHub'}
    </div>
    <div className="space-y-1 text-xs text-gray-300">
      <div>
        {locale === 'ar' ? 'الفرع:' : 'Branch:'}{' '}
        <span className="font-mono text-purple-300">{githubInfo.branch}</span>
      </div>
      {githubInfo.prNumber && (
        <div>
          {locale === 'ar' ? 'طلب السحب:' : 'Pull Request:'}{' '}
          <span className="font-mono text-purple-300">#{githubInfo.prNumber}</span>
        </div>
      )}
    </div>
  </div>
)}
```

---

### 6) تحديث PatchViewerModal Component

**File:** `src/components/PatchViewerModal.tsx`

**أضف props:**
```typescript
interface PatchViewerModalProps {
  // ... existing props
  githubStatus?: {
    status?: string;
    branch?: string;
    baseBranch?: string;
    pullRequestNumber?: number | null;
  };
  githubOwner?: string;
  githubRepo?: string;
  locale?: 'ar' | 'en';
}
```

**أضف GitHub section في Modal body:**

```typescript
{/* Phase 83.4: GitHub Information Section */}
{githubStatus && (
  <section className="bg-gray-800 p-4 rounded-lg space-y-2">
    <h4 className="font-medium text-sm text-white flex items-center gap-2">
      <span>GitHub Information</span>
      {githubStatus.status && <GithubStatusBadge status={githubStatus.status} locale={locale} />}
    </h4>

    {githubStatus.branch && (
      <div className="text-xs text-gray-300">
        <span className="text-gray-400">Branch:</span>{' '}
        {githubOwner && githubRepo ? (
          <a
            href={`https://github.com/${githubOwner}/${githubRepo}/tree/${githubStatus.branch}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-purple-400 hover:text-purple-300 underline"
          >
            {githubStatus.branch}
          </a>
        ) : (
          <span className="font-mono">{githubStatus.branch}</span>
        )}
      </div>
    )}

    {githubStatus.pullRequestNumber && (
      <div className="text-xs text-gray-300">
        <span className="text-gray-400">Pull Request:</span>{' '}
        {githubOwner && githubRepo ? (
          <a
            href={`https://github.com/${githubOwner}/${githubRepo}/pull/${githubStatus.pullRequestNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-400 hover:text-blue-300 underline"
          >
            PR #{githubStatus.pullRequestNumber}
          </a>
        ) : (
          <span className="font-mono">PR #{githubStatus.pullRequestNumber}</span>
        )}
      </div>
    )}

    {githubStatus.baseBranch && (
      <div className="text-xs text-gray-300">
        <span className="text-gray-400">Base Branch:</span>{' '}
        <span className="font-mono">{githubStatus.baseBranch}</span>
      </div>
    )}
  </section>
)}
```

---

### 7) تحديث GithubSettingsCard

**File:** `src/features/projects/GithubSettingsCard.tsx`

**أضف summary section (بعد sync info):**

```typescript
{github?.lastSyncedAt && (
  <div className="text-[11px] text-gray-600 mt-2 space-y-1">
    <p>
      {labels.lastSynced} {new Date(github.lastSyncedAt.seconds * 1000).toLocaleString()}
    </p>
    {github.lastSyncedBranch && (
      <p>
        {locale === 'ar' ? 'الفرع:' : 'Branch:'}{' '}
        <span className="font-mono">{github.lastSyncedBranch}</span>
      </p>
    )}
    {github.lastSyncedAt && (
      <a
        href={`https://github.com/${github.owner}/${github.repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-700 underline"
      >
        {locale === 'ar' ? 'عرض على GitHub' : 'View on GitHub'} →
      </a>
    )}
  </div>
)}
```

---

## 🔄 Sync After Merge (Optional - Phase 84)

عند merge الـ PR، يمكن عرض زر:

```typescript
{patch.github?.status === 'merged' && (
  <button
    onClick={handleSyncFromGithub}
    className="mt-2 rounded-md border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 transition"
  >
    {locale === 'ar' ? 'مزامنة آخر التغييرات من GitHub' : 'Sync latest changes from GitHub'}
  </button>
)}
```

---

## 📊 النتيجة المتوقعة

بعد Phase 83.4:

**Patches History Page:**
- عمود جديد "GitHub" بجانب Status
- Badges ملونة: `PR Opened` (أرجواني), `Applied to Branch` (أزرق), `Merged` (أخضر)
- روابط مباشرة للـ Branch والـ PR

**PatchMessage (Chat):**
- عرض GitHub Info بعد تطبيق الباتش
- رابط الفرع + رابط PR

**PatchViewerModal:**
- Section كامل لـ GitHub Information
- روابط clickable
- Status badge

**GithubSettingsCard:**
- آخر مزامنة + الفرع
- رابط "View on GitHub"

---

## 🧪 Testing Checklist

- [ ] GitHub badges تظهر بشكل صحيح في Patches History
- [ ] روابط GitHub تفتح الصفحة الصحيحة
- [ ] PatchMessage يعرض GitHub info بعد Apply to GitHub
- [ ] PatchViewerModal يعرض GitHub section
- [ ] GithubSettingsCard يعرض آخر sync
- [ ] Bilingual support يعمل (EN/AR)
- [ ] Colors صحيحة لكل status

---

## 📝 ملاحظات هامة

1. **GitHub Owner/Repo:** يجب جلبهم من `projects/{id}/github` في Firestore
2. **Status Colors:**
   - `applied_to_branch`: أزرق (bg-blue-500)
   - `pr_opened`: أرجواني (bg-purple-600)
   - `merged`: أخضر (bg-green-600)
   - `failed`/`rejected`: أحمر (bg-red-600)
3. **Links:** استخدم `target="_blank"` و `rel="noopener noreferrer"` دائماً
4. **Responsive:** تأكد إن الجدول responsive على الموبايل

---

**Phase 83.4 Status:** 📋 **Ready to Implement**

**Next Phase:** Phase 84 - Webhook Integration for PR Merge Detection (Optional)
