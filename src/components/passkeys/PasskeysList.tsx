"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, getFirestore } from "firebase/firestore";
import { auth } from "@/lib/firebaseClient";

interface Passkey {
  id: string;
  name?: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent: string;
}

interface PasskeysListProps {
  onUpdate?: () => void;
}

export default function PasskeysList({ onUpdate }: PasskeysListProps) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const passkeysRef = collection(db, `users/${user.uid}/passkeys`);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      passkeysRef,
      (snapshot) => {
        const keys: Passkey[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          keys.push({
            id: doc.id,
            name: data.name,
            deviceType: data.deviceType || "unknown",
            backedUp: data.backedUp || false,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastUsedAt: data.lastUsedAt?.toDate() || new Date(),
            userAgent: data.userAgent || "Unknown",
          });
        });

        // Sort by most recently used
        keys.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());

        setPasskeys(keys);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading passkeys:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  async function handleRename(passkeyId: string) {
    if (!editName.trim()) {
      setStatus("Name cannot be empty");
      return;
    }

    setStatus(null);
    setActionLoading(passkeyId);

    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setActionLoading(null);
        return;
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/webauthn/passkey/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          credentialId: passkeyId,
          name: editName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to rename passkey");
      }

      setStatus("✅ Passkey renamed successfully");
      setEditingId(null);
      setEditName("");

      if (onUpdate) {
        onUpdate();
      }

      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error("Rename passkey error:", error);
      setStatus(error.message || "Failed to rename passkey");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(passkeyId: string) {
    if (
      !confirm(
        "Are you sure you want to remove this passkey? You won't be able to use it to sign in."
      )
    ) {
      return;
    }

    setStatus(null);
    setActionLoading(passkeyId);

    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus("Please sign in first");
        setActionLoading(null);
        return;
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/webauthn/passkey/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          credentialId: passkeyId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete passkey");
      }

      setStatus("✅ Passkey removed successfully");

      if (onUpdate) {
        onUpdate();
      }

      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error("Delete passkey error:", error);
      setStatus(error.message || "Failed to remove passkey");
    } finally {
      setActionLoading(null);
    }
  }

  function startEditing(passkey: Passkey) {
    setEditingId(passkey.id);
    setEditName(passkey.name || formatUserAgent(passkey.userAgent));
    setStatus(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setStatus(null);
  }

  function getDeviceIcon(deviceType: string) {
    switch (deviceType) {
      case "multiDevice":
        return (
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case "singleDevice":
        return (
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
    }
  }

  function formatUserAgent(ua: string): string {
    // Simple parsing - you can use a library like ua-parser-js for better results
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("iPad")) return "iPad";
    if (ua.includes("Mac")) return "Mac";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown Device";
  }

  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (passkeys.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Your Passkeys</h3>
        <span className="text-sm text-slate-500">{passkeys.length} {passkeys.length === 1 ? "passkey" : "passkeys"}</span>
      </div>

      <div className="space-y-3">
        {passkeys.map((passkey) => (
          <div
            key={passkey.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {editingId === passkey.id ? (
              // Edit Mode
              <div className="space-y-3">
                <div>
                  <label htmlFor={`name-${passkey.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                    Passkey Name
                  </label>
                  <input
                    id={`name-${passkey.id}`}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    placeholder="e.g., My iPhone, Work Laptop"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {editName.length}/50 characters
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRename(passkey.id)}
                    disabled={actionLoading === passkey.id || !editName.trim()}
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {actionLoading === passkey.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={actionLoading === passkey.id}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 p-2.5">
                    {getDeviceIcon(passkey.deviceType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {passkey.name || formatUserAgent(passkey.userAgent)}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last used {formatRelativeTime(passkey.lastUsedAt)}
                      </span>
                      {passkey.backedUp && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Synced
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Added {passkey.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(passkey)}
                    disabled={actionLoading === passkey.id}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    title="Rename passkey"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(passkey.id)}
                    disabled={actionLoading === passkey.id}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    title="Remove passkey"
                  >
                    {actionLoading === passkey.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {status && (
        <div
          className={`rounded-lg p-3 text-sm ${
            status.includes("✅")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
