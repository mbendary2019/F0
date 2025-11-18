# 🚀 Phase 53: Installation & Setup Guide

> Complete setup instructions for Realtime Collaboration

---

## 📋 Prerequisites

- Node.js 20+ or 22+
- Firebase project configured
- Firebase CLI installed
- pnpm or npm

---

## 1️⃣ Backend Setup (Day 1)

### Install Function Dependencies

```bash
cd functions
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
npm run build
cd ..
```

### Configure Secrets

```bash
# Generate JWT secret
firebase functions:config:set \
  collab.jwt_secret="$(openssl rand -base64 32)"

# Set ICE servers (STUN - free)
firebase functions:config:set \
  collab.stun_urls='["stun:stun.l.google.com:19302","stun:global.stun.twilio.com:3478"]'

# Set signaling URLs (update with your domain)
firebase functions:config:set \
  collab.signaling_url="wss://collab-signal.yourdomain.com" \
  collab.ws_url="wss://collab-ws.yourdomain.com"

# Verify
firebase functions:config:get
```

### Deploy Functions

```bash
# Deploy collaboration functions
firebase deploy --only functions:collabRequestJoin
firebase deploy --only functions:collabLeave
firebase deploy --only functions:collabSnapshot

# Deploy triggers
firebase deploy --only functions:collabOnSessionWrite
firebase deploy --only functions:collabCleanupOldSessions
firebase deploy --only functions:collabMonitorRoomActivity
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## 2️⃣ Frontend Setup (Day 2)

### Install Client Dependencies

```bash
# Install Y.js and providers
pnpm add yjs y-webrtc y-websocket

# Install Monaco editor
pnpm add monaco-editor

# Install utilities
pnpm add nanoid

# Or all at once
pnpm add yjs y-webrtc y-websocket monaco-editor nanoid
```

### Verify Installation

```bash
# Check packages are installed
pnpm list yjs y-webrtc y-websocket monaco-editor nanoid
```

---

## 3️⃣ Local Development

### Start Emulators

```bash
# Quick start (includes collab functions)
./quick-start-emulators.sh

# Or manually
firebase emulators:start --only functions,firestore,auth,storage
```

### Update Local Config

Add to `functions/.env`:

```bash
# Collab configuration
COLLAB_JWT_SECRET=demo_jwt_secret_for_local_dev_only
COLLAB_STUN_URLS=["stun:stun.l.google.com:19302"]
COLLAB_SIGNALING_URL=ws://localhost:8080/signal
COLLAB_WS_URL=ws://localhost:8080/ws
```

### Start Development Server

```bash
pnpm dev
```

### Open Test Page

```
http://localhost:3000/en/dev/collab
```

---

## 4️⃣ Testing

### Test 1: Single User

1. Open http://localhost:3000/en/dev/collab
2. Wait for "Connected" status
3. Type in editor
4. Verify text appears

### Test 2: Multi-User (Same Machine)

1. Open page in **2 tabs**
2. Type in **Tab 1**
3. See changes appear in **Tab 2** instantly
4. Type in **Tab 2**
5. See changes in **Tab 1**

### Test 3: Presence

1. Open in 2 tabs
2. Check sidebar shows **2 connected users**
3. Move cursor in Tab 1
4. (Day 3: See cursor position in Tab 2)

### Test 4: Reconnection

1. Open DevTools → Network
2. Throttle to "Slow 3G"
3. Wait for "Disconnected" status
4. Click "Reconnect" button
5. Should reconnect successfully

---

## 5️⃣ Production Setup

### Configure TURN Server (Optional but Recommended)

For production, add TURN server for better connectivity:

```bash
# Example with Twilio TURN
firebase functions:config:set \
  collab.turn_urls='["turn:global.turn.twilio.com:3478"]' \
  collab.turn.username="your-twilio-account-sid" \
  collab.turn.password="your-twilio-auth-token"
```

**Free TURN Options:**
- [Twilio TURN](https://www.twilio.com/stun-turn) - Free tier available
- [Metered TURN](https://www.metered.ca/tools/openrelay/) - Free tier
- Self-hosted: [coturn](https://github.com/coturn/coturn)

### Deploy Signaling Server

**Option 1: Cloud Run (Recommended)**

Coming in Day 3 - WebSocket signaling service

**Option 2: Use Public Servers**

For testing only:

```bash
firebase functions:config:set \
  collab.signaling_url="wss://y-webrtc-signaling-eu.herokuapp.com" \
  collab.ws_url="wss://demos.yjs.dev/ws"
```

⚠️ **Warning:** Public servers are for testing only. Deploy your own for production.

### Environment Variables

Update `.env.production`:

```bash
NEXT_PUBLIC_COLLAB_ENABLED=true
NEXT_PUBLIC_COLLAB_MAX_PEERS=12
```

### Build and Deploy

```bash
# Build functions
cd functions && npm run build && cd ..

# Deploy everything
firebase deploy

# Or specific targets
firebase deploy --only functions,firestore:rules
```

---

## 6️⃣ Verification

### Check Functions Deployed

```bash
firebase functions:list | grep collab
```

Should show:
```
collabRequestJoin
collabLeave
collabSnapshot
collabOnSessionWrite
collabCleanupOldSessions
collabMonitorRoomActivity
```

### Check Config

```bash
firebase functions:config:get collab
```

Should show:
```json
{
  "jwt_secret": "...",
  "stun_urls": [...],
  "signaling_url": "wss://...",
  "ws_url": "wss://..."
}
```

### Test Production

```bash
# Call function directly
firebase functions:call collabRequestJoin \
  --data '{"roomId":"test","projectId":"test","filePath":"test.tsx"}'
```

---

## 🐛 Troubleshooting

### Issue: `yjs` module not found

**Solution:**
```bash
pnpm install yjs
# Restart dev server
```

### Issue: `monaco-editor` not loading

**Solution:**
Add to `next.config.js`:
```js
module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.ts$/,
      loader: 'ts-loader',
      options: { transpileOnly: true }
    });
    return config;
  }
};
```

### Issue: Functions not deployed

**Solution:**
```bash
# Check build errors
cd functions && npm run build

# Deploy with verbose logging
firebase deploy --only functions --debug
```

### Issue: JWT secret not set

**Solution:**
```bash
# Set secret
firebase functions:config:set collab.jwt_secret="$(openssl rand -base64 32)"

# Redeploy
firebase deploy --only functions
```

### Issue: Emulators not starting

**Solution:**
```bash
# Kill old processes
pkill -9 -f "firebase|java"

# Clear cache
rm -rf ~/.config/firebase/

# Restart
firebase emulators:start
```

---

## 📊 Health Checks

### Backend Health

```bash
# Test requestJoin
curl -X POST https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/collabRequestJoin \
  -H "Authorization: Bearer $(firebase auth:print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"roomId":"test","projectId":"test","filePath":"test.tsx"}'
```

### Client Health

Open DevTools Console on test page:
```javascript
// Should see:
✅ WebRTC provider initialized for room: ...
✅ Document synced
🔄 Connection status: connected
```

---

## 📝 Quick Commands Reference

```bash
# Install all dependencies
pnpm install

# Start local development
pnpm dev

# Start emulators
./quick-start-emulators.sh

# Deploy functions only
firebase deploy --only functions

# Deploy everything
firebase deploy

# View logs
firebase functions:log --only collabRequestJoin

# Test page
open http://localhost:3000/en/dev/collab
```

---

## ✅ Setup Checklist

### Backend
- [ ] Functions dependencies installed
- [ ] JWT secret configured
- [ ] ICE servers configured
- [ ] Functions deployed
- [ ] Firestore rules deployed
- [ ] Triggers deployed

### Frontend
- [ ] Y.js packages installed
- [ ] Monaco installed
- [ ] Test page accessible
- [ ] Multi-tab sync working

### Production
- [ ] TURN server configured (optional)
- [ ] Signaling server deployed
- [ ] Environment variables set
- [ ] Health checks passing

---

## 🎯 Next Steps

After successful installation:

1. ✅ Test local collaboration
2. ✅ Open in multiple tabs
3. ✅ Verify presence tracking
4. ⏳ Day 3: Add live cursors
5. ⏳ Day 4: WebSocket fallback
6. ⏳ Day 5: UI components
7. ⏳ Day 6: QA & docs

---

**Need Help?**

- [PHASE_53_DAY1_COMPLETE.md](PHASE_53_DAY1_COMPLETE.md) - Backend details
- [PHASE_53_DAY2_COMPLETE.md](PHASE_53_DAY2_COMPLETE.md) - Frontend details
- [PHASE_53_QUICK_START.md](PHASE_53_QUICK_START.md) - Quick reference

---

**Status:** Ready for development
**Estimated Setup Time:** 15-20 minutes

---

**Author:** Claude Code
**Date:** 2025-01-05
**Phase:** 53 - Realtime Collaboration
