"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseClient";

type Props = {
  projectId: string;
  isArabic: boolean;
  hasGithub: boolean;
};

type Branch = { name: string; protected?: boolean };

export function ProjectGithubActions({ projectId, isArabic, hasGithub }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [pushing, setPushing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  // لو مفيش GitHub متربط، ما نعرضش حاجة
  if (!hasGithub) return null;

  // تحميل الفروع من GitHub
  useEffect(() => {
    async function loadBranches() {
      try {
        setBranchesLoading(true);
        const callable = httpsCallable(functions, "listGitHubBranches");
        const res: any = await callable({ projectId });
        if (res?.data?.ok) {
          setBranches(res.data.branches || []);
          setCurrentBranch(res.data.currentBranch || "main");
        }
      } catch (err) {
        console.error("loadBranches error", err);
      } finally {
        setBranchesLoading(false);
      }
    }
    loadBranches();
  }, [projectId]);

  function setOk(msgAr: string, msgEn: string) {
    setErrorMsg(null);
    setStatusMsg(isArabic ? msgAr : msgEn);
  }

  function setErr(err: any, fallbackAr: string, fallbackEn: string) {
    console.error(err);
    const msg =
      (err && (err.message || err.code || String(err))) ||
      (isArabic ? fallbackAr : fallbackEn);
    setStatusMsg(null);
    setErrorMsg(msg);
  }

  // Push
  async function handlePush() {
    setPushing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const callable = httpsCallable(functions, "pushProjectToGitHub");
      await callable({ projectId });
      setOk(
        "تم إرسال التغييرات إلى GitHub بنجاح.",
        "Changes pushed to GitHub successfully."
      );
    } catch (err: any) {
      setErr(
        err,
        "حدث خطأ أثناء الإرسال إلى GitHub.",
        "Error while pushing to GitHub."
      );
    } finally {
      setPushing(false);
    }
  }

  // Sync
  async function handleSync() {
    setSyncing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const callable = httpsCallable(functions, "syncProjectFromGitHub");
      const res: any = await callable({ projectId });
      const commit = res?.data?.commit;
      setOk(
        commit
          ? `تمت المزامنة من GitHub.\nآخر Commit: ${commit.message}`
          : "تمت المزامنة من GitHub بنجاح.",
        commit
          ? `Synced from GitHub.\nLatest commit: ${commit.message}`
          : "Synced from GitHub successfully."
      );
    } catch (err: any) {
      setErr(
        err,
        "حدث خطأ أثناء المزامنة من GitHub.",
        "Error while syncing from GitHub."
      );
    } finally {
      setSyncing(false);
    }
  }

  // Deploy
  async function handleDeploy() {
    setDeploying(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const callable = httpsCallable(functions, "triggerGitHubDeploy");
      await callable({ projectId, environment: "production" });
      setOk(
        "تم إرسال أمر النشر إلى GitHub Actions.",
        "Deploy request sent to GitHub Actions."
      );
    } catch (err: any) {
      setErr(
        err,
        "حدث خطأ أثناء إرسال أمر النشر.",
        "Error while triggering deploy."
      );
    } finally {
      setDeploying(false);
    }
  }

  // تغيير الفرع الحالي
  async function handleChangeBranch(branch: string) {
    setCurrentBranch(branch);
    try {
      const callable = httpsCallable(functions, "setCurrentGitHubBranch");
      await callable({ projectId, branch });
    } catch (err) {
      console.error("setCurrentGitHubBranch error", err);
    }
  }

  // إنشاء فرع جديد
  async function handleCreateBranch() {
    if (!newBranchName.trim()) return;
    try {
      const callable = httpsCallable(functions, "createGitHubBranch");
      const res: any = await callable({
        projectId,
        name: newBranchName,
        fromBranch: currentBranch,
        setAsCurrent: true,
      });
      if (res?.data?.ok) {
        const created = res.data.branch as string;
        setBranches((prev) => [...prev, { name: created }]);
        setCurrentBranch(created);
        setNewBranchName("");
        setBranchDialogOpen(false);
        setOk(
          `تم إنشاء الفرع ${created} وتعيينه كفرع حالي.`,
          `Branch ${created} created and set as current.`
        );
      }
    } catch (err: any) {
      setErr(
        err,
        "حدث خطأ أثناء إنشاء الفرع.",
        "Error while creating branch."
      );
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Branch selector + new branch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[11px] text-gray-500">
            {isArabic ? "الفرع الحالي" : "Current branch"}
          </span>
          <select
            className="mt-1 border rounded-md px-2 py-1 text-xs"
            value={currentBranch}
            disabled={branchesLoading || branches.length === 0}
            onChange={(e) => handleChangeBranch(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setBranchDialogOpen((v) => !v)}
          className="text-xs px-3 py-1.5 border rounded-lg hover:bg-slate-50"
        >
          {isArabic ? "إنشاء فرع جديد" : "New branch"}
        </button>
      </div>

      {branchDialogOpen && (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <p className="text-xs font-medium">
            {isArabic ? "إنشاء فرع جديد من" : "Create new branch from"}{" "}
            <span className="font-mono">{currentBranch}</span>
          </p>
          <input
            className="w-full border rounded-md px-2 py-1 text-xs"
            placeholder={
              isArabic ? "مثال: feature-auth" : "e.g. feature-auth, ui-update"
            }
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1"
              onClick={() => {
                setBranchDialogOpen(false);
                setNewBranchName("");
              }}
            >
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-md bg-slate-900 text-white"
              onClick={handleCreateBranch}
            >
              {isArabic ? "إنشاء" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <button
          onClick={handlePush}
          disabled={pushing}
          className="text-xs px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-60 text-left"
        >
          {pushing
            ? isArabic
              ? "جاري الإرسال إلى GitHub..."
              : "Pushing to GitHub..."
            : isArabic
            ? "إرسال إلى GitHub (Push)"
            : "Push to GitHub"}
        </button>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-60 text-left"
        >
          {syncing
            ? isArabic
              ? "جاري المزامنة من GitHub..."
              : "Syncing from GitHub..."
            : isArabic
            ? "مزامنة من GitHub (Sync)"
            : "Sync from GitHub"}
        </button>

        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="text-xs px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-60 text-left"
        >
          {deploying
            ? isArabic
              ? "جاري إرسال أمر النشر..."
              : "Sending deploy request..."
            : isArabic
            ? "نشر عبر GitHub Actions"
            : "Deploy via GitHub Actions"}
        </button>
      </div>

      {/* Messages */}
      {statusMsg && (
        <p className="text-[11px] text-green-600 whitespace-pre-line">
          {statusMsg}
        </p>
      )}
      {errorMsg && (
        <p className="text-[11px] text-red-600 whitespace-pre-line">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
