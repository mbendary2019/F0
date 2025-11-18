#!/usr/bin/env bash
set -euo pipefail
echo "🧹 Killing all dev processes..."
pkill -f "firebase|node|npm|next|vite|electron" 2>/dev/null || true
sleep 1
pkill -9 -f "firebase|node|npm|next|vite|electron" 2>/dev/null || true
echo "🔌 Freeing ports..."
for p in 3000 5173 5001 8080 8085 8787; do
  PID=$(lsof -ti tcp:$p) && [ -n "$PID" ] && kill -9 $PID || true
done
echo "✅ Cleanup complete!"
lsof -nP -iTCP -sTCP:LISTEN | egrep ":3000|:5173|:5001|:8080|:8085|:8787" || true
