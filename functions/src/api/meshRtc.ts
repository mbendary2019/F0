/**
 * Phase 43.1 - Mesh RTC API
 * Proxy endpoints for WebRTC signaling (dial/offer/answer)
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const db = admin.firestore();

function isAdmin(req: any): boolean {
  return req.auth?.token?.admin === true;
}

function isService(req: any): boolean {
  return req.auth?.token?.role === 'service' || isAdmin(req);
}

export const apiMeshRtc = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // Auth check - allow public for demo, uncomment for production
      // if (!isService(req)) {
      //   res.status(403).json({ error: 'Unauthorized' });
      //   return;
      // }

      const { method, url } = req;
      const path = new URL(url || '', `http://${req.headers.host}`).pathname;

      // POST /api/mesh-rtc/dial - Create offer to dial remote peer
      if (method === 'POST' && path.endsWith('/dial')) {
        const { peerTo } = req.body;

        if (!peerTo) {
          res.status(400).json({ error: 'peerTo required' });
          return;
        }

        // Get local worker URL from env or config
        const localWorkerUrl =
          process.env.WEBRTC_WORKER_URL || 'http://localhost:8080';

        console.log(`[apiMeshRtc] Dialing ${peerTo} via ${localWorkerUrl}`);

        try {
          const response = await fetch(`${localWorkerUrl}/dial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerTo }),
            timeout: 10000,
          } as any);

          if (!response.ok) {
            const error = await response.text();
            res.status(response.status).json({ error });
            return;
          }

          const offer = await response.json();
          res.status(200).json(offer);
          return;
        } catch (error: any) {
          console.error('[apiMeshRtc] Dial error:', error);
          res.status(500).json({ error: error.message });
          return;
        }
      }

      // POST /api/mesh-rtc/offer - Forward offer to remote peer
      if (method === 'POST' && path.endsWith('/offer')) {
        const { peerFrom, peerTo, sdp, ts, sig } = req.body;

        if (!peerTo || !sdp) {
          res.status(400).json({ error: 'peerTo and sdp required' });
          return;
        }

        // Get remote peer's worker URL
        const peerDoc = await db.collection('mesh_peers').doc(peerTo).get();

        if (!peerDoc.exists) {
          res.status(404).json({ error: 'Peer not found' });
          return;
        }

        const peerData = peerDoc.data() as any;
        const workerUrl = peerData.endpoints?.webrtc;

        if (!workerUrl) {
          res.status(400).json({ error: 'Peer has no WebRTC endpoint' });
          return;
        }

        console.log(`[apiMeshRtc] Forwarding offer to ${peerTo} at ${workerUrl}`);

        try {
          const response = await fetch(`${workerUrl}/offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerFrom, peerTo, sdp, ts, sig }),
            timeout: 10000,
          } as any);

          if (!response.ok) {
            const error = await response.text();
            res.status(response.status).json({ error });
            return;
          }

          const answer = await response.json();
          res.status(200).json(answer);
          return;
        } catch (error: any) {
          console.error('[apiMeshRtc] Offer forward error:', error);
          res.status(500).json({ error: error.message });
          return;
        }
      }

      // POST /api/mesh-rtc/answer - Forward answer to remote peer
      if (method === 'POST' && path.endsWith('/answer')) {
        const { peerFrom, peerTo, sdp, ts, sig } = req.body;

        if (!peerTo || !sdp) {
          res.status(400).json({ error: 'peerTo and sdp required' });
          return;
        }

        // Get remote peer's worker URL
        const peerDoc = await db.collection('mesh_peers').doc(peerTo).get();

        if (!peerDoc.exists) {
          res.status(404).json({ error: 'Peer not found' });
          return;
        }

        const peerData = peerDoc.data() as any;
        const workerUrl = peerData.endpoints?.webrtc;

        if (!workerUrl) {
          res.status(400).json({ error: 'Peer has no WebRTC endpoint' });
          return;
        }

        console.log(`[apiMeshRtc] Forwarding answer to ${peerTo} at ${workerUrl}`);

        try {
          const response = await fetch(`${workerUrl}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerFrom, peerTo, sdp, ts, sig }),
            timeout: 10000,
          } as any);

          if (!response.ok) {
            const error = await response.text();
            res.status(response.status).json({ error });
            return;
          }

          const result = await response.json();
          res.status(200).json(result);
          return;
        } catch (error: any) {
          console.error('[apiMeshRtc] Answer forward error:', error);
          res.status(500).json({ error: error.message });
          return;
        }
      }

      // GET /api/mesh-rtc/links - Get active links with QoS
      if (method === 'GET' && path.endsWith('/links')) {
        const linksSnap = await db
          .collection('mesh_links')
          .orderBy('lastTs', 'desc')
          .limit(100)
          .get();

        const links = linksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        res.status(200).json({ links, count: links.length });
        return;
      }

      res.status(404).json({ error: 'Endpoint not found' });
    } catch (error: any) {
      console.error('[apiMeshRtc] Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);
