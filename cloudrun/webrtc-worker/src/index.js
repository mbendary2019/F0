// cloudrun/webrtc-worker/src/index.js
import express from "express";
import admin from "firebase-admin";
import wrtc from "wrtc";
const { RTCPeerConnection } = wrtc;

// Initialize Firebase Admin (Cloud Run provides ADC automatically)
let db;
try {
  db = admin.app().firestore();
} catch {
  admin.initializeApp();
  db = admin.firestore();
}

const app = express();
app.use(express.json());

const ICE = JSON.parse(process.env.ICE_SERVERS || "[]");
const THIS = process.env.F0_INSTANCE_ID || "fz-local";

async function upsertQoS(a, b, stats) {
  const id = `${a}<->${b}`;
  const qos = {
    rttMs: stats.currentRoundTripTime ? Math.round(stats.currentRoundTripTime * 1000) : undefined,
    jitterMs: stats.jitter ? Math.round(stats.jitter * 1000) : undefined,
    lossPct: stats.packetsLost && stats.packetsSent
      ? Number(((stats.packetsLost / (stats.packetsLost + stats.packetsSent)) * 100).toFixed(2))
      : undefined,
    bitrateKbps: stats.bitrateKbps,
    lastTs: Date.now(),
  };
  await db.collection("mesh_links").doc(id).set({ id, a, b, health: "up", ...qos, ts: Date.now() }, { merge: true });
}

async function buildPC(remoteId) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const dc = pc.createDataChannel("gossip", { ordered: true });
  dc.onopen = () => console.log("dc open ->", remoteId);
  dc.onmessage = (ev) => console.log("gossip msg", ev.data?.length);
  pc.oniceconnectionstatechange = () => console.log("ice", pc.iceConnectionState);
  setInterval(async () => {
    const stats = await pc.getStats();
    let s = { bitrateKbps: undefined, packetsLost: 0, packetsSent: 0, jitter: 0, currentRoundTripTime: 0 };
    stats.forEach((r) => {
      if (r.type === "outbound-rtp") { s.packetsSent += r.packetsSent || 0; s.bitrateKbps = Math.round((r.bitrateMean || 0) / 1000); }
      if (r.type === "remote-inbound-rtp") { s.packetsLost += r.packetsLost || 0; s.jitter = Math.max(s.jitter, r.jitter || 0); s.currentRoundTripTime = Math.max(s.currentRoundTripTime, r.roundTripTime || 0); }
    });
    await upsertQoS(THIS, remoteId, s);
  }, 15000);
  return { pc, dc };
}

app.post("/dial", async (req, res) => {
  const { peerTo } = req.body || {};
  if (!peerTo) return res.status(400).json({ error: "peerTo required" });
  const { pc } = await buildPC(peerTo);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return res.json({ peerFrom: THIS, peerTo, sdp: offer.sdp, ts: Date.now(), sig: "" });
});

app.post("/offer", async (req, res) => {
  const { peerFrom, peerTo, sdp } = req.body || {};
  if (peerTo !== THIS) return res.status(400).json({ error: "wrong target" });
  const { pc } = await buildPC(peerFrom);
  await pc.setRemoteDescription({ type: "offer", sdp });
  const ans = await pc.createAnswer();
  await pc.setLocalDescription(ans);
  return res.json({ peerFrom: THIS, peerTo: peerFrom, sdp: ans.sdp, ts: Date.now(), sig: "" });
});

app.post("/answer", async (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/", (_req, res) => res.json({ status: "ready", service: "webrtc-worker", instance: THIS }));

const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, "0.0.0.0", () => console.log("✅ webrtc-worker listening on port", port));
