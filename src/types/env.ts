export type EnvVarScope = "server" | "client" | "both";

export type ProjectEnvVar = {
  id: string;      // doc id
  key: string;
  value: string;
  scope: EnvVarScope;
  createdAt?: string;
  updatedAt?: string;
};
