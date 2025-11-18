# Phase 61 Day 2: ML-Based Scoring - Quick Start

## What Changed?

Phase 61 Day 2 adds **machine learning** to validation scoring. The system now learns optimal weights and thresholds from validation history instead of using fixed rules.

## Key Concepts

### 1. Dynamic Models
- **Models stored in Firestore**: `ops_validate_models`
- **Version controlled**: v0, v1, v2, etc.
- **Strategy-specific thresholds**: different for critic/majority/default
- **Hot-swappable**: validator picks up new models automatically

### 2. Labeled Samples
- **Training data**: `ops_validate_samples`
- **Human or automated labels**: pass/fail
- **Used for learning**: gradient descent training

### 3. Continuous Learning
- **Collect samples** → **Train model** → **Deploy** → **Repeat**

## Quick Setup

### Step 1: Create Initial Model

```bash
# Create baseline model (runs once)
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Initial model v0"
  }'
```

**Response**:
```json
{
  "ok": true,
  "version": "v1a2b_1699...",
  "weights": { "citation": 0.35, "context": 0.25, ... },
  "metrics": { "accuracy": 0.65, "samples": 0 }
}
```

### Step 2: Validation Runs Automatically

When mesh validation runs, it now:
1. Loads latest model from Firestore
2. Calculates subscores (same as Day 1)
3. Applies **learned weights** (not fixed)
4. Uses **strategy-specific threshold**
5. Returns FINAL or CRITIQUE

```typescript
// Automatic in ValidatorAgent
const model = await loadLatestModel();
const score = scoreWithWeights(subscores, model.weights);
const threshold = getThreshold(model.thresholds, strategy);

if (score >= threshold) return FINAL;
else return CRITIQUE;
```

### Step 3: Label Validation Samples

After validations, label them as pass/fail:

```bash
# Label a good validation (should have passed)
curl -X POST http://localhost:3030/api/ops/validate/sample \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "mesh_1699...",
    "goal": "Explain memory timeline",
    "subscores": {
      "citation": 0.5,
      "context": 0.8,
      "source": 0.6,
      "relevance": 0.7
    },
    "pass": true,
    "strategy": "critic"
  }'
```

**When to label**:
- ✅ Validation passed → user was satisfied → `pass: true`
- ❌ Validation passed → user unhappy → `pass: false`
- ✅ Validation failed → correctly rejected bad output → `pass: true`
- ❌ Validation failed → incorrectly rejected good output → `pass: false`

### Step 4: Recalibrate Model

After collecting 50+ samples, train a new model:

```bash
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetAcc": 0.78,
    "epochs": 4,
    "notes": "Weekly recalibration"
  }'
```

**Response**:
```json
{
  "ok": true,
  "version": "v2c3d_1699...",
  "weights": {
    "citation": 0.38,    // ← Learned from data
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
    "samples": 150
  }
}
```

### Step 5: New Model Automatically Used

Next validation automatically picks up the new model:

```
[validator] Using model v2c3d_1699... for strategy 'critic'
[validator] Score: 0.68 | Threshold: 0.57 | APPROVED
```

## Comparison: Day 1 vs Day 2

| Feature | Day 1 (Rule-Based) | Day 2 (ML-Based) |
|---------|-------------------|------------------|
| **Weights** | Fixed (0.35, 0.25, 0.2, 0.2) | Learned from data |
| **Thresholds** | Fixed (0.55) | Optimized per strategy |
| **Adaptation** | Manual tuning only | Automatic learning |
| **Accuracy** | ~65% baseline | ~75-85% with training |
| **Strategy Support** | Single threshold | Per-strategy thresholds |

## File Structure

```
src/
├── orchestrator/
│   └── rag/
│       ├── scorerModel.ts          # Model loading/saving
│       ├── online_learning.ts      # Gradient descent training
│       └── calibrator.ts           # Model calibration
└── app/api/ops/validate/
    ├── sample/route.ts             # Label samples
    └── calibrate/route.ts          # Train models

__tests__/
├── scorerModel.spec.ts             # Model tests
└── calibrator.spec.ts              # Calibration tests
```

## Common Workflows

### 1. Weekly Recalibration

```bash
# Check sample count
curl http://localhost:3030/api/ops/validate/sample/stats

# If 50+ samples, recalibrate
curl -X POST http://localhost:3030/api/ops/validate/calibrate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. A/B Testing Thresholds

```bash
# Label samples with different strategies
curl -X POST .../sample -d '{"...": "...", "pass": true, "strategy": "critic"}'
curl -X POST .../sample -d '{"...": "...", "pass": true, "strategy": "majority"}'

# Calibrate to learn optimal thresholds for each
curl -X POST .../calibrate
```

### 3. Monitor Model Performance

```typescript
import { listModels } from "@/orchestrator/rag/scorerModel";

const models = await listModels(10);

models.forEach(m => {
  console.log(`${m.version}: acc=${m.metrics?.acc}, date=${new Date(m.ts)}`);
});
```

## Benefits

✅ **Self-Improving** - Learns from real validation data
✅ **Strategy-Aware** - Different thresholds for critic vs majority
✅ **Observable** - Track model versions and metrics
✅ **Robust** - Falls back to rule-based if model unavailable
✅ **Simple** - Works automatically after initial setup

## Configuration

### Calibration Options

```typescript
{
  targetAcc: 0.78,      // Target accuracy (default 0.75)
  epochs: 4,            // Training epochs (default 3)
  learningRate: 0.05,   // Gradient descent LR (default 0.05)
  minSamples: 50        // Minimum samples (default 50)
}
```

### Recommended Schedule

- **Initial**: Calibrate after 50-100 samples
- **Week 1-4**: Calibrate weekly
- **Month 2+**: Calibrate monthly
- **On-Demand**: When accuracy drops

## Troubleshooting

### "Insufficient samples" error

**Need**: 50+ labeled samples
**Solution**: Label more validation results via `/sample` endpoint

### Model not loading

**Check**:
1. Firestore connection working?
2. `ops_validate_models` collection exists?
3. At least one model document?

**Solution**: Run initial calibration to create v0

### Accuracy not improving

**Possible causes**:
- Labeling errors
- Insufficient sample diversity
- Too few epochs

**Solution**:
- Review sample labels
- Collect more varied samples
- Increase epochs to 5-10

## Next Steps

1. ✅ **Day 1**: Rule-based validation
2. ✅ **Day 2**: ML-based learning ← You are here
3. 🔜 **Day 3**: Advanced ML models (neural networks, XGBoost)
4. 🔜 **Day 4**: Automated labeling and active learning
5. 🔜 **Day 5**: Model ensemble and scheduled retraining

## Testing

```bash
# Run Day 2 tests
pnpm test __tests__/scorerModel.spec.ts
pnpm test __tests__/calibrator.spec.ts

# Run all Phase 61 tests
pnpm test __tests__/scoring.spec.ts \
          __tests__/validator.spec.ts \
          __tests__/scorerModel.spec.ts \
          __tests__/calibrator.spec.ts
```

## Status

✅ **Phase 61 Day 2 Complete**

Ready for production with ML-based validation!

---

**Created**: 2025-11-07
**Dependencies**: Phase 61 Day 1 (Rule-Based Validation)
**Next**: Phase 61 Day 3 (Advanced ML Models)
