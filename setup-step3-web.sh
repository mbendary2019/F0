#!/usr/bin/env bash
set -euo pipefail
cd /Users/abdo/Downloads/from-zero
mkdir -p apps/web && cd apps/web
CI=1 npx create-next-app@latest . \
  --ts --eslint --tailwind --app --src-dir --no-import-alias
pnpm add @f0/ui @f0/sdk
cat > src/app/layout.tsx <<'TSX'
import './globals.css';
import { Sidebar } from '@f0/ui';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0c14] text-white">
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
TSX
mkdir -p src/app/{dashboard,projects,agents,marketplace,wallet,docs,settings}
for p in dashboard projects agents marketplace wallet docs settings; do
  cat > "src/app/$p/page.tsx" <<EOF
export default function Page(){
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">$p</h1>
      <div className="h-64 rounded-2xl bg-white/5 border border-white/10" />
    </div>
  );
}
EOF
done
cat > .env.local.example <<'ENV'
NEXT_PUBLIC_F0_API_BASE=http://localhost:8080
NEXT_PUBLIC_F0_API_KEY=
ENV
cd /Users/abdo/Downloads/from-zero
pnpm --filter @f0/ui build
pnpm --filter @f0/sdk build
pnpm --filter web build
echo "✅ Step 3 complete. Run: pnpm --filter web dev"
