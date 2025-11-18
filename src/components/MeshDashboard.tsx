/**
 * Phase 43 - Global Cognitive Mesh Dashboard
 * MVP table view - ready for 3D globe upgrade (Phase 43.3)
 */

'use client';

import { useEffect, useState } from 'react';

interface MeshPeer {
  id: string;
  pubKey: string;
  region?: string;
  endpoints: { webrtc?: string; https?: string };
  lastSeenAt?: number;
  trust?: number;
}

interface GossipEnvelope {
  id: string;
  ts: number;
  kind: 'proposal' | 'vote' | 'risk' | 'telemetry';
  payload: any;
  from: string;
  sig: string;
  parents?: string[];
}

interface MeshSnapshot {
  ts: number;
  objectCount: number;
  gossipCount: number;
  state: any;
}

interface MeshLink {
  id: string;
  a: string;
  b: string;
  health: 'up' | 'degraded' | 'down';
  rttMs?: number;
  jitterMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
  lastTs: number;
}

export default function MeshDashboard() {
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [gossip, setGossip] = useState<GossipEnvelope[]>([]);
  const [snapshot, setSnapshot] = useState<MeshSnapshot | null>(null);
  const [links, setLinks] = useState<MeshLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeer, setSelectedPeer] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [peersRes, gossipRes, snapshotRes, linksRes] = await Promise.all([
          fetch('https://meshview-vpxyxgcfbq-uc.a.run.app/peers'),
          fetch('https://meshview-vpxyxgcfbq-uc.a.run.app/gossip'),
          fetch('https://meshview-vpxyxgcfbq-uc.a.run.app/snapshot'),
          fetch('https://meshview-vpxyxgcfbq-uc.a.run.app/links'),
        ]);

        const [peersData, gossipData, snapshotData, linksData] = await Promise.all([
          peersRes.json(),
          gossipRes.json(),
          snapshotRes.json(),
          linksRes.json(),
        ]);

        setPeers(peersData.peers || []);
        setGossip(gossipData.gossip || []);
        setLinks(linksData.links || []);
        if (!snapshotData.error) {
          setSnapshot(snapshotData);
        }
      } catch (error) {
        console.error('[MeshDashboard] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    if (!selectedPeer) {
      alert('Please select a peer to connect');
      return;
    }

    try {
      console.log(`[MeshDashboard] Connecting to ${selectedPeer}...`);

      // Step 1: Create offer
      const dialRes = await fetch('/api/mesh-rtc/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerTo: selectedPeer }),
      });

      if (!dialRes.ok) {
        throw new Error(`Dial failed: ${dialRes.statusText}`);
      }

      const offer = await dialRes.json();
      console.log('[MeshDashboard] Offer created:', offer);

      // Step 2: Send offer to remote peer
      const offerRes = await fetch('/api/mesh-rtc/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offer),
      });

      if (!offerRes.ok) {
        throw new Error(`Offer failed: ${offerRes.statusText}`);
      }

      const answer = await offerRes.json();
      console.log('[MeshDashboard] Answer received:', answer);

      // Step 3: Complete connection with answer
      const answerRes = await fetch('/api/mesh-rtc/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      });

      if (!answerRes.ok) {
        throw new Error(`Answer failed: ${answerRes.statusText}`);
      }

      alert(`✅ Connected to ${selectedPeer}! Check links table for QoS.`);
    } catch (error: any) {
      console.error('[MeshDashboard] Connection error:', error);
      alert(`❌ Connection failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">⏳ Loading Mesh State...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold mb-2">🌐 Global Cognitive Mesh</h1>
        <p className="text-gray-600">
          Phase 43 - P2P Overlay Network with Gossip Replication & Trust Propagation
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Peers</div>
          <div className="text-2xl font-bold">{peers.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Gossip Messages</div>
          <div className="text-2xl font-bold">{gossip.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Merged Objects</div>
          <div className="text-2xl font-bold">{snapshot?.objectCount || 0}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Last Snapshot</div>
          <div className="text-sm font-mono">
            {snapshot?.ts ? new Date(snapshot.ts).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Peers Table */}
      <div className="border rounded-lg">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-xl font-semibold">🔗 Mesh Peers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Peer ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Region</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Trust</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Endpoint</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((peer) => (
                <tr key={peer.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{peer.id}</td>
                  <td className="px-4 py-3 text-sm">{peer.region || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded ${
                        (peer.trust || 0) >= 0.7
                          ? 'bg-green-100 text-green-800'
                          : (peer.trust || 0) >= 0.4
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {(peer.trust || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm truncate max-w-xs">
                    {peer.endpoints.https || peer.endpoints.webrtc || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {peer.lastSeenAt
                      ? new Date(peer.lastSeenAt).toLocaleString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {peers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No peers registered yet
            </div>
          )}
        </div>
      </div>

      {/* WebRTC Connection Panel */}
      <div className="border rounded-lg">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-xl font-semibold">🔗 WebRTC Connection (Phase 43.1)</h2>
        </div>
        <div className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-sm font-semibold mb-2 block">Select Peer to Connect:</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={selectedPeer}
                onChange={(e) => setSelectedPeer(e.target.value)}
              >
                <option value="">-- Select Peer --</option>
                {peers.map((peer) => (
                  <option key={peer.id} value={peer.id}>
                    {peer.id} ({peer.region || 'N/A'}) - Trust: {(peer.trust || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleConnect}
              disabled={!selectedPeer}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Create a WebRTC DataChannel connection with the selected peer. QoS metrics will appear in the links table below.
          </p>
        </div>
      </div>

      {/* Active Links Table */}
      <div className="border rounded-lg">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-xl font-semibold">📊 Active Links (QoS)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Link</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Health</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">RTT (ms)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Jitter (ms)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Loss (%)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Bitrate (kbps)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{link.id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        link.health === 'up'
                          ? 'bg-green-100 text-green-800'
                          : link.health === 'degraded'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {link.health}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{link.rttMs?.toFixed(1) || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">{link.jitterMs?.toFixed(1) || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">{link.lossPct?.toFixed(2) || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">{link.bitrateKbps || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(link.lastTs).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {links.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No active links yet - use the Connect button above to establish WebRTC connections
            </div>
          )}
        </div>
      </div>

      {/* Gossip Messages */}
      <div className="border rounded-lg">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-xl font-semibold">💬 Recent Gossip</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Kind</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">From</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Payload</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {gossip.map((g) => (
                <tr key={g.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        g.kind === 'proposal'
                          ? 'bg-blue-100 text-blue-800'
                          : g.kind === 'vote'
                          ? 'bg-green-100 text-green-800'
                          : g.kind === 'risk'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {g.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{g.from}</td>
                  <td className="px-4 py-3 text-sm max-w-md truncate">
                    {g.payload?.title ||
                      g.payload?.message ||
                      JSON.stringify(g.payload).substring(0, 100)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(g.ts).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {gossip.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No gossip messages yet
            </div>
          )}
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-sm text-gray-500 border-t pt-4">
        <p>
          🚀 Phase 43.1 - WebRTC & Weighted Gossip - Auto-refresh every 30s
        </p>
        <p className="mt-1">
          Next: Phase 43.2 (RTC DataChannel Gossip + Signatures) | Phase 43.3 (3D Globe)
        </p>
      </div>
    </div>
  );
}
