"use client";

import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export type GodaddyRecord = {
  type: string;   // "A" | "CNAME" | ...
  name: string;   // "@" | "www" | "app" ...
  data: string;   // target
  ttl?: number;
};

type RecordsResponse = {
  ok: boolean;
  records: GodaddyRecord[];
};

export function useGodaddyDnsRecords(domain: string | null) {
  const [records, setRecords] = useState<GodaddyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!domain) return;

    const fetchRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        const functions = getFunctions(app);
        const fn = httpsCallable<{ domain: string }, RecordsResponse>(
          functions,
          "getDNSRecords"
        );
        const res = await fn({ domain });

        if (res.data?.ok) {
          setRecords(res.data.records ?? []);
        } else {
          setError("Failed to load DNS records");
        }
      } catch (err: any) {
        console.error("[GoDaddy] getDNSRecords error", err);
        setError(err?.message || "Failed to load DNS records");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [domain]);

  return { records, loading, error, setRecords };
}
