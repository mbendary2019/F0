export type ConsensusStrategy = "majority" | "critic";

export type MeshRoute = {
  from: string;
  to: string[];
  policy: { maxHops: number; consensus: ConsensusStrategy };
};
