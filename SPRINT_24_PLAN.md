# 🖥️ Sprint 24 — Desktop Agent Licensing

**Version:** v25.0.0
**Goal:** Connect F0 Desktop client (Electron app) with user subscriptions and enable secure local execution.

---

## 📦 New Files (12 Files)

### Desktop Client (Electron)

| File | Purpose |
|------|---------|
| `desktop/main.js` | Main process - Firebase Auth + F0 API integration |
| `desktop/preload.js` | Secure IPC and auth token management |
| `desktop/renderer/index.html` | Main UI entry point |
| `desktop/renderer/app.js` | React/Vue app for desktop UI |
| `desktop/package.json` | Electron dependencies |

### License Verification API

| File | Purpose |
|------|---------|
| `src/app/api/desktop/license/route.ts` | Verify user subscription and device binding |
| `src/app/api/desktop/heartbeat/route.ts` | Track local execution and health |
| `src/app/api/desktop/devices/route.ts` | Manage linked devices (list, remove) |

### User-Facing UI

| File | Purpose |
|------|---------|
| `src/app/(protected)/devices/page.tsx` | Manage linked devices (view, remove, rename) |

### License Logic

| File | Purpose |
|------|---------|
| `src/lib/licenseVerifier.ts` | Verify license validity + offline grace period |
| `src/lib/deviceFingerprint.ts` | Generate unique device identifier |

### Documentation

| File | Purpose |
|------|---------|
| `LICENSE_MODEL.md` | License system explanation + offline grace |
| `DESKTOP_AGENT_SETUP.md` | Setup steps and API keys |

---

## 🧩 Features

### ✅ Unified Login (Firebase + JWT)

**Authentication Flow:**
```
User opens Desktop app
  ↓
Click "Sign In"
  ↓
Open browser with Firebase Auth (OAuth/Email)
  ↓
User authenticates in browser
  ↓
Redirect with auth token
  ↓
Desktop app receives token via deep link
  ↓
Store token securely (encrypted keychain)
  ↓
Verify license with API
```

**Implementation:**
```typescript
// desktop/main.js
const { app, BrowserWindow } = require('electron');
const firebase = require('firebase-admin');

app.on('open-url', (event, url) => {
  // Handle deep link: f0://auth?token=xxx
  const token = new URL(url).searchParams.get('token');
  verifyAndStoreLicense(token);
});
```

---

### ✅ Offline Grace Period (48 Hours)

**Grace Period Logic:**
```
Desktop app starts
  ↓
Check last online verification timestamp
  ↓
If < 48 hours ago:
  Allow offline mode
  Show banner: "Offline mode - X hours remaining"
  ↓
Else:
  Require online verification
  Block execution until verified
```

**Implementation:**
```typescript
// src/lib/licenseVerifier.ts
export function checkOfflineGrace(lastVerified: number): boolean {
  const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours
  const elapsed = Date.now() - lastVerified;

  if (elapsed < GRACE_PERIOD_MS) {
    const remaining = GRACE_PERIOD_MS - elapsed;
    const hoursLeft = Math.floor(remaining / (60 * 60 * 1000));
    console.log(`Offline grace: ${hoursLeft}h remaining`);
    return true;
  }

  return false;
}
```

---

### ✅ Device Binding (Max 2 Devices per User)

**Device Fingerprint:**
```typescript
// src/lib/deviceFingerprint.ts
import { machineIdSync } from 'node-machine-id';
import crypto from 'crypto';

export function generateDeviceFingerprint(): string {
  const machineId = machineIdSync();
  const platform = process.platform;
  const arch = process.arch;

  const raw = `${machineId}-${platform}-${arch}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
```

**Device Binding Flow:**
```
Desktop app verifies license
  ↓
Generate device fingerprint
  ↓
API: /api/desktop/license
  Check user subscription active?
  Check device count < 2?
  ↓
If new device:
  Add to users/{uid}/devices/{deviceId}
  ↓
Return license valid + grace period timestamp
```

---

### ✅ Auto-Update Channel (Staged Rollout)

**Update Channels:**
- **Stable:** General availability (all users)
- **Beta:** Early access (opt-in)
- **Canary:** Bleeding edge (10% of users)

**Update Flow:**
```
App checks for updates (on startup + every 6 hours)
  ↓
Query: /api/desktop/updates?channel=stable&version=1.0.0
  ↓
If new version available:
  Download delta update
  ↓
  Notify user: "Update available"
  ↓
  User clicks "Update and Restart"
  ↓
  Apply update
  ↓
  Restart app
```

**Implementation:**
```javascript
// desktop/main.js
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://yourapp.web.app/api/desktop/updates'
});

autoUpdater.checkForUpdates();
autoUpdater.on('update-available', () => {
  // Show notification
});
```

---

## 📁 Firestore Structure

### users/{uid}/devices/{deviceId}

```javascript
{
  id: string, // Device fingerprint hash
  name: string, // User-assigned name (e.g., "MacBook Pro")
  platform: "darwin" | "win32" | "linux",
  arch: "x64" | "arm64",
  appVersion: string,
  firstSeen: timestamp,
  lastSeen: timestamp,
  lastVerified: timestamp, // For offline grace calculation
  active: boolean
}
```

### desktop_sessions/{sessionId}

```javascript
{
  uid: string,
  deviceId: string,
  startedAt: timestamp,
  lastHeartbeat: timestamp,
  version: string,
  status: "active" | "idle" | "offline"
}
```

---

## 🧪 Smoke Tests (6 Tests)

### Test 1: Register New Device

1. Open desktop app (not signed in)
2. Click "Sign In"
3. Complete authentication in browser
4. Verify device registered
5. Check `/devices` page shows new device

**✅ Pass Criteria:**
- Device appears in Firestore
- Desktop app unlocks
- Device count = 1

---

### Test 2: Offline Grace Mode

1. Sign in desktop app (online)
2. Disconnect internet
3. Restart app
4. Verify app works in offline mode
5. Check banner shows "X hours remaining"
6. Wait 49 hours (or mock timestamp)
7. Verify app requires online verification

**✅ Pass Criteria:**
- Offline mode works < 48h
- Banner shows correct remaining time
- Blocks execution after 48h

---

### Test 3: Device Limit Enforcement

1. Sign in on Device A
2. Sign in on Device B
3. Try signing in on Device C
4. Verify rejected with error: "Maximum 2 devices"
5. Remove Device A from `/devices`
6. Sign in on Device C
7. Verify succeeds

**✅ Pass Criteria:**
- 3rd device blocked
- Removal works
- Can add after removal

---

### Test 4: Subscription Cancellation

1. Active subscription with desktop app linked
2. Cancel subscription
3. Verify 48h grace period starts
4. Desktop app continues working
5. After 48h, verify app locks
6. Renew subscription
7. Verify app unlocks

**✅ Pass Criteria:**
- Grace period applied
- App locks after expiry
- Renewal unlocks immediately

---

### Test 5: Auto-Update

1. Desktop app v1.0.0 running
2. Release v1.1.0 to "stable" channel
3. App checks for updates
4. Notification appears: "Update available"
5. Click "Update and Restart"
6. Verify app updates to v1.1.0
7. Verify user data preserved

**✅ Pass Criteria:**
- Update downloads successfully
- Restart works
- No data loss

---

### Test 6: Heartbeat Tracking

1. Open desktop app
2. Verify heartbeat sent every 5 minutes
3. Check `desktop_sessions/{sessionId}.lastHeartbeat` updates
4. Close app
5. Verify session status = "offline"

**✅ Pass Criteria:**
- Heartbeats received
- Session tracking accurate
- Offline status updated

---

## ⏱ Timeline (5 Weeks)

### Week 1-2: API + License Logic

**Tasks:**
- License verification endpoint
- Device binding logic
- Heartbeat tracking
- Offline grace calculation
- Device fingerprint generation

**Deliverables:**
- `/api/desktop/license` working
- `/api/desktop/heartbeat` working
- `/api/desktop/devices` CRUD complete

---

### Week 3: Electron Integration

**Tasks:**
- Electron app setup
- Firebase Auth integration
- Deep link handling
- Secure token storage
- Main UI skeleton

**Deliverables:**
- Desktop app authenticates
- License verification works
- Device registered on first launch

---

### Week 4: Offline Grace + Updater

**Tasks:**
- Offline grace period implementation
- Auto-updater setup
- Update channel system
- Delta update generation
- Rollback mechanism

**Deliverables:**
- Offline mode works (48h)
- Auto-update functional
- Staged rollout ready

---

### Week 5: Pilot Launch

**Tasks:**
- Invite 50 beta users
- Monitor crash reports
- Fix critical bugs
- Performance optimization
- Documentation finalization

**Deliverables:**
- 50 users onboarded
- <1% crash rate
- Feedback collected
- Public beta ready

---

## 🎯 Success Metrics

### Week 1 Post-Launch

| Metric | Target |
|--------|--------|
| Desktop installs | ≥ 100 |
| Device registration success rate | ≥ 99% |
| License verification failures | < 1% |
| Offline grace usage | Track (no target) |
| Update success rate | ≥ 98% |
| Crash rate | < 2% |

### Month 1 Post-Launch

| Metric | Target |
|--------|--------|
| Active desktop users | ≥ 500 |
| Desktop adoption (% of paid users) | ≥ 40% |
| Average session duration | ≥ 30 minutes |
| Device limit violations | < 5 |
| Update adoption (within 7 days) | ≥ 80% |
| Support tickets (desktop) | < 3% of users |

---

## 📐 Technical Architecture

### License Verification Flow

```
Desktop app starts
  ↓
Read stored auth token (encrypted keychain)
  ↓
Generate device fingerprint
  ↓
POST /api/desktop/license
  {
    token: "xxx",
    deviceFingerprint: "sha256...",
    version: "1.0.0"
  }
  ↓
API checks:
  - Token valid?
  - Subscription active?
  - Device count < 2?
  ↓
If valid:
  Register/update device
  Return: { valid: true, gracePeriodEnds: timestamp }
  ↓
Store lastVerified timestamp
  ↓
Start desktop session
```

### Offline Grace Calculation

```typescript
interface LicenseStatus {
  valid: boolean;
  offline: boolean;
  gracePeriodEnds: number;
  hoursRemaining: number;
}

export function getLicenseStatus(): LicenseStatus {
  const lastVerified = storage.get('lastVerified');
  const GRACE_MS = 48 * 60 * 60 * 1000;

  if (!lastVerified) {
    return { valid: false, offline: false, gracePeriodEnds: 0, hoursRemaining: 0 };
  }

  const elapsed = Date.now() - lastVerified;
  const remaining = GRACE_MS - elapsed;

  if (remaining > 0) {
    return {
      valid: true,
      offline: true,
      gracePeriodEnds: lastVerified + GRACE_MS,
      hoursRemaining: Math.floor(remaining / (60 * 60 * 1000))
    };
  }

  return { valid: false, offline: true, gracePeriodEnds: 0, hoursRemaining: 0 };
}
```

### Device Fingerprint Generation

```typescript
import { machineIdSync } from 'node-machine-id';
import crypto from 'crypto';
import os from 'os';

export interface DeviceInfo {
  fingerprint: string;
  platform: NodeJS.Platform;
  arch: string;
  hostname: string;
}

export function getDeviceInfo(): DeviceInfo {
  const machineId = machineIdSync();
  const platform = process.platform;
  const arch = process.arch;
  const hostname = os.hostname();

  const raw = `${machineId}-${platform}-${arch}`;
  const fingerprint = crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex');

  return { fingerprint, platform, arch, hostname };
}
```

---

## 🔐 Security Considerations

### Token Storage

- **Keychain (macOS):** Use Keychain Services
- **Credential Manager (Windows):** Use Windows Credential Manager
- **Secret Service (Linux):** Use libsecret
- **Never store in plain text:** Always encrypted

### Device Fingerprint Privacy

- **No PII:** Fingerprint does not include username, serial number, etc.
- **Hash-based:** SHA256 of machine ID + platform + arch
- **Collision resistant:** Extremely unlikely to collide
- **Revocable:** User can remove device from web UI

### License Tampering Prevention

- **Token signature:** JWT signed with secret key
- **Timestamp validation:** Reject tokens older than 7 days
- **Device binding:** Token includes device fingerprint claim
- **Rate limiting:** Max 10 license checks per device per hour

---

## 🧯 Emergency Controls

| Issue | Kill Switch |
|-------|-------------|
| Desktop license verification failing | Extend grace period to 7 days via feature flag |
| Update causing crashes | Rollback to previous version via update channel |
| Device limit abuse | Reduce limit to 1, force re-auth |
| Offline grace exploited | Reduce grace period to 24h |

---

## 📚 Documentation to Create

1. **LICENSE_MODEL.md** - How licensing works, grace period, device limits
2. **DESKTOP_AGENT_SETUP.md** - Installation, authentication, troubleshooting
3. **DEVICE_MANAGEMENT.md** - How to manage linked devices
4. **UPDATE_CHANNELS.md** - Stable vs Beta vs Canary

---

## 🟢 Status Goal

**Target State:**
- ✅ 500 active desktop users
- ✅ 40% desktop adoption (paid users)
- ✅ <1% license verification failures
- ✅ 98%+ update success rate
- ✅ <2% crash rate

**Go-Live Criteria:**
- All 6 smoke tests passing
- Desktop app stable (beta tested with 50 users)
- License verification tested in production
- Auto-update tested across all platforms
- Device management UI working

---

**Sprint Owner:** _____________________
**Start Date:** _____________________
**Target Completion:** 5 weeks
**Dependencies:** Sprint 20-22 (SaaS Platform)

🖥️ **Sprint 24 - Ready to Execute**
