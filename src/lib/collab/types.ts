export type PeerPresence = {
  id: string;           // peer/user id
  name: string;         // display name
  color: string;        // hex/hsl color for this peer
  idle: boolean;        // true if idle
  ts: number;           // last update (ms)
  // Day 3 additions
  cursor?: { x: number; y: number; line?: number; column?: number; v: number }; // v: version seq
  selection?: {
    from: { line: number; column: number };
    to: { line: number; column: number };
    v: number;
  };
};
