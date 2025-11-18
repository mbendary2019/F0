# GDPR/DSAR Compliance Setup Guide

**Sprint 11 - Data Export & Compliance**

Complete setup guide for GDPR, CCPA, and data subject access request (DSAR) compliance features.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Environment Configuration](#environment-configuration)
4. [Firestore Collections](#firestore-collections)
5. [Cloud Functions](#cloud-functions)
6. [API Routes](#api-routes)
7. [User Interface](#user-interface)
8. [Testing & Verification](#testing--verification)
9. [Operational Runbook](#operational-runbook)
10. [Legal Compliance Notes](#legal-compliance-notes)

---

## Overview

This system enables your SaaS platform to comply with GDPR (EU) and CCPA (California) data protection regulations by providing:

- **Data Export (DSAR)**: Users can request a complete copy of their personal data
- **Right to be Forgotten**: Users can request account deletion with grace period
- **Admin Approval Workflow**: Deletion requests require manual admin review
- **Retention Policies**: Automatic cleanup of old data according to configurable policies
- **Audit Trail**: All DSAR operations are logged for compliance evidence

---

## Features

### User Features

✅ **Data Export**
- Request full data export in JSON format
- Automatic processing via Cloud Function
- Signed download URLs (24-hour expiration)
- Cooldown period (30 days) between requests

✅ **Account Deletion**
- Request account deletion with confirmation
- 30-day grace period before permanent deletion
- Admin approval required
- All user data removed from all collections

### Admin Features

✅ **DSAR Management Dashboard**
- View all export and deletion requests
- Approve or deny deletion requests
- Filter by type, status, user
- Audit trail for all actions

✅ **Automated Processing**
- Export requests processed automatically
- Deletion queue with scheduled execution
- Retention policy sweeps
- Expired export cleanup

---

## Environment Configuration

Add these variables to your `.env.local`:

```bash
# ============================================
# Data Export & Compliance (GDPR/DSAR)
# ============================================

# Storage Configuration
EXPORT_STORAGE_BUCKET=f0-exports
EXPORT_SIGNED_URL_TTL_SECONDS=86400        # 24 hours

# DSAR & Retention
DSAR_REQUEST_COOLDOWN_DAYS=30              # Min days between export requests
RETENTION_POLICIES_JSON={"audit_logs":90,"usage_events":30,"dsar_exports":90}
DELETION_GRACE_PERIOD_DAYS=30              # Days before permanent deletion

# Email Notifications (optional)
ADMIN_EMAIL_FROM=Compliance <no-reply@yourdomain.com>
```

### Retention Policies JSON

The `RETENTION_POLICIES_JSON` variable defines how long data is kept before automatic deletion:

```json
{
  "audit_logs": 90,        // Keep audit logs for 90 days
  "usage_events": 30,      // Keep usage events for 30 days
  "dsar_exports": 90       // Keep export files for 90 days
}
```

**Note**: This is for system cleanup only. User data deletion is handled separately via DSAR requests.

---

## Firestore Collections

### `dsar_requests`

Stores all data export and deletion requests.

**Schema**:
```typescript
{
  id: string;
  uid: string;                    // User requesting
  type: 'export' | 'deletion';
  status: 'pending' | 'processing' | 'ready' | 'approved' | 'denied' | 'completed';
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  approvedBy?: string;            // Admin UID who approved
  deniedBy?: string;              // Admin UID who denied
  denialReason?: string;
  exportUrl?: string;             // Signed URL for download
  exportExpiresAt?: Timestamp;
  metadata?: {
    reason?: string;
    userConfirmation?: string;
    deletionTaskId?: string;
    scheduledFor?: string;
  };
}
```

**Security Rules**: Read-only for owner or admin, server-side writes only.

**Indexes Required**:
- `uid + type + requestedAt DESC`
- `type + requestedAt DESC`
- `status + requestedAt DESC`

### `dsar_exports`

Tracks generated export files and download links.

**Schema**:
```typescript
{
  id: string;
  uid: string;
  requestId: string;
  fileUrl: string;                // Signed download URL
  expiresAt: Timestamp;           // URL expiration
  createdAt: Timestamp;
  sizeBytes: number;
}
```

**Security Rules**: Read-only for owner or admin, server-side writes only.

### `deletion_queue`

Scheduled account deletions (after grace period).

**Schema**:
```typescript
{
  id: string;
  uid: string;
  requestId: string;
  scheduledFor: Timestamp;        // When to execute
  reason?: string;
  status: 'pending' | 'cancelled' | 'completed';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  lastError?: string;
  lastErrorAt?: Timestamp;
}
```

**Security Rules**: Server-side only (no client access).

**Indexes Required**:
- `status + scheduledFor ASC`

---

## Cloud Functions

### 1. `onDsarRequest`

**Trigger**: Firestore onCreate on `dsar_requests/{reqId}`

**Purpose**: Automatically process export requests when created.

**Behavior**:
- Export requests: Start export process immediately
- Deletion requests: Await admin approval

**Code Location**: `functions/src/compliance.ts`

### 2. `retentionSweep`

**Schedule**: Daily at 2 AM UTC

**Purpose**: Delete old data according to retention policies.

**Behavior**:
- Reads `RETENTION_POLICIES_JSON`
- For each collection: deletes documents older than retention period
- Processes max 500 documents per collection per run
- Logs all deletions to console

### 3. `processDeletions`

**Schedule**: Hourly

**Purpose**: Execute scheduled deletions after grace period.

**Behavior**:
- Finds `deletion_queue` tasks with `scheduledFor <= now`
- Calls `executeDeletion()` for each task
- Processes max 10 deletions per run
- Creates alert on completion

### 4. `cleanupExpiredExports`

**Schedule**: Daily at 3 AM UTC

**Purpose**: Remove expired export files and records.

**Behavior**:
- Finds `dsar_exports` with `expiresAt < now`
- Deletes files from Cloud Storage
- Deletes Firestore records
- Processes max 100 exports per run

---

## API Routes

### User Routes

#### `POST /api/account/export`

Request data export.

**Auth**: Required (Firebase ID token)

**Request**: Empty body

**Response**:
```json
{
  "requestId": "req_abc123",
  "status": "pending",
  "message": "Your data export request has been received..."
}
```

**Rate Limit**: 30-day cooldown between requests

---

#### `GET /api/account/export/status`

Check export request status.

**Auth**: Required

**Response**:
```json
{
  "requests": [
    {
      "id": "req_abc123",
      "status": "ready",
      "requestedAt": "2025-01-15T10:00:00Z",
      "exportUrl": "https://storage.googleapis.com/...",
      "exportExpiresAt": "2025-01-16T10:00:00Z"
    }
  ]
}
```

---

#### `POST /api/account/delete`

Request account deletion.

**Auth**: Required

**Request**:
```json
{
  "confirmation": "DELETE MY ACCOUNT",
  "reason": "No longer need the service"
}
```

**Response**:
```json
{
  "requestId": "req_xyz789",
  "status": "pending",
  "message": "Your account deletion request has been submitted for review...",
  "gracePeriodDays": 30
}
```

---

### Admin Routes

#### `GET /api/admin/compliance/dsar`

List all DSAR requests (admin only).

**Auth**: Admin required

**Query Params**:
- `type`: Filter by 'export' or 'deletion'
- `status`: Filter by status
- `limit`: Max results (default 50, max 100)

**Response**:
```json
{
  "requests": [...],
  "total": 25
}
```

---

#### `POST /api/admin/compliance/dsar/approve`

Approve deletion request.

**Auth**: Admin required

**Request**:
```json
{
  "requestId": "req_xyz789",
  "notes": "Verified user identity via support ticket"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Deletion approved. User will be deleted after 30-day grace period.",
  "gracePeriodDays": 30
}
```

---

#### `POST /api/admin/compliance/dsar/deny`

Deny deletion request.

**Auth**: Admin required

**Request**:
```json
{
  "requestId": "req_xyz789",
  "reason": "Active subscription - user must cancel first"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Deletion request denied"
}
```

---

## User Interface

### User Privacy Page

**Path**: `/account/privacy`

**Features**:
- Request data export button
- View export request history
- Download export files (with expiration notice)
- Request account deletion with confirmation
- GDPR/CCPA compliance information

**Access**: Authenticated users only

---

### Admin DSAR Dashboard

**Path**: `/admin/compliance/dsar`

**Features**:
- View all DSAR requests (exports and deletions)
- Filter by type, status, user
- Approve/deny deletion requests
- View user metadata and request history
- Download user exports for verification

**Access**: Admin only (requires custom claims)

---

## Testing & Verification

### 1. Test Data Export

```bash
# As a user, request export
curl -X POST http://localhost:3000/api/account/export \
  -H "Authorization: Bearer <USER_TOKEN>"

# Check status
curl http://localhost:3000/api/account/export/status \
  -H "Authorization: Bearer <USER_TOKEN>"

# Verify Cloud Function triggered
# Check Firebase Console → Functions logs for:
# "📋 New DSAR request ... export"
# "✅ Export started for request ..."

# Verify export file created in Cloud Storage
# Check Firebase Console → Storage → f0-exports/dsar-exports/
```

### 2. Test Account Deletion

```bash
# Request deletion
curl -X POST http://localhost:3000/api/account/delete \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmation": "DELETE MY ACCOUNT",
    "reason": "Test deletion request"
  }'

# Admin approval
curl -X POST http://localhost:3000/api/admin/compliance/dsar/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_xxx",
    "notes": "Test approval"
  }'

# Verify deletion_queue entry created
# Verify scheduled deletion date is 30 days in future
```

### 3. Test Retention Policy

```bash
# Trigger manually (or wait for scheduled run)
# Check Function logs for:
# "🧹 Starting retention sweep..."
# "🗑️  Processing audit_logs (retention: 90 days...)"
# "✅ Deleted X documents from audit_logs"
```

### 4. Verify Security Rules

```bash
# Try to write to dsar_requests as user (should fail)
# Try to read other user's requests (should fail)
# Try to approve deletion as non-admin (should fail)
```

---

## Operational Runbook

### Scenario 1: User Requests Data Export

**Workflow**:
1. User clicks "Request Data Export" in `/account/privacy`
2. API checks cooldown period (30 days)
3. DSAR request created with status `pending`
4. Cloud Function `onDsarRequest` triggers automatically
5. Function collects data from all PII collections
6. Data packaged as JSON and uploaded to Cloud Storage
7. Signed URL generated (24-hour expiration)
8. Request status updated to `ready`
9. User downloads file from signed URL

**Timeline**: 1-5 minutes (depending on data volume)

**Admin Action**: None required (automatic)

---

### Scenario 2: User Requests Account Deletion

**Workflow**:
1. User types "DELETE MY ACCOUNT" and submits
2. DSAR request created with status `pending`
3. **Admin reviews request in dashboard**
4. Admin approves or denies with reason
5. If approved:
   - Deletion task added to `deletion_queue`
   - Scheduled for 30 days in future
   - Critical alert sent to admins
6. After grace period:
   - Cloud Function `processDeletions` runs hourly
   - Executes `executeDeletion()` for due tasks
   - All user data removed from all collections
   - Firebase Auth user deleted
   - Request status updated to `completed`

**Timeline**: 30+ days (grace period)

**Admin Action**: Required (approve/deny)

---

### Scenario 3: User Changes Mind During Grace Period

**Action**:
1. Admin finds deletion task in `deletion_queue`
2. Use Firebase Console or custom admin tool
3. Call `cancelDeletion(taskId, reason)`
4. Task status updated to `cancelled`
5. User can continue using account

**Code Example**:
```typescript
import { cancelDeletion } from '@/server/dsar';

await cancelDeletion('task_abc123', 'User contacted support to cancel');
```

---

### Scenario 4: Export Link Expired

**Problem**: User waited too long (>24 hours) to download

**Solution**:
1. User requests new export
2. Cooldown period still applies (30 days)
3. If within cooldown: User must wait
4. If outside cooldown: New export generated

**Workaround (Admin)**:
1. Admin can manually generate new signed URL
2. Use Cloud Storage Console
3. Generate new signed URL for existing file
4. Send to user via support ticket

---

### Scenario 5: Retention Policy Cleanup Fails

**Symptoms**: Old data not being deleted

**Debugging**:
1. Check Cloud Function logs for `retentionSweep`
2. Verify `RETENTION_POLICIES_JSON` is valid JSON
3. Verify collections exist and have `createdAt` field
4. Check Firestore indexes exist

**Manual Cleanup**:
```typescript
// Run this from Firebase Console or Cloud Function
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 90);

const snapshot = await db.collection('audit_logs')
  .where('createdAt', '<', cutoffDate)
  .limit(500)
  .get();

const batch = db.batch();
snapshot.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

---

## Legal Compliance Notes

### GDPR (General Data Protection Regulation)

✅ **Article 15 - Right of Access**: Implemented via data export

✅ **Article 17 - Right to Erasure**: Implemented via account deletion

✅ **Article 20 - Right to Data Portability**: Data exported in JSON format

✅ **Article 30 - Records of Processing**: Audit logs track all operations

### CCPA (California Consumer Privacy Act)

✅ **Right to Know**: Data export provides complete data inventory

✅ **Right to Delete**: Account deletion removes all personal information

✅ **Right to Opt-Out**: Deletion requests honored within 45 days (30-day grace + processing)

### Response Times

- **GDPR**: 30 days to respond (we respond in <5 minutes for exports)
- **CCPA**: 45 days to respond (we complete deletions in 30 days)

### Documentation Requirements

Keep records of:
- All DSAR requests and responses
- Data deletion confirmations
- Retention policy changes
- Admin actions and justifications

**All tracked automatically in**:
- `dsar_requests` collection
- `audit_logs` collection
- Cloud Function logs

---

## Troubleshooting

### Export file too large

**Problem**: User data exceeds Cloud Storage limits

**Solution**:
```typescript
// In dsar.ts, modify startExport() to split into multiple files
// Or compress JSON before uploading
import zlib from 'zlib';
const compressed = zlib.gzipSync(buffer);
await file.save(compressed, { contentType: 'application/gzip' });
```

### Deletion fails on specific collection

**Problem**: `executeDeletion()` errors on one collection

**Solution**:
1. Check Cloud Function logs for exact error
2. Common issues:
   - Missing subcollections in PII_MAP
   - Firestore rules blocking deletion
   - Collection doesn't exist
3. Fix PII_MAP or skip problematic collection:

```typescript
// In dsar.ts executeDeletion()
try {
  // delete from collection
} catch (error) {
  console.error(`Failed to delete from ${collection.name}:`, error);
  // Continue with other collections
}
```

### User can't download export

**Problem**: Signed URL returns 403

**Causes**:
- URL expired (>24 hours)
- Storage bucket permissions incorrect
- File was deleted by cleanup function

**Solution**:
1. Check `dsar_exports` for `expiresAt`
2. If expired: User must request new export (if within cooldown)
3. If file deleted: Check `cleanupExpiredExports` logs
4. Verify Storage rules allow signed URLs

---

## Next Steps

1. **Deploy Cloud Functions**:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. **Deploy Firestore Rules & Indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

3. **Configure Storage Bucket**:
   - Create `f0-exports` bucket in Firebase Console
   - Set CORS policy for signed URLs
   - Configure lifecycle rules for auto-cleanup (optional)

4. **Set Custom Claims for Admins**:
   ```typescript
   import { auth } from '@/lib/firebase-admin';
   await auth.setCustomUserClaims(adminUid, { admin: true });
   ```

5. **Test Everything**:
   - Request export as user
   - Request deletion as user
   - Approve/deny as admin
   - Verify Cloud Functions run
   - Check audit logs

6. **Legal Review**:
   - Have legal team review privacy policy
   - Update terms of service with data retention policies
   - Add GDPR/CCPA notices to UI
   - Document data processing activities

---

## Support

For issues or questions:
- Check Cloud Function logs in Firebase Console
- Review audit logs for operation history
- Contact support at compliance@example.com

**Last Updated**: 2025-10-06
**Version**: 1.0
**Sprint**: 11
