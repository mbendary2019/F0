#!/usr/bin/env bash
# F0 Development Process Cleanup
# Kills stray dev processes (Next.js, Electron, Flutter)

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Cleaning up stray dev processes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

KILLED=0

# Kill Electron processes
if pkill -f "electron" 2>/dev/null; then
    echo "✅ Killed Electron processes"
    ((KILLED++))
fi

# Kill Next.js dev server
if pkill -f "next-server" 2>/dev/null; then
    echo "✅ Killed Next.js dev server"
    ((KILLED++))
fi

# Kill generic Next.js
if pkill -f "next dev" 2>/dev/null; then
    echo "✅ Killed Next.js processes"
    ((KILLED++))
fi

# Kill node dev servers
if pkill -f "node.*server" 2>/dev/null; then
    echo "✅ Killed Node dev servers"
    ((KILLED++))
fi

# Kill Flutter processes
if pkill -f "flutter" 2>/dev/null; then
    echo "✅ Killed Flutter processes"
    ((KILLED++))
fi

# Kill Dart processes
if pkill -f "dart" 2>/dev/null; then
    echo "✅ Killed Dart processes"
    ((KILLED++))
fi

# Kill any Firebase emulators
if pkill -f "firebase.*emulators" 2>/dev/null; then
    echo "✅ Killed Firebase emulators"
    ((KILLED++))
fi

echo ""
if [ $KILLED -eq 0 ]; then
    echo "ℹ️  No stray processes found"
else
    echo "✅ Cleanup complete! Killed $KILLED process groups"
fi
echo ""
