"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";

interface BackupCodesProps {
  onGenerated?: () => void;
}

export default function BackupCodes({ onGenerated }: BackupCodesProps) {
  const [step, setStep] = useState<"idle" | "generate" | "display">("idle");
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateCodes(): string[] {
    // Generate 10 random backup codes (8 characters each)
    const codes: string[] = [];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters

    for (let i = 0; i < 10; i++) {
      let code = "";
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      // Format as XXXX-XXXX
      code = code.slice(0, 4) + "-" + code.slice(4);
      codes.push(code);
    }

    return codes;
  }

  async function handleGenerate() {
    setStatus(null);
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setLoading(false);
        return;
      }

      // Generate backup codes
      const newCodes = generateCodes();

      // Get ID token
      const idToken = await user.getIdToken();

      // Call Firebase Function to save codes
      const response = await fetch("/api/backup-codes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          codes: newCodes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate backup codes");
      }

      setCodes(newCodes);
      setStep("display");

      if (onGenerated) {
        onGenerated();
      }
    } catch (error: any) {
      console.error("Backup codes generation error:", error);
      setStatus(error.message || "Failed to generate backup codes");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    const text = codes.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const text = `F0 Agent Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${codes.join("\n")}\n\n⚠️ Store these codes in a secure location. Each code can only be used once.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `f0-agent-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const printWindow = window.open("", "", "width=600,height=400");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>F0 Agent Backup Codes</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                padding: 40px;
                max-width: 600px;
                margin: 0 auto;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 10px;
              }
              .date {
                color: #666;
                margin-bottom: 30px;
              }
              .codes {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin: 20px 0;
              }
              .code {
                font-family: monospace;
                font-size: 16px;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
              }
              .warning {
                background: #fff3cd;
                border: 1px solid #ffc107;
                padding: 15px;
                border-radius: 4px;
                margin-top: 30px;
              }
            </style>
          </head>
          <body>
            <h1>F0 Agent Backup Codes</h1>
            <div class="date">Generated: ${new Date().toLocaleString()}</div>
            <div class="codes">
              ${codes.map((code) => `<div class="code">${code}</div>`).join("")}
            </div>
            <div class="warning">
              ⚠️ <strong>Important:</strong> Store these codes in a secure location. Each code can only be used once to recover your account.
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  return (
    <div className="space-y-4">
      {step === "idle" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Backup codes are single-use codes that can help you recover access to
            your account if you lose your authentication device.
          </p>
          <button
            onClick={() => setStep("generate")}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:bg-amber-400"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Generate Backup Codes
          </button>
        </div>
      )}

      {step === "generate" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Important</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Each code can only be used once</li>
                  <li>Store them in a secure location</li>
                  <li>Don't share them with anyone</li>
                  <li>Generating new codes will invalidate old ones</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:bg-amber-400"
            >
              {loading ? "Generating..." : "Continue"}
            </button>
            <button
              onClick={() => setStep("idle")}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "display" && codes.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">
                  Backup codes generated successfully!
                </p>
                <p className="mt-1">
                  Save these codes now. You won't be able to see them again.
                </p>
              </div>
            </div>
          </div>

          {/* Codes Display */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2">
              {codes.map((code, index) => (
                <div
                  key={index}
                  className="rounded bg-white px-3 py-2 font-mono text-sm text-slate-900"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copied ? "Copied!" : "Copy"}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print
            </button>
          </div>

          <button
            onClick={() => {
              setCodes([]);
              setStep("idle");
            }}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      )}

      {status && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {status}
        </div>
      )}
    </div>
  );
}
