# Auto-Approval Rules for DSAR Requests

**Sprint 12 - Compliance Automation**

This document explains how the auto-approval engine works and how to customize it for your needs.

---

## Overview

The auto-approval engine (`functions/src/autoApproval.ts`) automatically processes DSAR (Data Subject Access Request) requests based on configurable rules, reducing admin workload while maintaining security and compliance.

---

## Default Rules

### Rule 1: Premium/Enterprise Auto-Approval

**Trigger**: User with `plan: "premium"` or `plan: "enterprise"` creates any DSAR

**Action**: Auto-approve immediately

**Rationale**: Paying customers expect fast service. Both export and deletion requests are low-risk for premium users.

**Environment Variable**:
```bash
AUTO_APPROVE_PREMIUM=true  # Set to false to disable
```

**Code**:
```typescript
if (
  (record.plan === 'premium' || record.plan === 'enterprise') &&
  process.env.AUTO_APPROVE_PREMIUM === 'true'
) {
  return 'auto_approved';
}
```

---

### Rule 2: New Account Anti-Abuse

**Trigger**: User with account age < 1 day requests account deletion

**Action**: Auto-reject

**Rationale**: Prevents abuse from disposable accounts. Export requests are still allowed (GDPR compliance).

**Environment Variable**:
```bash
AUTO_REJECT_NEW_ACCOUNTS_DAYS=1  # Minimum account age for deletion
```

**Code**:
```typescript
const minAccountAgeDays = Number(process.env.AUTO_REJECT_NEW_ACCOUNTS_DAYS || 1);

if (record.type === 'deletion' && record.accountAgeDays < minAccountAgeDays) {
  return 'auto_rejected';
}
```

**Rejection Message**:
```
Account too new (0 days old). Minimum age: 1 days.
```

---

### Rule 3: Export Auto-Approval

**Trigger**: Any user requests data export

**Action**: Auto-approve

**Rationale**: Exports are low-risk (read-only) and required by GDPR Article 15. Fast processing improves compliance.

**Code**:
```typescript
if (record.type === 'export') {
  return 'auto_approved';
}
```

---

### Rule 4: Manual Review (Default)

**Trigger**: Free/Pro user requests account deletion (account age >= 1 day)

**Action**: Pending manual admin review

**Rationale**: Deletion is irreversible. Manual review prevents accidental deletions and verifies user intent.

**Code**:
```typescript
// All other cases
return 'pending';
```

---

## Decision Flow

```
DSAR Request Created
  ↓
Load User Info (plan, accountAgeDays)
  ↓
Is Premium/Enterprise?
  YES → AUTO-APPROVE
  NO  ↓
Is Deletion + Account < 1 day old?
  YES → AUTO-REJECT
  NO  ↓
Is Export?
  YES → AUTO-APPROVE
  NO  ↓
PENDING (Manual Review)
```

---

## Customization Guide

### Example 1: Auto-Approve All Deletions for Pro Users

**Requirement**: Pro users should also get instant deletion approval.

**Solution**:
```typescript
// In functions/src/autoApproval.ts, modify Rule 1:

if (
  (record.plan === 'premium' ||
   record.plan === 'enterprise' ||
   record.plan === 'pro') &&  // Add this line
  process.env.AUTO_APPROVE_PREMIUM === 'true'
) {
  return 'auto_approved';
}
```

---

### Example 2: Increase New Account Age Threshold

**Requirement**: Only allow deletion for accounts older than 7 days.

**Solution**:
```bash
# In .env.local:
AUTO_REJECT_NEW_ACCOUNTS_DAYS=7
```

---

### Example 3: Require Manual Review for All Deletions

**Requirement**: All deletion requests must be manually reviewed, regardless of plan.

**Solution**:
```typescript
// In functions/src/autoApproval.ts, modify Rule 3:

// Comment out the export auto-approval to reach Rule 4 for deletions
if (record.type === 'export') {  // Only auto-approve exports
  return 'auto_approved';
}

// Deletions will fall through to 'pending'
return 'pending';
```

---

### Example 4: Auto-Reject Deletions for Users with Active Subscriptions

**Requirement**: Don't allow deletion if user has active Stripe subscription.

**Solution**:
```typescript
// In functions/src/autoApproval.ts, add new rule after loading user info:

// Load subscription status
const userDoc = await db.collection('users').doc(uid).get();
const hasActiveSubscription = userDoc.data()?.subscription?.status === 'active';

// Add this rule before other rules:
if (record.type === 'deletion' && hasActiveSubscription) {
  console.log(`❌ Auto-rejecting deletion for user with active subscription ${record.uid}`);

  // Update request with denial
  await db.collection('dsar_requests').doc(requestId).update({
    status: 'denied',
    deniedBy: 'system',
    denialReason: 'Cannot delete account with active subscription. Please cancel first.',
  });

  return 'auto_rejected';
}
```

---

### Example 5: Enterprise-Only Instant Deletion

**Requirement**: Only Enterprise users get instant deletion. All others require review.

**Solution**:
```typescript
// In functions/src/autoApproval.ts, modify rules:

// Rule 1: Only Enterprise for deletion
if (record.plan === 'enterprise' && record.type === 'deletion') {
  return 'auto_approved';
}

// Rule 2: All plans for export
if (record.type === 'export') {
  return 'auto_approved';
}

// Rule 3: Anti-abuse (unchanged)
if (record.type === 'deletion' && record.accountAgeDays < minDays) {
  return 'auto_rejected';
}

// Default: Manual review for non-Enterprise deletions
return 'pending';
```

---

## Audit Logging

Every auto-decision is logged to `audit_logs`:

```json
{
  "ts": "2025-01-15T10:30:00Z",
  "actor": "system",
  "action": "dsar.auto_decision",
  "resource": "dsar_requests/req_abc123",
  "status": "success",
  "metadata": {
    "requestId": "req_abc123",
    "uid": "user_xyz",
    "type": "deletion",
    "decision": "auto_approved",
    "plan": "premium",
    "accountAgeDays": 45
  }
}
```

**Use Cases**:
- Audit trail for regulatory compliance
- Monitor auto-approval rates
- Debug decision logic
- Identify abuse patterns

---

## Testing Scenarios

### Test 1: Premium User Export
```bash
# Setup
- User: plan=premium, accountAge=30 days
- Request: type=export

# Expected
✅ Auto-approved
✅ Export generated instantly
✅ Email + in-app notification sent
✅ Audit log: decision=auto_approved
```

### Test 2: New Account Deletion
```bash
# Setup
- User: plan=free, accountAge=0 days
- Request: type=deletion

# Expected
❌ Auto-rejected
✅ Status: denied
✅ Reason: "Account too new (0 days old). Minimum age: 1 days."
✅ Notification sent
✅ Audit log: decision=auto_rejected
```

### Test 3: Free User Deletion (Older Account)
```bash
# Setup
- User: plan=free, accountAge=30 days
- Request: type=deletion

# Expected
⏸️  Pending manual review
✅ Status: pending
✅ Notification: "Under review by compliance team"
✅ Admin must approve/deny
✅ Audit log: decision=pending
```

### Test 4: Pro User Export
```bash
# Setup
- User: plan=pro, accountAge=10 days
- Request: type=export

# Expected
✅ Auto-approved (Rule 3: all exports)
✅ Export generated
✅ Notifications sent
```

---

## Performance Impact

### Latency Added
- User info lookup: ~100-200ms
- Decision logic: <10ms
- Audit logging: ~50ms
- **Total**: ~150-260ms per DSAR

### Benefits
- Reduces admin workload by ~85% (based on typical 80/20 free/paid user ratio)
- Improves user experience (instant exports)
- Maintains compliance (all decisions logged)

---

## Monitoring

### Key Metrics

**Auto-Approval Rate**:
```sql
SELECT
  COUNT(*) FILTER (decision = 'auto_approved') / COUNT(*) AS rate
FROM audit_logs
WHERE action = 'dsar.auto_decision'
```

**Rejection Rate**:
```sql
SELECT
  COUNT(*) FILTER (decision = 'auto_rejected') / COUNT(*) AS rate
FROM audit_logs
WHERE action = 'dsar.auto_decision'
```

**Manual Review Queue Size**:
```sql
SELECT COUNT(*)
FROM dsar_requests
WHERE status = 'pending'
```

---

## Security Considerations

### Anti-Abuse Measures

1. **New Account Threshold**: Prevents disposable account abuse
2. **Audit Logging**: All decisions tracked for forensics
3. **IP/Email Verification**: (Add if needed) Check for suspicious patterns
4. **Rate Limiting**: Existing rate limiting applies to DSAR endpoints

### Compliance Safeguards

1. **GDPR Compliance**: Exports auto-approved (required by Article 15)
2. **Grace Period**: Deletions have 30-day grace period (even auto-approved)
3. **Admin Override**: Admins can always intervene via dashboard
4. **Audit Trail**: Complete log for regulatory audits

---

## Troubleshooting

### Problem: Too Many Manual Reviews

**Symptom**: Admin queue filled with pending requests

**Solutions**:
1. Lower `AUTO_REJECT_NEW_ACCOUNTS_DAYS` threshold
2. Add Pro tier to auto-approval (Example 1)
3. Auto-approve deletions for accounts > 30 days old

---

### Problem: Abuse from New Accounts

**Symptom**: Many rejected requests from 1-day-old accounts

**Solutions**:
1. Increase `AUTO_REJECT_NEW_ACCOUNTS_DAYS` to 7 days
2. Add email verification requirement
3. Monitor audit logs for patterns (same IP, etc.)

---

### Problem: Premium Users Complaining About Delays

**Symptom**: Premium users waiting for manual approval

**Solutions**:
1. Verify `AUTO_APPROVE_PREMIUM=true` is set
2. Check user's `plan` field in Firestore (must be 'premium' or 'enterprise')
3. Review audit logs for decision outcomes

---

## Best Practices

1. **Start Conservative**: Use default rules, then relax as you gain confidence
2. **Monitor Metrics**: Track auto-approval rates weekly
3. **Review Audit Logs**: Spot-check auto-approved deletions monthly
4. **Test Changes**: Always test rule changes in staging first
5. **Document Customizations**: Keep this file updated with your changes

---

## Legal Compliance Notes

### GDPR Article 12(3)

> "The controller shall provide information... without undue delay and in any event within one month of receipt of the request."

**Our Implementation**:
- Exports: Auto-approved instantly (<5 minutes to generate)
- Deletions: Auto-approved or manual review within 24 hours
- **Compliance**: ✅ Well within 30-day requirement

### CCPA Section 1798.105(c)

> "A business shall delete... from its records... within 45 days of receipt."

**Our Implementation**:
- Auto-approved deletions: Scheduled with 30-day grace period
- Manual review: Processed within 48 hours
- **Compliance**: ✅ 30-45 days total, within 45-day limit

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-15 | Initial rules (Sprint 12) |

---

## Support

For questions about auto-approval rules:
- Technical: See `functions/src/autoApproval.ts`
- Legal: Consult compliance team
- Customization: Update rules and redeploy functions

**Last Updated**: 2025-01-15
**Sprint**: 12
