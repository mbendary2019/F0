#!/bin/bash

echo "📤 Sending test gossip messages..."

# Gossip 1: Proposal from Kuwait
echo "1. Proposal from fz-kuwait..."
curl -X POST https://meshgossip-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"ge_001\",
    \"ts\": $(date +%s)000,
    \"kind\": \"proposal\",
    \"payload\": {
      \"id\": \"prop_001\",
      \"title\": \"زيادة حد استخدام API\",
      \"description\": \"رفع الحد من 1000 إلى 5000 طلب/ساعة\",
      \"proposedBy\": \"fz-kuwait\"
    },
    \"from\": \"fz-kuwait\",
    \"sig\": \"sig_demo_001\"
  }"

echo -e "\n"

# Gossip 2: Vote from Riyadh
echo "2. Vote from fz-riyadh..."
curl -X POST https://meshgossip-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"ge_002\",
    \"ts\": $(date +%s)000,
    \"kind\": \"vote\",
    \"payload\": {
      \"id\": \"vote_001\",
      \"proposalId\": \"prop_001\",
      \"vote\": \"approve\",
      \"votedBy\": \"fz-riyadh\"
    },
    \"from\": \"fz-riyadh\",
    \"sig\": \"sig_demo_002\",
    \"parents\": [\"ge_001\"]
  }"

echo -e "\n"

# Gossip 3: Risk alert from Cairo
echo "3. Risk alert from fz-cairo..."
curl -X POST https://meshgossip-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"ge_003\",
    \"ts\": $(date +%s)000,
    \"kind\": \"risk\",
    \"payload\": {
      \"id\": \"risk_001\",
      \"component\": \"api_gateway\",
      \"level\": \"medium\",
      \"message\": \"معدل الفشل وصل 2.5%\",
      \"detectedBy\": \"fz-cairo\"
    },
    \"from\": \"fz-cairo\",
    \"sig\": \"sig_demo_003\"
  }"

echo -e "\n"

# Gossip 4: Telemetry from Kuwait
echo "4. Telemetry from fz-kuwait..."
curl -X POST https://meshgossip-vpxyxgcfbq-uc.a.run.app \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"ge_004\",
    \"ts\": $(date +%s)000,
    \"kind\": \"telemetry\",
    \"payload\": {
      \"id\": \"telem_001\",
      \"metrics\": {
        \"cpu\": 45,
        \"memory\": 62,
        \"latency_p95\": 180
      },
      \"region\": \"ME\",
      \"from\": \"fz-kuwait\"
    },
    \"from\": \"fz-kuwait\",
    \"sig\": \"sig_demo_004\"
  }"

echo -e "\n\n✅ All gossip messages sent!"
