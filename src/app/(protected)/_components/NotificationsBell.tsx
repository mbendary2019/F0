"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";
import Link from "next/link";

export default function NotificationsBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        setUnread(0);
        return;
      }

      const q = query(
        collection(db, "notifications", user.uid, "items"),
        where("read", "==", false)
      );

      const unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          setUnread(snap.size);
        },
        (error) => {
          console.error("Error fetching notifications:", error);
          setUnread(0);
        }
      );

      return () => unsubSnapshot();
    });

    return () => unsub();
  }, []);

  const badge = useMemo(() => {
    if (unread === 0) return null;

    return (
      <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
        {unread > 99 ? "99+" : unread}
      </span>
    );
  }, [unread]);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6 text-gray-700 dark:text-gray-200"
        aria-hidden="true"
      >
        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5L4 18v2h16v-2l-2-2Z" />
      </svg>
      {badge}
    </Link>
  );
}
