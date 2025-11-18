#!/bin/bash

echo "🔧 Fixing Firebase imports..."
echo ""

# Find all files importing from @/lib/firebase (excluding firebaseClient, firebaseAdmin, etc.)
FILES=$(grep -rl "from \"@/lib/firebase\"" src/ 2>/dev/null | grep -v "firebaseClient\|firebaseAdmin\|firebase-admin" | grep -E "\.(tsx|ts|jsx|js)$")

COUNT=0
for file in $FILES; do
  # Skip if already using firebaseClient
  if grep -q "from \"@/lib/firebaseClient\"" "$file"; then
    continue
  fi

  # Replace the import
  if sed -i '' 's|from "@/lib/firebase"|from "@/lib/firebaseClient"|g' "$file" 2>/dev/null; then
    echo "✅ Fixed: $file"
    COUNT=$((COUNT + 1))
  fi
done

echo ""
echo "✅ Fixed $COUNT files"
echo ""
echo "📝 Files updated:"
echo "$FILES" | head -10
echo ""
echo "🔄 Restart Next.js to apply changes:"
echo "   pkill -f 'next dev' && npm run dev"
