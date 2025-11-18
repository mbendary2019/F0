# Phase 61 Day 2: Testing Guide

## Prerequisites

1. **Start Dev Server**:
   ```bash
   PORT=3030 pnpm dev
   ```

2. **Get Firebase Auth Token**:
   ```bash
   # Option 1: From browser console (when logged in)
   firebase.auth().currentUser.getIdToken().then(t => console.log(t))

   # Option 2: Set as environment variable
   export FIREBASE_TOKEN="your-token-here"
   ```

## Test Sequence

### 1. Create Initial Model

First calibration creates the baseline model (v0):

```bash
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Initial baseline model"
  }'
```

**Expected Response**:
```json
{
  "ok": true,
  "version": "v1a2b_1699...",
  "weights": {
    "citation": 0.35,
    "context": 0.25,
    "source": 0.2,
    "relevance": 0.2
  },
  "thresholds": {
    "default": 0.55,
    "critic": 0.6,
    "majority": 0.5
  },
  "metrics": {
    "accuracy": 0,
    "samples": 0
  },
  "calibrationTimeMs": 50,
  "baseModel": "v0"
}
```

### 2. Label Validation Samples

#### Sample 1: Low Quality (Should Fail)

```bash
curl -X POST http://localhost:3030/api/ops/validate/sample \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_test_1",
    "goal": "Explain memory timeline implementation",
    "subscores": {
      "citation": 0.16,
      "context": 0.3,
      "source": 0.4,
      "relevance": 0.5
    },
    "pass": false,
    "strategy": "critic"
  }'
```

**Expected**: `{"ok": true, "sessionId": "sess_test_1", "pass": false}`

#### Sample 2: High Quality (Should Pass)

```bash
curl -X POST http://localhost:3030/api/ops/validate/sample \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_test_2",
    "goal": "Explain memory timeline implementation",
    "subscores": {
      "citation": 0.66,
      "context": 0.85,
      "source": 0.7,
      "relevance": 0.8
    },
    "pass": true,
    "strategy": "critic"
  }'
```

#### Sample 3: Medium Quality (Pass for Majority)

```bash
curl -X POST http://localhost:3030/api/ops/validate/sample \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_test_3",
    "goal": "How do I deploy this project?",
    "subscores": {
      "citation": 0.5,
      "context": 0.6,
      "source": 0.55,
      "relevance": 0.65
    },
    "pass": true,
    "strategy": "majority"
  }'
```

#### Sample 4: Edge Case (Borderline)

```bash
curl -X POST http://localhost:3030/api/ops/validate/sample \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_test_4",
    "goal": "What are the deployment steps?",
    "subscores": {
      "citation": 0.5,
      "context": 0.5,
      "source": 0.5,
      "relevance": 0.5
    },
    "pass": false,
    "strategy": "critic"
  }'
```

### 3. Add More Training Samples

To get meaningful calibration, we need 50+ samples. Here's a script to add multiple samples:

```bash
# Save this as test-samples.sh
#!/bin/bash

TOKEN="${FIREBASE_TOKEN:-your-token-here}"
BASE_URL="http://localhost:3030"

# Array of test samples (pass=true)
for i in {1..30}; do
  curl -X POST "$BASE_URL/api/ops/validate/sample" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"sess_pass_$i\",
      \"goal\": \"Test query $i\",
      \"subscores\": {
        \"citation\": $(awk -v min=0.5 -v max=1.0 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"context\": $(awk -v min=0.6 -v max=1.0 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"source\": $(awk -v min=0.5 -v max=0.9 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"relevance\": $(awk -v min=0.6 -v max=1.0 'BEGIN{srand(); print min+rand()*(max-min)}')
      },
      \"pass\": true,
      \"strategy\": \"critic\"
    }"
  sleep 0.1
done

# Array of test samples (pass=false)
for i in {1..25}; do
  curl -X POST "$BASE_URL/api/ops/validate/sample" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"sess_fail_$i\",
      \"goal\": \"Test query fail $i\",
      \"subscores\": {
        \"citation\": $(awk -v min=0.0 -v max=0.5 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"context\": $(awk -v min=0.0 -v max=0.5 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"source\": $(awk -v min=0.1 -v max=0.5 'BEGIN{srand(); print min+rand()*(max-min)}'),
        \"relevance\": $(awk -v min=0.0 -v max=0.5 'BEGIN{srand(); print min+rand()*(max-min)}')
      },
      \"pass\": false,
      \"strategy\": \"critic\"
    }"
  sleep 0.1
done

echo "✅ Added 55 training samples"
```

Run it:
```bash
chmod +x test-samples.sh
./test-samples.sh
```

### 4. Recalibrate Model

After collecting 50+ samples, train a new model:

```bash
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetAcc": 0.78,
    "epochs": 5,
    "notes": "First trained model with 50+ samples"
  }'
```

**Expected Response**:
```json
{
  "ok": true,
  "version": "v2c3d_1699...",
  "weights": {
    "citation": 0.38,    // ← Learned weights
    "context": 0.27,
    "source": 0.18,
    "relevance": 0.17
  },
  "thresholds": {
    "default": 0.52,     // ← Optimized
    "critic": 0.57,
    "majority": 0.47
  },
  "metrics": {
    "accuracy": 0.823,   // ← Improved!
    "precision": 0.867,
    "recall": 0.791,
    "samples": 55
  },
  "calibrationTimeMs": 1200,
  "baseModel": "v1a2b_1699...",
  "sampleStats": {
    "total": 55,
    "passed": 30,
    "failed": 25
  }
}
```

### 5. Test Mesh Validation with New Model

Now test the mesh validation to see the new model in action:

```bash
curl -X POST http://localhost:3030/api/mesh/execute \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Explain how the memory timeline feature works in detail",
    "hints": ["React", "hooks", "state management"],
    "strategy": "critic"
  }'
```

**Check logs** for:
```
[validator] Using model v2c3d_1699... for strategy 'critic'
[validator] Score: 0.68 | Threshold: 0.57 | APPROVED
```

## Verification Checklist

### ✅ Model Creation
- [ ] Initial calibration creates v0
- [ ] Response includes weights and thresholds
- [ ] Metrics show accuracy (0 for initial model)

### ✅ Sample Labeling
- [ ] Can save samples with pass=true
- [ ] Can save samples with pass=false
- [ ] Samples stored in `ops_validate_samples`

### ✅ Model Training
- [ ] Calibration requires 50+ samples (or returns error)
- [ ] New model version created (v1, v2, etc.)
- [ ] Accuracy improves over baseline
- [ ] Weights differ from default

### ✅ Validator Integration
- [ ] Validator loads latest model automatically
- [ ] Logs show model version being used
- [ ] Strategy-specific thresholds applied
- [ ] Falls back to rule-based if model unavailable

## Unit Tests

Run the test suites:

```bash
# Test scorer model
pnpm test __tests__/scorerModel.spec.ts

# Test calibrator
pnpm test __tests__/calibrator.spec.ts

# Run all Phase 61 tests
pnpm test __tests__/scoring.spec.ts \
          __tests__/validator.spec.ts \
          __tests__/scorerModel.spec.ts \
          __tests__/calibrator.spec.ts
```

## Firestore Verification

Check that data is stored correctly:

### 1. Check Models Collection

```bash
# Using Firebase CLI
firebase firestore:get ops_validate_models --limit 10
```

Expected documents:
```
ops_validate_models/
  v1a2b_1699.../
    version: "v1a2b_1699..."
    ts: 1699123456789
    weights: {...}
    thresholds: {...}
    metrics: {...}
```

### 2. Check Samples Collection

```bash
firebase firestore:get ops_validate_samples --limit 10
```

Expected documents:
```
ops_validate_samples/
  <auto-id>/
    sessionId: "sess_test_1"
    goal: "..."
    subscores: {...}
    pass: false
    strategy: "critic"
    ts: 1699123456789
```

## Troubleshooting

### Error: "Unauthorized"

**Issue**: Missing or invalid Firebase token

**Solution**:
```bash
# Get new token from browser console
firebase.auth().currentUser.getIdToken().then(t => console.log(t))

# Set environment variable
export FIREBASE_TOKEN="your-new-token"
```

### Error: "Insufficient samples for calibration"

**Issue**: Less than 50 labeled samples

**Solution**:
```bash
# Check current count
curl http://localhost:3030/api/ops/validate/sample/stats

# Add more samples using test-samples.sh script
./test-samples.sh
```

### Error: "Failed to load model"

**Issue**: Firestore connection or permissions

**Solutions**:
1. Check Firebase Admin SDK is initialized
2. Verify Firestore rules allow read/write to `ops_validate_models`
3. Check service account has proper permissions
4. Run initial calibration to create first model

### Logs show "using rule-based fallback"

**Issue**: Model loading failed, using Day 1 scoring

**This is OK** - graceful degradation working as expected. To fix:
1. Check Firestore connection
2. Run calibration to create initial model
3. Verify `ops_validate_models` collection exists

## Performance Benchmarks

Expected performance metrics:

| Stage | Accuracy | Samples | Notes |
|-------|----------|---------|-------|
| v0 (baseline) | 0.65 | 0 | Default weights |
| v1 (50 samples) | 0.72 | 50-100 | Initial learning |
| v2 (200 samples) | 0.78 | 200-500 | Good improvement |
| v3 (1000+ samples) | 0.85 | 1000+ | Well-trained |

## Next Steps

After verifying Phase 61 Day 2:

1. **Set up scheduled calibration** - Cloud Function to retrain weekly
2. **Implement automated labeling** - Use downstream metrics
3. **Add model monitoring** - Track accuracy over time
4. **Create calibration dashboard** - UI for model management
5. **Phase 61 Day 3** - Advanced ML models (XGBoost, Neural Networks)

## Quick Verification Script

Save this as `verify-phase61-day2.sh`:

```bash
#!/bin/bash

TOKEN="${FIREBASE_TOKEN}"
BASE_URL="http://localhost:3030"

echo "🧪 Phase 61 Day 2 Verification"
echo "=============================="

# 1. Test calibration endpoint
echo ""
echo "1️⃣ Testing calibration endpoint..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ops/validate/calibrate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Test calibration"}')

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Calibration endpoint working"
  VERSION=$(echo "$RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  echo "   Model version: $VERSION"
else
  echo "❌ Calibration failed"
  echo "   Response: $RESPONSE"
fi

# 2. Test sample endpoint
echo ""
echo "2️⃣ Testing sample endpoint..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ops/validate/sample" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"test_verify",
    "goal":"test",
    "subscores":{"citation":0.5,"context":0.5,"source":0.5,"relevance":0.5},
    "pass":true,
    "strategy":"default"
  }')

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Sample endpoint working"
else
  echo "❌ Sample endpoint failed"
  echo "   Response: $RESPONSE"
fi

# 3. Test mesh validation
echo ""
echo "3️⃣ Testing mesh validation..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/mesh/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"goal":"Test validation","strategy":"critic"}')

if echo "$RESPONSE" | grep -q '"sessionId"'; then
  echo "✅ Mesh validation working"
else
  echo "❌ Mesh validation failed"
  echo "   Response: $RESPONSE"
fi

echo ""
echo "=============================="
echo "✅ Phase 61 Day 2 verification complete!"
```

Run it:
```bash
chmod +x verify-phase61-day2.sh
./verify-phase61-day2.sh
```

---

**Status**: Phase 61 Day 2 ready for testing!
**Next**: Start dev server and run verification script
