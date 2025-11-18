# Canary Deployment Strategy & Auto-Rollback

**Phase 29 - Multi-Platform Release Management**

---

## 🎯 Overview

Canary deployment strategy for gradual, low-risk releases across Web, Desktop, and Mobile platforms with automatic rollback capabilities powered by Phase 33.3 Auto-Policy.

---

## 📦 Platform-Specific Strategies

### Web (Firebase Hosting)

**Channels:**
- `alpha` - Preview channel (10% traffic, 24h)
- `beta` - Staging channel (25% traffic, 48h)
- `stable` - Production channel (100% traffic)

**Process:**
```bash
# Deploy to preview channel
firebase hosting:channel:deploy alpha

# Monitor metrics for 24h via Guardian
# If green: Promote to production
firebase deploy --only hosting

# Rollback if needed
firebase hosting:rollback
```

**Auto-Rollback Triggers:**
- Error rate > 5% (15 min window)
- P95 latency +30% (10 min window)
- 4xx/5xx rate > 10%

---

### Desktop (Electron)

**Channels:**
- `alpha` - Prerelease (opt-in users only)
- `beta` - Prerelease (closed beta testers)
- `stable` - Production (all users)

**Process:**
```yaml
# Publish as prerelease for alpha/beta
prerelease: true  # GitHub Release

# electron-updater respects prerelease flag
# Only users on preview channel receive update

# Stable: prerelease: false
# All users auto-update to latest stable
```

**Rollout:**
1. Publish as prerelease (alpha/beta)
2. Monitor telemetry for 24-48h
3. If green: Publish as stable release
4. Auto-update propagates gradually

**Auto-Rollback:**
- Un-publish problematic release
- Re-publish previous stable version
- Users auto-update to rollback version

---

### Mobile (Play Console)

**Tracks:**
- `internal` - 10-100 internal testers
- `closed` - Closed testing (invited users)
- `open` - Open testing (public beta)
- `production` - Staged rollout (10% → 25% → 50% → 100%)

**Process:**
```bash
# Upload to internal track
track: internal
status: draft

# Review in Play Console → Promote to closed
# Monitor for 48h

# Promote to production with staged rollout
rollout: 10%  # Day 1
rollout: 25%  # Day 2 (if metrics green)
rollout: 50%  # Day 3
rollout: 100% # Day 5
```

**Auto-Rollback:**
- Halt rollout at current %
- Revert to previous version
- Notify affected users

---

## 🛡️ Phase 33.3 Integration

### Guardian Pre-Deployment Checks

**Before any release:**
```yaml
jobs:
  safety:
    name: Phase 33.3 Safety Rails
    steps:
      - name: Guardian Gate
        run: |
          # Call guardian API
          curl -X POST $F0_API_URL/guardian/check \
            -H "Authorization: Bearer $F0_API_KEY" \
            -d '{
              "release": "${{ github.ref_name }}",
              "channel": "${{ inputs.channel }}"
            }'
```

**Guardian Checks:**
- Protected paths validation
- PR limit compliance
- Security scan results
- Performance benchmarks
- Dependency audit

**Outcome:**
- ✅ Pass → Proceed with deployment
- ❌ Fail → Block deployment, log to admin_audit

---

### Auto-Policy Monitoring

**Real-Time Metrics:**
```javascript
// Auto-Policy monitors these KPIs post-deployment:
{
  error_rate: 0.08,      // Target: < 0.5%
  p95_latency: 145,      // Target: < 200ms
  success_rate: 99.92,   // Target: > 99%
  mttr_minutes: 8        // Target: < 15 min
}
```

**RL Policy Decision:**
- Metrics green → Continue rollout
- Metrics yellow → Pause, investigate
- Metrics red → Auto-rollback

---

### Auto-Rollback Workflow

**Triggered by:**
1. Error rate threshold breach
2. Latency threshold breach
3. Guardian post-deployment check fails
4. Manual trigger (emergency)

**Process:**
```yaml
# Triggered automatically via GitHub Actions
on:
  repository_dispatch:
    types: [auto-rollback]

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback Web
        run: firebase hosting:rollback
      
      - name: Rollback Desktop
        run: |
          # Un-publish current release
          # Re-publish previous stable
          gh release edit $CURRENT_TAG --draft
          gh release edit $PREVIOUS_TAG --latest
      
      - name: Rollback Mobile
        run: |
          # Halt Play Console rollout
          # Revert to previous version
          # (Requires Play API integration)
      
      - name: Audit Log
        run: |
          # Log to admin_audit
          curl -X POST $F0_API_URL/audit \
            -d '{
              "action": "auto_rollback",
              "reason": "${{ github.event.client_payload.reason }}",
              "version": "${{ github.event.client_payload.version }}"
            }'
```

---

## 📊 Canary Metrics & Thresholds

### Alpha Channel

**Rollout:** 10% users, 24 hours

**Thresholds:**
```yaml
error_rate: 5%        # Red: Rollback
p95_latency: +50%     # Red: Rollback
success_rate: 90%     # Yellow: Investigate
crash_rate: 2%        # Red: Rollback
```

**Decision:**
- All green → Promote to beta
- Any red → Rollback, fix, re-deploy

---

### Beta Channel

**Rollout:** 25% users, 48 hours

**Thresholds:**
```yaml
error_rate: 2%        # Red: Rollback
p95_latency: +30%     # Red: Rollback
success_rate: 95%     # Yellow: Investigate
crash_rate: 1%        # Red: Rollback
mttr: 30 min          # Yellow: Monitor
```

**Decision:**
- All green for 48h → Promote to stable
- Any red → Rollback
- Yellow → Extend monitoring, investigate

---

### Stable Channel (Production)

**Rollout:** 100% users (or staged for mobile)

**Thresholds:**
```yaml
error_rate: 0.5%      # Red: Rollback
p95_latency: +20%     # Red: Rollback
success_rate: 99%     # Red: Investigate
crash_rate: 0.5%      # Red: Rollback
mttr: 15 min          # Yellow: Monitor
```

**Mobile Staged Rollout:**
- Day 1: 10%
- Day 2: 25% (if Day 1 green)
- Day 3: 50% (if Day 2 green)
- Day 5: 100% (if Day 3 green)

---

## 🚨 Emergency Rollback

### Manual Trigger

```bash
# Via GitHub CLI
gh workflow run rollback.yml \
  -f version=v28R.1 \
  -f reason="Critical bug in auth flow"

# Or via GitHub UI:
# Actions → Rollback → Run workflow
```

### Automatic Trigger

```javascript
// Auto-Policy triggers rollback via webhook
POST /repos/{owner}/{repo}/dispatches
{
  "event_type": "auto-rollback",
  "client_payload": {
    "version": "v28R.1",
    "reason": "Error rate 8% (threshold 5%)",
    "timestamp": 1697040000000
  }
}
```

---

## 📈 Success Criteria

**Alpha → Beta Promotion:**
- ✅ Error rate < 5% for 24h
- ✅ No P0/P1 bugs reported
- ✅ Performance within SLA
- ✅ Security scan passed

**Beta → Stable Promotion:**
- ✅ Error rate < 2% for 48h
- ✅ User feedback positive (> 4/5)
- ✅ Load testing passed
- ✅ Cross-platform validation complete
- ✅ Guardian checks passed

**Stable Rollout Completion:**
- ✅ Error rate < 0.5% throughout rollout
- ✅ No rollbacks during 7-day window
- ✅ MTTR < 15 min
- ✅ User satisfaction > 4.5/5

---

## 🔄 Rollback Procedures

### Web (Firebase Hosting)

```bash
# View deployment history
firebase hosting:clone --only hosting

# Rollback to previous version
firebase hosting:rollback

# Or rollback to specific version
firebase hosting:rollback --site <site-id> --version <version-id>
```

### Desktop (Electron)

```bash
# Option 1: Un-publish current, re-publish previous
gh release edit v28R.1 --draft
gh release edit v28R.0 --latest

# Option 2: Delete current release (if critical)
gh release delete v28R.1 --yes

# Users auto-update to latest non-draft release
```

### Mobile (Play Console)

```bash
# Halt current rollout
# Via Play Console UI or API:
# Rollouts → Halt rollout

# Promote previous version
# Releases → Previous version → Promote

# Or via API (requires Play JSON)
# (Implementation in play-console-upload.yml)
```

---

## 📝 Audit Trail

Every rollback logs to `admin_audit`:

```javascript
{
  ts: 1697040000000,
  action: 'auto_rollback',
  actorUid: 'system',
  targetId: 'v28R.1',
  meta: {
    channel: 'stable',
    reason: 'Error rate 8% (threshold 5%)',
    rollback_to: 'v28R.0',
    affected_users: 10000,
    duration_minutes: 45,
    trigger: 'auto-policy'
  }
}
```

---

## 🎯 Best Practices

1. **Always start with alpha** - Never skip canary testing
2. **Monitor actively** - First 24h critical
3. **Have rollback ready** - Test rollback procedure
4. **Communicate clearly** - Notify users of issues
5. **Learn from failures** - Post-mortem for every rollback

---

## 🔗 Related Documentation

- Phase 33.3 Auto-Policy: `PHASE_33_3_SELF_EVOLVING_OPS.md`
- Release Workflow: `.github/workflows/release-publish.yml`
- Safety Rails: `.phase33_safety_rails.yaml`

---

**Version:** v29.0  
**Last Updated:** 2025-10-11  
**Author:** medo bendary


