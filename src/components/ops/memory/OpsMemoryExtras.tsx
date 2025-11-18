"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw, Search, Play, X } from "lucide-react";

// -----------------------------------------------------------------------------
// Small util helpers
// -----------------------------------------------------------------------------
async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function fmt(ms?: number | null) {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(0).padStart(2, "0");
  return `${m}:${r} min`;
}

// -----------------------------------------------------------------------------
// Job Log Card
// -----------------------------------------------------------------------------
// Expects an API route at /api/memory/jobs?workspaceId=... returning:
// { jobs: Array<{ id: string, workspaceId: string, startedAt: string, endedAt?: string, status: "queued"|"running"|"success"|"error", durationMs?: number, counts?: { semantic?: number, temporal?: number, feedback?: number, totalEdges?: number }, errorMessage?: string }> }
// If the route is missing, the card will gracefully hide its table and show a tip.

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "secondary",
    running: "default",
    success: "success",
    error: "destructive",
  };
  const variant = (map[status] as any) || "secondary";
  return <Badge variant={variant} className="uppercase tracking-wide">{status}</Badge>;
}

export function JobLogCard({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  const fetchJobs = () => {
    startTransition(async () => {
      setError(null);
      try {
        const data = await jsonFetch<{ items: any[] }>(`/api/memory/jobs?workspaceId=${encodeURIComponent(workspaceId)}`);
        setJobs(data.items || []);
      } catch (e: any) {
        // If the route doesn't exist, we degrade gracefully
        setError(e?.message || "Failed to load jobs");
        setJobs([]);
      }
    });
  };

  const createJob = async () => {
    setCreating(true);
    try {
      await jsonFetch(`/api/memory/jobs`, {
        method: "POST",
        body: JSON.stringify({ workspaceId, type: "rebuild_graph" })
      });
      await fetchJobs();
    } catch (e: any) {
      setError(e?.message || "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const cancelJob = async (id: string) => {
    try {
      await jsonFetch(`/api/memory/jobs/${id}/cancel`, { method: "POST" });
      await fetchJobs();
    } catch (e: any) {
      setError(e?.message || "Failed to cancel job");
    }
  };

  useEffect(() => {
    if (workspaceId) fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <Card className="shadow-xl">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <CardTitle className="text-xl">Job Log</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={fetchJobs} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
            Refresh
          </Button>
          <Button size="sm" onClick={createJob} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Play className="mr-2 h-4 w-4"/>}
            Rebuild Graph
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!jobs && !error ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
        ) : null}

        {error && (
          <Alert className="mb-4">
            <AlertTitle>Jobs endpoint not found</AlertTitle>
            <AlertDescription>
              I couldn&apos;t reach <code>/api/memory/jobs</code>. The card will still work,
              but showing only a tip. You can add a tiny route that queries{" "}
              <code>ops_memory_jobs</code> and returns the last 20 entries.
            </AlertDescription>
          </Alert>
        )}

        {jobs && jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="py-2 pr-4">Job ID</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-border/40">
                    <td className="py-2 pr-4 font-mono text-xs">{j.id.slice(0, 12)}</td>
                    <td className="py-2 pr-4"><StatusPill status={j.status}/></td>
                    <td className="py-2 pr-4">{typeof j.progress === "number" ? `${j.progress}%` : "—"}</td>
                    <td className="py-2 pr-4">{fmt(j.durationMs)}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{new Date(j.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cancelJob(j.id)}
                        disabled={!['queued', 'running'].includes(j.status)}
                      >
                        <X className="mr-1 h-3 w-3"/> Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          jobs && (
            <p className="text-sm text-muted-foreground">No jobs yet. Click "Rebuild Graph" to create one.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Edge Explorer Card
// -----------------------------------------------------------------------------
// Uses /api/memory/query with either { queryText } or { nodeId }.
// Displays top related nodes with scores & reasons.

type ExplorerItem = {
  nodeId: string;
  score: number;
  reason?: string;
  preview?: string;
};

export function EdgeExplorerCard({ defaultWorkspaceId }: { defaultWorkspaceId?: string }) {
  const [workspaceId, setWorkspaceId] = useState<string>(defaultWorkspaceId || "");
  const [queryText, setQueryText] = useState<string>("");
  const [nodeId, setNodeId] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("0.75");
  const [topK, setTopK] = useState<string>("10");
  const [items, setItems] = useState<ExplorerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSearch = useMemo(() => workspaceId && (queryText || nodeId), [workspaceId, queryText, nodeId]);

  const runSearch = () => {
    if (!canSearch) return;
    startTransition(async () => {
      setError(null);
      setItems(null);
      try {
        const body: any = { workspaceId, topK: Number(topK) || 10, threshold: Number(threshold) || 0.75 };
        if (nodeId) body.nodeId = nodeId; else body.q = queryText;
        const res = await jsonFetch<{ results?: any[], items?: any[] }>("/api/memory/query", { method: "POST", body: JSON.stringify(body) });

        // Map results to ExplorerItem format - support both response formats
        const results = res.results || res.items || [];
        const mappedItems = results.map((r: any) => ({
          nodeId: r.nodeId || r.id,
          score: r.score || 0,
          reason: r.reason || r.source || r.edgeType,
          preview: r.text || r.preview || ""
        }));

        setItems(mappedItems);
      } catch (e: any) {
        setError(e?.message || "Failed to query related nodes");
      }
    });
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl">Edge Explorer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4 space-y-2">
            <Label htmlFor="ws">Workspace ID</Label>
            <Input id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="demo-workspace" />
          </div>
          <div className="md:col-span-5 space-y-2">
            <Label>Query Text (optional)</Label>
            <Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="e.g. deploy to production" />
          </div>
          <div className="md:col-span-3 space-y-2">
            <Label>By Node ID (optional)</Label>
            <Input value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="snippet_123" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-3 space-y-2">
            <Label>Threshold</Label>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="md:col-span-3 space-y-2">
            <Label>Top K</Label>
            <Input value={topK} onChange={(e) => setTopK(e.target.value)} />
          </div>
          <div className="md:col-span-6 flex items-end">
            <Button className="w-full" onClick={runSearch} disabled={!canSearch || isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
              Explore
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Query failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isPending && !items && (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Searching…</div>
        )}

        {items && (
          items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Node</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.nodeId} className="border-t border-border/50">
                      <td className="py-2 pr-4 font-medium">{it.nodeId}</td>
                      <td className="py-2 pr-4">{it.score.toFixed(3)}</td>
                      <td className="py-2 pr-4 uppercase text-muted-foreground">{it.reason || "–"}</td>
                      <td className="py-2 pr-4 max-w-[520px] truncate text-muted-foreground">{it.preview || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No related nodes found. Try lowering the threshold or increasing Top K.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Combined Section to drop under KPIs
// -----------------------------------------------------------------------------
export default function OpsMemoryExtras({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <JobLogCard workspaceId={workspaceId} />
      <EdgeExplorerCard defaultWorkspaceId={workspaceId} />
    </div>
  );
}
