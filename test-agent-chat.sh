#!/bin/bash

# Phase 74: Agent-Driven Development - Test Script

echo "🚀 Testing Agent Chat System"
echo "============================="
echo ""

# Check if Firestore Emulator is running
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Firestore Emulator running on port 8080"
else
    echo "⚠️  Firestore Emulator not running"
    echo "Start it with: firebase emulators:start --only firestore"
    exit 1
fi

# Check if dev server is running
if lsof -Pi :3030 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Dev server running on port 3030"
else
    echo "⚠️  Dev server not running on port 3030"
    echo "Start it with: PORT=3030 pnpm dev"
    exit 1
fi

echo ""
echo "📋 Test Instructions:"
echo "===================="
echo ""
echo "1. Open your browser: http://localhost:3030/ar/projects/test-project-1"
echo ""
echo "2. Mock Mode should be OFF (you should see the chat panel)"
echo ""
echo "3. Type a message in the chat, for example:"
echo "   'Create a simple e-commerce platform with the following phases:"
echo "    1) Setup and Authentication"
echo "    2) Product Catalog"
echo "    3) Shopping Cart'"
echo ""
echo "4. The agent should:"
echo "   ✅ Parse the message"
echo "   ✅ Extract phases (1, 2, 3)"
echo "   ✅ Create tasks for each phase"
echo "   ✅ Sync to Firestore"
echo ""
echo "5. Check Firestore UI: http://localhost:4000/firestore"
echo "   Navigate to: projects/test-project-1/phases"
echo "   Navigate to: projects/test-project-1/tasks"
echo ""
echo "6. You should see:"
echo "   - 3 phases created"
echo "   - Tasks created for each phase"
echo "   - Activity log entries"
echo ""
echo "✨ Ready to test!"
echo ""
