#!/usr/bin/env bash
#
# Seed Phase 44 initial data
#

set -euo pipefail

echo "🌱 Seeding Phase 44 data..."
echo ""

# Branding preset
echo "1️⃣ Creating branding preset..."
firebase firestore:write ops_branding/prod "$(cat <<'EOF'
{
  "primaryColor": "#7C3AED",
  "accentColor": "#22D3EE",
  "logoUrl": "/logo.svg",
  "mascot": {
    "name": "F0 Spark",
    "mood": "friendly",
    "svgUrl": "/mascots/example-mascot.svg"
  },
  "routes": [
    { "path": "/dashboard", "label": "Dashboard", "visible": true },
    { "path": "/ops/marketplace", "label": "Marketplace", "visible": true },
    { "path": "/ops/branding", "label": "Branding", "visible": true },
    { "path": "/ops/assets", "label": "Assets", "visible": true }
  ]
}
EOF
)"

# Marketplace items
echo "2️⃣ Creating marketplace items..."

firebase firestore:write ops_marketplace_items/branding-pack "$(cat <<'EOF'
{
  "title": "Branding Quick Start",
  "category": "branding",
  "brief": "Preset colors, routes, and a mascot for instant brand identity",
  "installScript": "applyBrandingPreset:v1",
  "docsUrl": "https://docs.example.com/branding-pack",
  "verified": true
}
EOF
)"

firebase firestore:write ops_marketplace_items/analytics-pro "$(cat <<'EOF'
{
  "title": "Analytics Pro",
  "category": "analytics",
  "brief": "Advanced metrics dashboard with real-time charts",
  "installScript": "enableAnalyticsPro:v1",
  "docsUrl": "https://docs.example.com/analytics-pro",
  "verified": true
}
EOF
)"

firebase firestore:write ops_marketplace_items/dark-mode "$(cat <<'EOF'
{
  "title": "Dark Mode Theme",
  "category": "ui",
  "brief": "Beautiful dark theme with customizable accent colors",
  "installScript": "applyDarkTheme:v1",
  "docsUrl": "https://docs.example.com/dark-mode",
  "verified": false
}
EOF
)"

echo ""
echo "✅ Phase 44 data seeded successfully!"
echo ""
echo "📋 Created:"
echo "   - Branding preset (ops_branding/prod)"
echo "   - 3 marketplace items:"
echo "     • Branding Quick Start ✓"
echo "     • Analytics Pro ✓"
echo "     • Dark Mode Theme"
echo ""
echo "🔍 View in console:"
echo "   firebase firestore:get ops_branding/prod"
echo "   firebase firestore:get ops_marketplace_items"
echo ""
