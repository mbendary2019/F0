export type Severity = "low" | "med" | "high" | "critical";

export interface Policy {
  id?: string;
  name: string;
  enabled: boolean;
  priority: number; // lower = earlier
  conditions: {
    piiLeak?: boolean;
    minToxicity?: number;
    minBias?: number;
    modelRegex?: string;
    labelsAny?: string[]; // e.g., ["toxicity","pii"]
    uidIn?: string[];     // specific user ids
  };
  actions: {
    escalateSeverity?: Severity;
    addLabels?: string[];
    autoAssignTo?: string;   // uid
    setSlaHours?: number;    // override SLA
    requireTwoPersonReview?: boolean; // (stored only; enforcement optional)
  };
}
