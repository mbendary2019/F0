"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

type NotificationType =
  | "dsar_request"
  | "dsar_approved"
  | "dsar_denied"
  | "data_export_ready"
  | "account_deleted"
  | string;

interface NotificationItem {
  id: string;
  type: NotificationType;
  meta?: Record<string, any>;
  createdAt: Timestamp | number;
  read: boolean;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "notifications", user.uid, "items"),
        orderBy("createdAt", "desc")
      );

      const unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          const arr: NotificationItem[] = [];
          snap.forEach((d) => {
            arr.push({ id: d.id, ...d.data() } as NotificationItem);
          });
          setItems(arr);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching notifications:", error);
          setLoading(false);
        }
      );

      return () => unsubSnapshot();
    });

    return () => unsub();
  }, []);

  const markRead = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, "notifications", user.uid, "items", id), {
        read: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllRead = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const unreadItems = items.filter((n) => !n.read);

    try {
      await Promise.all(
        unreadItems.map((n) =>
          updateDoc(doc(db, "notifications", user.uid, "items", n.id), {
            read: true,
          })
        )
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getTimestamp = (createdAt: Timestamp | number): Date => {
    if (typeof createdAt === "number") {
      return new Date(createdAt);
    }
    return createdAt.toDate();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Notifications</h1>
        <div className="text-sm text-gray-500">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {items.some((n) => !n.read) && (
          <button
            onClick={markAllRead}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-4 transition-colors ${
              !n.read
                ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {getTitleFromType(n.type)}
                  </div>
                  {!n.read && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {getTimestamp(n.createdAt).toLocaleString()}
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="ml-4 rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Mark as read
                </button>
              )}
            </div>

            {n.meta?.message && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {n.meta.message}
              </p>
            )}

            {n.meta?.requestId && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Request ID: {n.meta.requestId}
              </p>
            )}

            {n.meta?.downloadUrl && (
              <a
                className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                href={n.meta.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Export
              </a>
            )}

            {n.meta?.deletionDate && (
              <div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm dark:bg-yellow-900/20">
                <strong>Deletion scheduled:</strong>{" "}
                {new Date(n.meta.deletionDate).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No notifications yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getTitleFromType(type: NotificationType): string {
  const titles: Record<string, string> = {
    dsar_request: "📋 We received your data request",
    dsar_approved: "✅ Your request was approved",
    dsar_denied: "❌ Your request was denied",
    data_export_ready: "📦 Your data export is ready",
    account_deleted: "🗑️ Account deletion scheduled",
  };

  return titles[type] || String(type);
}
