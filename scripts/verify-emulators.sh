#!/bin/bash
# ============================================
# Firebase Emulator Verification Script
# ============================================
# This script verifies that all Firebase emulators are running correctly

set -e

echo "🔍 Verifying Firebase Emulators..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is listening
check_port() {
  local port=$1
  local service=$2

  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ $service is running on port $port${NC}"
    return 0
  else
    echo -e "${RED}❌ $service is NOT running on port $port${NC}"
    return 1
  fi
}

# Function to check HTTP endpoint
check_http() {
  local url=$1
  local service=$2

  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|400\|404" ; then
    echo -e "${GREEN}✅ $service HTTP endpoint is responsive${NC}"
    return 0
  else
    echo -e "${RED}❌ $service HTTP endpoint is not responding${NC}"
    return 1
  fi
}

echo "Checking Firebase Emulator ports..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Emulator UI (port 4000)
check_port 4000 "Emulator UI"

# Check Auth Emulator (port 9099)
check_port 9099 "Auth Emulator"

# Check Firestore Emulator (port 8080)
check_port 8080 "Firestore Emulator"

# Check Functions Emulator (port 5001)
check_port 5001 "Functions Emulator"

# Check Storage Emulator (port 9199)
check_port 9199 "Storage Emulator" || echo -e "${YELLOW}⚠️  Storage Emulator is optional${NC}"

echo ""
echo "Checking HTTP endpoints..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Emulator UI
check_http "http://127.0.0.1:4000" "Emulator UI"

# Check Firestore REST API
check_http "http://127.0.0.1:8080" "Firestore REST API"

# Check Auth Emulator
check_http "http://127.0.0.1:9099" "Auth Emulator"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Emulator verification complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Visit Emulator UI: http://127.0.0.1:4000"
echo "  2. Check Firestore data: http://127.0.0.1:4000/firestore"
echo "  3. Check Auth users: http://127.0.0.1:4000/auth"
echo ""
echo "🚀 To start the emulators (if not running):"
echo "   firebase emulators:start --only firestore,auth,functions,storage,ui"
echo ""
