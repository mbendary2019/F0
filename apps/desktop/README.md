# F0 Desktop - Electron App

Autonomous Ops Desktop Client built with Electron.

## Architecture

```
┌─────────────────────────────────────────┐
│         Electron BrowserWindow          │
│  ┌───────────────────────────────────┐  │
│  │   Renderer (Next.js @ /desktop)   │  │
│  │   - React UI                      │  │
│  │   - Tailwind CSS                  │  │
│  │   - window.f0 API                 │  │
│  └───────────────────────────────────┘  │
│                  ↕                       │
│  ┌───────────────────────────────────┐  │
│  │   Preload (contextBridge)         │  │
│  │   - Expose safe IPC handlers      │  │
│  └───────────────────────────────────┘  │
│                  ↕                       │
│  ┌───────────────────────────────────┐  │
│  │   Main Process (Node.js)          │  │
│  │   - IPC handlers                  │  │
│  │   - F0 SDK integration            │  │
│  │   - System access                 │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
pnpm install

# Build (compile TypeScript → JavaScript)
pnpm build

# Start development (auto-starts Next.js + Electron)
pnpm dev
```

## Production

```bash
# Build app
pnpm build

# Start app
pnpm start
```

## Window API

The app exposes a `window.f0` API to the renderer:

```typescript
// Execute command via F0 orchestrator
await window.f0.execute('deploy', ['--env', 'prod']);

// Get telemetry stats
const stats = await window.f0.telemetry();

// Execute safe local command
const version = await window.f0.execSafe('node -v');

// Get app info
const info = await window.f0.getAppInfo();
```

## Security

- **Context Isolation**: Enabled
- **Node Integration**: Disabled
- **Sandbox**: Enabled
- **Web Security**: Enabled
- **Whitelist**: Only approved commands allowed

## Integration with Phase 33.3

The desktop app integrates with autonomous ops:

- Executes commands via agent coordinator
- Displays real-time telemetry
- Monitors policy decisions
- Shows guardrail status
- Provides manual override interface

## Next Steps

1. [ ] Add Firebase Auth integration
2. [ ] Implement deep linking
3. [ ] Add auto-updates (electron-updater)
4. [ ] Create app icons
5. [ ] Setup code signing
6. [ ] Package for distribution (macOS, Windows, Linux)


