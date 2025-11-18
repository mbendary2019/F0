#!/usr/bin/env bash
set -euo pipefail

echo "📦 Phase 47: Teams, Seats & RBAC - Deployment"
echo ""

# Build functions
echo "🔨 Building functions..."
pushd functions >/dev/null
npm run build
popd >/dev/null

echo ""
echo "🚀 Deploying Phase 47 functions..."
firebase deploy --only \
  functions:createOrg,\
functions:updateOrg,\
functions:deleteOrg,\
functions:inviteMember,\
functions:acceptInvite,\
functions:removeMember,\
functions:updateRole,\
functions:updateSeats,\
firestore:rules

echo ""
echo "✅ Phase 47 Deployed Successfully!"
echo ""
echo "📋 Deployed Functions:"
echo "  - createOrg (callable)"
echo "  - updateOrg (callable)"
echo "  - deleteOrg (callable)"
echo "  - inviteMember (callable)"
echo "  - acceptInvite (callable)"
echo "  - removeMember (callable)"
echo "  - updateRole (callable)"
echo "  - updateSeats (callable)"
echo ""
echo "🔐 Firestore Rules:"
echo "  - ops_orgs (member read, CF write)"
echo "  - ops_org_members (member read, CF write)"
echo "  - ops_org_invites (member/invitee read, CF write)"
echo ""
echo "📝 Next Steps:"
echo "  1. Run: ./scripts/seed-phase47-demo.js"
echo "  2. Run: ./scripts/test-phase47-smoke.sh"
echo "  3. Test org creation and member invites"
echo ""
