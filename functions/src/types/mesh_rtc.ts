/**
 * Phase 43.1 - WebRTC Mesh Types
 * Real-time P2P connectivity with STUN/TURN
 */

export interface RtcOfferPayload {
  peerFrom: string;
  peerTo: string;
  sdp: string;
  ts: number;
  sig: string;
}

export interface RtcAnswerPayload {
  peerFrom: string;
  peerTo: string;
  sdp: string;
  ts: number;
  sig: string;
}

export interface LinkQoS {
  rttMs?: number;
  jitterMs?: number;
  lossPct?: number;
  bitrateKbps?: number;
  lastTs: number;
}

export interface RtcDialRequest {
  peerTo: string;
}

export interface RtcOfferRequest extends RtcOfferPayload {}

export interface RtcAnswerRequest extends RtcAnswerPayload {}

export interface RtcStatsReport {
  type: string;
  packetsLost?: number;
  packetsSent?: number;
  jitter?: number;
  currentRoundTripTime?: number;
  roundTripTime?: number;
  bitrateMean?: number;
}
