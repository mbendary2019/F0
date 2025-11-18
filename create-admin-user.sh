#!/bin/bash

echo "🔐 Creating Admin User..."
echo ""

# Create user
echo "1️⃣ Creating user account..."
RESPONSE=$(curl -s -X POST \
  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"admin123456","returnSecureToken":true}')

# Extract UID
UID=$(echo "$RESPONSE" | grep -o '"localId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$UID" ]; then
  echo "❌ Failed to create user or extract UID"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ User created"
echo "   Email: admin@test.com"
echo "   Password: admin123456"
echo "   UID: $UID"
echo ""

# Set admin claims
echo "2️⃣ Setting admin claims..."
CLAIMS_RESPONSE=$(curl -s -X POST \
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/from-zero-84253/accounts:update?key=fake-api-key" \
  -H 'Content-Type: application/json' \
  -d "{\"localId\":\"$UID\",\"customAttributes\":\"{\\\"admin\\\":true,\\\"role\\\":\\\"admin\\\",\\\"pro\\\":true}\"}")

echo "✅ Admin claims set"
echo ""

# Verify
echo "3️⃣ Verifying claims..."
curl -s "http://127.0.0.1:9099/emulator/v1/projects/from-zero-84253/accounts/$UID" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); claims = json.loads(data.get('customAttributes', '{}')); print('   Claims:', claims)" 2>/dev/null || echo "   (verification step optional)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Open: http://localhost:3000/login"
echo "2. Login with:"
echo "   Email: admin@test.com"
echo "   Password: admin123456"
echo "3. Open Dashboard: http://localhost:3000/ar/ops/incidents"
echo ""
