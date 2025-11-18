/**
 * Phase 43.1 - WebRTC Worker (Cloud Run)
 * Real P2P DataChannel connectivity with QoS telemetry
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { RTCPeerConnection } from 'wrtc';
import { createVerify } from 'crypto';

admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(express.json());

const ICE = JSON.parse(process.env.ICE_SERVERS || '[{"urls":["stun:stun.l.google.com:19302"]}]');
const THIS = process.env.F0_INSTANCE_ID || 'fz-local';

interface RtcOfferPayload {
  peerFrom: string;
  peerTo: string;
  sdp: string;
  ts: number;
  sig: string;
}

interface LinkQoS {
  rttMs?: number;
  jitterMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
  lastTs: number;
}

function verifySig(payload: any, sigB64: string, pubKey: string): boolean {
  try {
    const v = createVerify('SHA256');
    const clean = JSON.stringify(payload);
    v.update(Buffer.from(clean));
    v.end();
    return v.verify(pubKey, Buffer.from(sigB64, 'base64'));
  } catch (error) {
    console.error('[verifySig] Error:', error);
    return false;
  }
}

async function upsertQoS(a: string, b: string, stats: any) {
  const id = `${a}<->${b}`;
  const qos: LinkQoS & { id: string; a: string; b: string; health: string; ts: number } = {
    id,
    a,
    b,
    health: 'up',
    rttMs: stats.currentRoundTripTime
      ? Math.round(stats.currentRoundTripTime * 1000)
      : undefined,
    jitterMs: stats.jitter ? Math.round(stats.jitter * 1000) : undefined,
    lossPct:
      stats.packetsLost && stats.packetsSent
        ? Number(
            ((stats.packetsLost / (stats.packetsLost + stats.packetsSent)) * 100).toFixed(2)
          )
        : undefined,
    bitrateKbps: stats.bitrateKbps,
    lastTs: Date.now(),
    ts: Date.now(),
  };

  await db.collection('mesh_links').doc(id).set(qos, { merge: true });
  console.log(`[QoS] Updated ${id}:`, qos);
}

async function buildPC(remoteId: string) {
  console.log(`[buildPC] Creating connection to ${remoteId}`);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const dc = pc.createDataChannel('gossip', { ordered: true });

  dc.onopen = () => {
    console.log(`[DataChannel] OPEN -> ${remoteId}`);
  };

  dc.onmessage = (ev) => {
    console.log(`[DataChannel] Message from ${remoteId}:`, ev.data?.length || 0, 'bytes');
    // TODO: Process gossip envelope
  };

  dc.onerror = (err) => {
    console.error(`[DataChannel] Error with ${remoteId}:`, err);
  };

  dc.onclose = () => {
    console.log(`[DataChannel] CLOSED -> ${remoteId}`);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[ICE] Connection state with ${remoteId}:`, pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    console.log(`[Connection] State with ${remoteId}:`, pc.connectionState);
  };

  // Periodic stats collection (every 15s)
  const statsInterval = setInterval(async () => {
    try {
      const stats = await pc.getStats();
      const s: any = {
        bitrateKbps: undefined,
        packetsLost: 0,
        packetsSent: 0,
        jitter: 0,
        currentRoundTripTime: 0,
      };

      stats.forEach((r: any) => {
        if (r.type === 'outbound-rtp') {
          s.packetsSent += r.packetsSent || 0;
          s.bitrateKbps = Math.round((r.bitrateMean || 0) / 1000);
        }
        if (r.type === 'remote-inbound-rtp') {
          s.packetsLost += r.packetsLost || 0;
          s.jitter = Math.max(s.jitter, r.jitter || 0);
          s.currentRoundTripTime = Math.max(s.currentRoundTripTime, r.roundTripTime || 0);
        }
      });

      await upsertQoS(THIS, remoteId, s);
    } catch (error) {
      console.error('[Stats] Error collecting stats:', error);
    }
  }, 15000);

  // Cleanup on connection close
  pc.oniceconnectionstatechange = () => {
    if (
      pc.iceConnectionState === 'failed' ||
      pc.iceConnectionState === 'disconnected' ||
      pc.iceConnectionState === 'closed'
    ) {
      clearInterval(statsInterval);
    }
  };

  return { pc, dc };
}

// POST /offer - Receive offer from remote peer, return answer
app.post('/offer', async (req, res) => {
  try {
    const { peerFrom, peerTo, sdp, ts, sig } = req.body as RtcOfferPayload;

    if (peerTo !== THIS) {
      return res.status(400).json({ error: 'Wrong target peer' });
    }

    console.log(`[/offer] Received offer from ${peerFrom}`);

    // TODO: Fetch pubKey from mesh_peers and verify signature
    // const peerDoc = await db.collection('mesh_peers').doc(peerFrom).get();
    // if (!peerDoc.exists) return res.status(403).json({ error: 'Unknown peer' });
    // const { pubKey } = peerDoc.data();
    // if (!verifySig({ peerFrom, peerTo, sdp, ts }, sig, pubKey)) {
    //   return res.status(403).json({ error: 'Invalid signature' });
    // }

    const { pc } = await buildPC(peerFrom);
    await pc.setRemoteDescription({ type: 'offer', sdp });
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);

    console.log(`[/offer] Sending answer to ${peerFrom}`);

    return res.json({
      peerFrom: THIS,
      peerTo: peerFrom,
      sdp: ans.sdp,
      ts: Date.now(),
      sig: '', // TODO: Sign with Ed25519
    });
  } catch (error: any) {
    console.error('[/offer] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /answer - Receive answer from remote peer (completes caller side)
app.post('/answer', async (req, res) => {
  try {
    const { peerFrom, peerTo, sdp } = req.body as RtcOfferPayload;

    if (peerTo !== THIS) {
      return res.status(400).json({ error: 'Wrong target peer' });
    }

    console.log(`[/answer] Received answer from ${peerFrom}`);

    // TODO: Find the pending PC and set remote description
    // For now, return OK (need to maintain PC registry by peerFrom)

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('[/answer] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /dial - Create offer to dial remote peer
app.post('/dial', async (req, res) => {
  try {
    const { peerTo } = req.body;

    console.log(`[/dial] Creating offer to ${peerTo}`);

    const { pc } = await buildPC(peerTo);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log(`[/dial] Offer created for ${peerTo}`);

    return res.json({
      peerFrom: THIS,
      peerTo,
      sdp: offer.sdp,
      ts: Date.now(),
      sig: '', // TODO: Sign with Ed25519
    });
  } catch (error: any) {
    console.error('[/dial] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /healthz - Health check
app.get('/healthz', (_, res) => {
  res.send('ok');
});

// GET / - Info
app.get('/', (_, res) => {
  res.json({
    service: 'webrtc-worker',
    instance: THIS,
    endpoints: ['/dial', '/offer', '/answer', '/healthz'],
  });
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => {
  console.log(`✅ WebRTC Worker (${THIS}) listening on port ${port}`);
  console.log(`   ICE Servers:`, ICE);
});
