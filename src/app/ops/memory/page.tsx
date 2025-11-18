import OpsMemoryExtras from "@/components/ops/memory/OpsMemoryExtras";

export const dynamic = "force-dynamic";

export default function MemoryOpsPage() {
  const workspaceId = "demo"; // غيّر حسب الحاجة

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Memory Ops Dashboard</h1>
      <OpsMemoryExtras workspaceId={workspaceId} />
    </div>
  );
}
