"use client";

import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export type GodaddyDomain = {
  domain: string;
  status?: string;
  expires?: string;
};

type DomainsResponse = {
  ok: boolean;
  domains: GodaddyDomain[];
};

export function useGodaddyDomains() {
  const [domains, setDomains] = useState<GodaddyDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDomains = async () => {
      setLoading(true);
      setError(null);

      try {
        const functions = getFunctions(app);
        const fn = httpsCallable<{}, DomainsResponse>(
          functions,
          "getGoDaddyDomains"
        );
        const res = await fn({});

        if (res.data?.ok) {
          setDomains(res.data.domains ?? []);
        } else {
          setError("Failed to load domains from GoDaddy");
        }
      } catch (err: any) {
        console.error("[GoDaddy] getGoDaddyDomains error", err);
        setError(err?.message || "Failed to load GoDaddy domains");
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
  }, []);

  return { domains, loading, error, reload: () => window.location.reload() };
}
