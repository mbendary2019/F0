# F0 Live Bridge - VS Code Extension

**Phase 84.2: Extension Skeleton**

Connect your VS Code workspace with the F0 AI Agent for live, patch-based coding assistance.

## Features

- **F0 Assistant Panel**: Chat with F0 agent directly in VS Code
- **Fix Selected Code**: Send code selections to F0 for bug fixes and improvements
- **Local Patch Application**: Apply agent-generated patches directly to your workspace
- **Project Linking**: Connect your workspace to F0 projects for context-aware assistance

## Getting Started

### 1. Setup

```bash
cd ide/vscode-f0-bridge
npm install
```

### 2. Development

```bash
# Watch mode (auto-compile on changes)
npm run watch

# Or build once
npm run build
```

### 3. Test the Extension

1. Open this folder (`ide/vscode-f0-bridge`) in VS Code
2. Press **F5** to launch Extension Development Host
3. In the new VS Code window:
   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Run: `F0: Open Assistant`
   - Chat panel should open

### 4. Configure Settings

In your workspace settings (`.vscode/settings.json`):

```json
{
  "f0.projectId": "your-f0-project-id",
  "f0.apiBase": "http://localhost:3030",
  "f0.apiKey": "your-firebase-auth-token"
}
```

## Commands

- `F0: Open Assistant` - Opens F0 chat panel
- `F0: Fix Selected Code` - Sends selected code to F0 for analysis

## Architecture

```
extension.ts       → Main activation file
panels/
  F0Panel.ts       → Webview panel (chat UI)
patch/
  applyUnifiedDiffToWorkspace.ts  → Local patch application
```

## Current Status (Phase 84.2)

✅ Extension skeleton
✅ Chat UI (echo mode)
✅ Commands registration
✅ Settings configuration
🚧 API integration (Phase 84.3+)
🚧 Patch application (Phase 84.3+)

## Next Steps

**Phase 84.3**: API Integration
- Connect to `/api/ide/session` and `/api/ide/chat`
- Implement patch application using shared patch engine

**Phase 84.4**: Project Linking
- Automatic project detection
- Firebase Auth integration

**Phase 84.5**: Advanced Features
- File context detection
- Diagnostics integration
- Real-time collaboration

## License

MIT
