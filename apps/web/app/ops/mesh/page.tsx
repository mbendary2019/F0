'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface MeshPeer {
  id: string;
  region?: string;
  trust?: number;
  endpoints?: { webrtc?: string; https?: string };
  lastSeenAt?: number;
}

interface MeshLink {
  id: string;
  a: string;
  b: string;
  rttMs?: number;
  health: 'up' | 'degraded' | 'down';
}

interface MeshSnapshot {
  ts: number;
  objectCount: number;
  gossipCount: number;
  state: Record<string, any>;
}

export default function MeshPage() {
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [links, setLinks] = useState<MeshLink[]>([]);
  const [snapshot, setSnapshot] = useState<MeshSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/mesh/peers').then((r) => r.json()),
      fetch('/api/mesh/links').then((r) => r.json()),
      fetch('/api/mesh/snapshot').then((r) => r.json()),
    ])
      .then(([peersData, linksData, snapshotData]) => {
        setPeers(peersData.peers || []);
        setLinks(linksData.links || []);
        setSnapshot(snapshotData);
      })
      .catch((error) => {
        console.error('Failed to load mesh data:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold mb-4">Global Cognitive Mesh</div>
        <div className="text-sm opacity-70">Loading mesh data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold">Global Cognitive Mesh</div>

      <Card className="p-4">
        <div className="text-sm opacity-70">
          Peers: {peers.length} • Links: {links.length} • Snapshot Objects:{' '}
          {snapshot?.objectCount || 0}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Peers Panel */}
        <Card className="p-4">
          <div className="text-lg font-semibold mb-2">Mesh Peers</div>
          <div className="max-h-[50vh] overflow-auto text-xs space-y-2">
            {peers.length === 0 ? (
              <div className="opacity-70">No peers registered yet</div>
            ) : (
              peers.map((peer, i) => (
                <div
                  key={i}
                  className="border-b border-white/10 pb-2 last:border-0"
                >
                  <div className="font-medium">
                    {peer.id} • trust {((peer.trust || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="opacity-70">
                    {peer.region || 'unknown region'} •{' '}
                    {peer.endpoints?.https || 'no endpoint'}
                  </div>
                  {peer.lastSeenAt && (
                    <div className="opacity-50 text-[10px]">
                      Last seen:{' '}
                      {new Date(peer.lastSeenAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Links Panel */}
        <Card className="p-4">
          <div className="text-lg font-semibold mb-2">Mesh Links</div>
          <div className="max-h-[50vh] overflow-auto text-xs space-y-2">
            {links.length === 0 ? (
              <div className="opacity-70">No links established yet</div>
            ) : (
              links.map((link, i) => (
                <div
                  key={i}
                  className="border-b border-white/10 pb-2 last:border-0"
                >
                  <div className="font-medium">
                    {link.a} ↔ {link.b}
                  </div>
                  <div className="opacity-70">
                    rtt ~{Math.round(link.rttMs || 0)}ms • {link.health}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Snapshot Panel */}
      <Card className="p-4">
        <div className="text-lg font-semibold mb-2">Latest Snapshot</div>
        {snapshot ? (
          <div className="space-y-2">
            <div className="text-xs opacity-70">
              Timestamp: {new Date(snapshot.ts).toLocaleString()} • Objects:{' '}
              {snapshot.objectCount} • Gossip: {snapshot.gossipCount}
            </div>
            <pre className="text-xs bg-black/20 p-3 rounded-xl overflow-auto max-h-[40vh]">
              {JSON.stringify(snapshot.state, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="text-sm opacity-70">
            No snapshot available yet. Wait for meshReduce scheduler to run.
          </div>
        )}
      </Card>

      {/* Info Panel */}
      <Card className="p-4 bg-blue-500/10">
        <div className="text-sm font-semibold mb-2">ℹ️ Phase 43 MVP</div>
        <div className="text-xs opacity-80 space-y-1">
          <div>
            • Register peers via <code className="bg-black/30 px-1 rounded">meshBeacon</code>
          </div>
          <div>
            • Send gossip via <code className="bg-black/30 px-1 rounded">meshGossip</code>
          </div>
          <div>
            • Snapshot reduces every 5 minutes via{' '}
            <code className="bg-black/30 px-1 rounded">meshReduce</code>
          </div>
          <div>
            • Trust flows every 30 minutes via{' '}
            <code className="bg-black/30 px-1 rounded">trustFlow</code>
          </div>
          <div>• Future: 3D globe visualization with Cesium/Three.js</div>
        </div>
      </Card>
    </div>
  );
}
