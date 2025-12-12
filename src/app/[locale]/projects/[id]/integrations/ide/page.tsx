// src/app/[locale]/projects/[id]/integrations/ide/page.tsx
"use client";

import { useParams } from "next/navigation";
import { NeonPageShell, NeonCard, NeonButton, NeonBadge } from "@/components/neon";
import { useState } from "react";

export default function ProjectIDEPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [bridgeStatus, setBridgeStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  const handleConnectIDE = () => {
    setBridgeStatus("connecting");
    // Simulate connection
    setTimeout(() => {
      setBridgeStatus("connected");
    }, 2000);
  };

  return (
    <NeonPageShell
      title="IDE Integration"
      subtitle="Connect VS Code to F0 for real-time collaboration"
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: projectId, href: `/projects/${projectId}` },
        { label: "Integrations", href: `/projects/${projectId}/integrations` },
        { label: "IDE" },
      ]}
    >
      <div className="space-y-6">
        {/* Connection Status */}
        <NeonCard
          title="VS Code Bridge"
          subtitle="Real-time IDE integration with F0 platform"
          tone="accent"
          badge={
            <NeonBadge tone={bridgeStatus === "connected" ? "success" : "neutral"}>
              {bridgeStatus === "connected" ? "Connected" : bridgeStatus === "connecting" ? "Connecting..." : "Disconnected"}
            </NeonBadge>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              The VS Code Bridge allows you to sync your local development environment with F0.
              You can edit files, run commands, and collaborate in real-time.
            </p>

            {bridgeStatus === "disconnected" && (
              <NeonButton variant="primary" onClick={handleConnectIDE}>
                Connect VS Code
              </NeonButton>
            )}

            {bridgeStatus === "connecting" && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7F5CFF] border-t-transparent"></div>
                Establishing connection...
              </div>
            )}

            {bridgeStatus === "connected" && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-sm text-green-400">
                  ✓ VS Code Bridge is active. Changes will sync automatically.
                </p>
              </div>
            )}
          </div>
        </NeonCard>

        {/* Setup Instructions */}
        <NeonCard
          title="Setup Instructions"
          subtitle="How to connect your local VS Code to F0"
          tone="neutral"
        >
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <h4 className="mb-2 font-semibold text-slate-50">Step 1: Install the extension</h4>
              <code className="block rounded-lg bg-[#030314] p-3 text-xs text-slate-400">
                # Install F0 VS Code Extension from the marketplace
                <br />
                code --install-extension f0-platform.f0-vscode-bridge
              </code>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-slate-50">Step 2: Run the bridge server</h4>
              <code className="block rounded-lg bg-[#030314] p-3 text-xs text-slate-400">
                pnpm f0:bridge
              </code>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-slate-50">Step 3: Authenticate</h4>
              <p className="text-slate-400">
                The bridge will open a browser window to authenticate. Once completed, your IDE will be connected.
              </p>
            </div>
          </div>
        </NeonCard>

        {/* Features Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <NeonCard title="Real-time Sync" tone="neutral">
            <p className="text-sm text-slate-400">
              Changes in VS Code are automatically synced to F0 and vice versa. No manual git operations needed.
            </p>
          </NeonCard>

          <NeonCard title="Collaborative Editing" tone="neutral">
            <p className="text-sm text-slate-400">
              Multiple developers can work on the same project simultaneously with live cursors and presence.
            </p>
          </NeonCard>

          <NeonCard title="Agent Integration" tone="neutral">
            <p className="text-sm text-slate-400">
              F0 agents can suggest code changes directly in your editor with inline diffs and explanations.
            </p>
          </NeonCard>

          <NeonCard title="Deployment Triggers" tone="neutral">
            <p className="text-sm text-slate-400">
              Push to deploy. Every save can trigger automated builds and deployments to Vercel.
            </p>
          </NeonCard>
        </div>

        {/* Bridge Status Details */}
        {bridgeStatus === "connected" && (
          <NeonCard title="Connection Details" tone="success">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Bridge Version:</span>
                <span className="text-slate-50">v1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">WebSocket Status:</span>
                <span className="text-green-400">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Latency:</span>
                <span className="text-slate-50">12ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Files Synced:</span>
                <span className="text-slate-50">47 files</span>
              </div>
            </div>
          </NeonCard>
        )}
      </div>
    </NeonPageShell>
  );
}
