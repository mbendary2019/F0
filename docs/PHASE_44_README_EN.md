# Phase 44 — Add-Ons Pack

**Includes**: Daily Trial Quota, VS Code extension, Figma integration, Dynamic Branding + Mascot + Routes, Marketplace page.

---

## Quick Start

```bash
# 1) Set environment variables
export FIGMA_TOKEN="your-figma-personal-access-token"
export FIGMA_FILE_IDS="comma,separated,file,ids"  # optional
export BRANDING_ENV="prod"  # or "staging"

# 2) Deploy
chmod +x ./scripts/deploy-phase44.sh
./scripts/deploy-phase44.sh

# 3) Seed initial data
firebase firestore:write ops_branding/prod '{"primaryColor":"#7C3AED","accentColor":"#22D3EE"}'
firebase firestore:write ops_marketplace_items/sample-branding "$(cat <<EOF
{
  "title": "Branding Quick Start",
  "category": "branding",
  "brief": "Preset colors, routes, and a mascot",
  "installScript": "applyBrandingPreset:v1",
  "verified": true
}
EOF
)"

# 4) Access new pages
# - /ops/branding (admins only)
# - /ops/marketplace
# - /ops/assets
```

---

## Features

### 1. Daily Trial Quota System

- **Free tier**: 500 tokens/day per user
- **Auto-reset**: Midnight Asia/Kuwait timezone
- **Cloud Function**: `resetDailyQuotas` (scheduled daily)
- **API Routes**:
  - `POST /api/billing/consume` - Consume tokens
  - `GET /api/billing/usage` - Check remaining quota

**Usage Example**:
```ts
const token = await user.getIdToken();
await fetch('/api/billing/consume', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tokens: 100 })
});
```

### 2. Figma Integration

- **Auto-sync**: Pulls design assets every 6 hours
- **On-demand**: Admins can trigger via `figmaPullOnDemand` callable
- **Storage**: Assets saved to `ops_assets` collection

**Configure**:
```bash
export FIGMA_TOKEN="figd_..."
export FIGMA_FILE_IDS="fileId1,fileId2"
firebase functions:config:set figma.token="$FIGMA_TOKEN" figma.file_ids="$FIGMA_FILE_IDS"
```

### 3. Dynamic Branding

- **Customizable**: Colors, logo, mascot, navigation routes
- **Admin UI**: `/ops/branding`
- **Runtime**: Fetched via `/api/branding`

**Data Model**:
```json
{
  "primaryColor": "#7C3AED",
  "accentColor": "#22D3EE",
  "logoUrl": "/logo.svg",
  "mascot": { "name": "F0 Spark", "mood": "friendly", "svgUrl": "/mascots/spark.svg" },
  "routes": [
    { "path": "/dashboard", "label": "Dashboard", "visible": true }
  ]
}
```

### 4. Marketplace

- **Install Add-ons**: Browse and install extensions
- **Policy Guard**: All installs checked via Phase 39 policies
- **Audit Trail**: Logged to `ops_audit` collection

### 5. VS Code Extension

Commands:
- `F0: Login to Firebase`
- `F0: Deploy Phase`
- `F0: Open Firebase Dashboard`
- `F0: Tail Cloud Functions Logs`

**Install**:
```bash
cd vscode-extension
npm install
npm run build
code --install-extension ./f0-ops-helper-0.1.0.vsix
```

---

## Security

**Firestore Rules** (Phase 44):
- `ops_user_plans`: Users read own, CF writes
- `ops_branding`: Public read, admin write
- `ops_marketplace_items`: Public read, admin write
- `ops_assets`: Public read, CF writes
- `ops_audit`: Admin read, CF writes

---

## Schedulers

| Function | Schedule | Purpose |
|----------|----------|---------|
| `resetDailyQuotas` | Daily 00:00 Asia/Kuwait | Reset all user quotas |
| `figmaScheduledPull` | Every 6 hours | Sync Figma assets |

---

## Troubleshooting

**Quota not resetting?**
Check scheduler logs: `firebase functions:log --only resetDailyQuotas`

**Figma not syncing?**
1. Verify `FIGMA_TOKEN` is set
2. Check file IDs are valid
3. Manual trigger: Call `figmaPullOnDemand` from admin dashboard

**Marketplace install blocked?**
- Check `ops_audit` for policy guard reason
- Verify user has correct permissions

---

## API Reference

### POST /api/billing/consume
Consumes tokens from user's daily quota.

**Headers**: `Authorization: Bearer <idToken>`
**Body**: `{ "tokens": number }`
**Response**: `{ "ok": true, "consumed": number }`

### GET /api/billing/usage
Returns current quota usage.

**Headers**: `Authorization: Bearer <idToken>`
**Response**: `{ "dailyQuota": 500, "usedToday": 120, "remaining": 380 }`

### GET /api/integrations/figma/files
Lists all Figma assets.

**Response**: `{ "items": Asset[] }`

### GET /api/marketplace/items
Lists marketplace items.

**Response**: `{ "items": MarketplaceItem[] }`

### POST /api/marketplace/install
Requests installation of marketplace item.

**Headers**: `Authorization: Bearer <idToken>`
**Body**: `{ "itemId": string }`
**Response**: `{ "ok": true, "itemId": string }`

---

## Next Steps

- **Phase 44.1**: Premium plans with higher quotas
- **Phase 44.2**: Custom mascot generator
- **Phase 44.3**: Advanced marketplace with ratings
- **Phase 44.4**: Developer API keys for quota
