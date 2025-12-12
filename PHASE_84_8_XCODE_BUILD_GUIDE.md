# Phase 84.8: Xcode Extension - Complete Build Guide

**Status**: Ready to Build
**Platform**: macOS only
**Prerequisites**: Xcode 14+, Node.js 18+, macOS 13+

---

## Overview

This guide walks you through building the F0 Xcode Source Editor Extension, which allows developers to use F0 AI directly within Xcode.

**Architecture**:
```
Xcode Extension (Swift)
    ↓ (subprocess call)
f0-xcode-helper (Node.js CLI)
    ↓ (HTTP)
F0 Backend API
```

---

## Part 1: Build Node.js Helper (15 minutes)

### Step 1.1: Navigate to Helper Directory

```bash
cd /Users/abdo/Desktop/from-zero-working/ide/xcode-f0-bridge/F0XcodeHelper
```

### Step 1.2: Verify Files Exist

Check that these files exist:
```bash
ls -la src/
# Should show:
# - helperService.ts
# - router.ts
# - authManager.ts
# - f0Client.ts
# - sessionManager.ts
# - projectBinding.ts
# - contextCollector.ts
```

### Step 1.3: Install Dependencies

```bash
npm install
```

**Expected output**: 37 packages installed, 0 vulnerabilities

### Step 1.4: Build TypeScript

```bash
npm run build
```

**Expected output**:
```
> f0-xcode-helper@0.0.1 build
> tsc -p ./

✓ Build completed (0 errors)
```

### Step 1.5: Link Globally

```bash
npm link
```

**Expected output**:
```
/usr/local/bin/f0-xcode-helper -> /usr/local/lib/node_modules/f0-xcode-helper/dist/helperService.js
```

### Step 1.6: Verify Installation

```bash
which f0-xcode-helper
```

**Expected**: `/usr/local/bin/f0-xcode-helper`

### Step 1.7: Test Helper

```bash
echo '{"command":"ping"}' | f0-xcode-helper
```

**Expected**: JSON response (may be error if not authenticated, but proves CLI works)

✅ **Checkpoint**: Node.js helper is now globally available

---

## Part 2: Create Xcode Extension Project (20 minutes)

### Step 2.1: Open Xcode

Launch Xcode and create a new project:
```
File → New → Project...
```

### Step 2.2: Select Template

1. Platform: **macOS**
2. Filter: **App Extension**
3. Select: **Xcode Source Editor Extension**
4. Click **Next**

### Step 2.3: Configure Project

**Product Name**: `F0XcodeExtension`
**Organization Identifier**: `com.fromzero.xcode` (or your own)
**Language**: **Swift**
**Save Location**: `/Users/abdo/Desktop/from-zero-working/ide/xcode-f0-bridge/F0XcodeExtension`

Click **Create**

### Step 2.4: Verify Project Structure

Xcode creates:
```
F0XcodeExtension/
├── F0XcodeExtension.xcodeproj
├── F0XcodeExtension/
│   ├── SourceEditorExtension.swift
│   ├── SourceEditorCommand.swift
│   ├── Info.plist
│   └── F0XcodeExtension.entitlements
```

✅ **Checkpoint**: Xcode project created

---

## Part 3: Add Swift Source Files (15 minutes)

### Step 3.1: Delete Default Files

In Xcode Project Navigator (left sidebar):
1. Right-click **SourceEditorExtension.swift** → Delete → Move to Trash
2. Right-click **SourceEditorCommand.swift** → Delete → Move to Trash

### Step 3.2: Extract Swift Code from Skeleton

Open the skeleton document:
```bash
open /Users/abdo/Desktop/from-zero-working/PHASE_84_8_2_XCODE_BRIDGE_SKELETON.md
```

The skeleton contains 3 Swift files (search for "Swift Implementation" section):
1. **F0SourceEditorCommand.swift** (main command handler)
2. **F0HelperBridge.swift** (subprocess communication)
3. **F0ResponseWindow.swift** (UI display)

### Step 3.3: Create F0SourceEditorCommand.swift

In Xcode:
1. Right-click **F0XcodeExtension** folder → New File...
2. Select **Swift File**
3. Name: `F0SourceEditorCommand.swift`
4. Copy code from skeleton document (section: "F0SourceEditorCommand.swift")
5. Save

### Step 3.4: Create F0HelperBridge.swift

Repeat for second file:
1. New File... → Swift File
2. Name: `F0HelperBridge.swift`
3. Copy code from skeleton (section: "F0HelperBridge.swift")
4. **Important**: Verify helper path is correct:
   ```swift
   task.launchPath = "/usr/local/bin/f0-xcode-helper"
   ```
5. Save

### Step 3.5: Create F0ResponseWindow.swift

Repeat for third file:
1. New File... → Swift File
2. Name: `F0ResponseWindow.swift`
3. Copy code from skeleton (section: "F0ResponseWindow.swift")
4. Save

✅ **Checkpoint**: All 3 Swift files added to project

---

## Part 4: Configure Info.plist (10 minutes)

### Step 4.1: Open Info.plist

In Xcode Project Navigator:
1. Click **F0XcodeExtension** folder
2. Click **Info.plist**

### Step 4.2: Add Command Definitions

Look for key: `NSExtension` → `NSExtensionAttributes`

Add or modify `XCSourceEditorCommandDefinitions`:

```xml
<key>XCSourceEditorCommandDefinitions</key>
<array>
    <dict>
        <key>XCSourceEditorCommandClassName</key>
        <string>F0SourceEditorCommand</string>
        <key>XCSourceEditorCommandIdentifier</key>
        <string>com.f0.xcode.ask</string>
        <key>XCSourceEditorCommandName</key>
        <string>F0 — Ask AI</string>
    </dict>
    <dict>
        <key>XCSourceEditorCommandClassName</key>
        <string>F0SourceEditorCommand</string>
        <key>XCSourceEditorCommandIdentifier</key>
        <string>com.f0.xcode.fix</string>
        <key>XCSourceEditorCommandName</key>
        <string>F0 — Fix Code</string>
    </dict>
    <dict>
        <key>XCSourceEditorCommandClassName</key>
        <string>F0SourceEditorCommand</string>
        <key>XCSourceEditorCommandIdentifier</key>
        <string>com.f0.xcode.refactor</string>
        <key>XCSourceEditorCommandName</key>
        <string>F0 — Refactor</string>
    </dict>
    <dict>
        <key>XCSourceEditorCommandClassName</key>
        <string>F0SourceEditorCommand</string>
        <key>XCSourceEditorCommandIdentifier</key>
        <string>com.f0.xcode.explainFile</string>
        <key>XCSourceEditorCommandName</key>
        <string>F0 — Explain File</string>
    </dict>
</array>
```

### Step 4.3: Save Info.plist

Press `Cmd+S` to save

✅ **Checkpoint**: Extension commands configured

---

## Part 5: Code Signing (5 minutes)

### Step 5.1: Select Target

1. Click **F0XcodeExtension** project (top of navigator)
2. Select **Targets** → **F0XcodeExtension**
3. Select **Signing & Capabilities** tab

### Step 5.2: Configure Signing

**Team**: Select your Apple ID
**Signing Certificate**: Development
**Bundle Identifier**: `com.fromzero.xcode.F0XcodeExtension` (or your own)

**Automatically manage signing**: ✅ Checked

### Step 5.3: Verify No Errors

Bottom of signing section should show:
```
✓ Signing certificate "Apple Development" is valid
```

✅ **Checkpoint**: Extension is code-signed

---

## Part 6: Build Extension (5 minutes)

### Step 6.1: Select Scheme

Top-left of Xcode toolbar:
1. Click scheme dropdown (next to Stop button)
2. Select: **F0XcodeExtension**
3. Select: **My Mac** (not simulator)

### Step 6.2: Build

Press `Cmd+B` to build

**Expected output** in build log:
```
Build Succeeded
```

### Step 6.3: Check for Errors

If build fails, common issues:
- Missing Swift files → Re-add files
- Wrong class names → Match Info.plist exactly
- Signing issues → Re-select Team

✅ **Checkpoint**: Extension builds successfully

---

## Part 7: Run & Enable Extension (10 minutes)

### Step 7.1: Run Extension

Press `Cmd+R` (Run)

**Xcode will ask**: "Choose an app to run"
- Select: **Xcode.app**
- Click **Run**

A second instance of Xcode will launch (Extension Host)

### Step 7.2: Enable Extension in System Settings

**macOS 13+**:
1. Open **System Settings**
2. Go to **Privacy & Security** → **Extensions**
3. Find **Xcode Source Editor**
4. Enable: **F0XcodeExtension**

**macOS 12 and earlier**:
1. Open **System Preferences**
2. Go to **Extensions**
3. Find **Xcode Source Editor**
4. Check: **F0XcodeExtension**

### Step 7.3: Verify Extension Appears in Xcode

In the Extension Host Xcode:
1. Open any Swift file
2. Click **Editor** menu (top menu bar)
3. Look for submenu: **F0 — Ask AI**, **F0 — Fix Code**, etc.

✅ **Checkpoint**: Extension is enabled and visible

---

## Part 8: macOS Permissions (10 minutes)

### Step 8.1: Allow Developer Tools

**System Settings** → **Privacy & Security** → **Developer Tools**

Enable:
- ✅ Xcode
- ✅ Terminal
- ✅ node

### Step 8.2: Make Helper Executable

```bash
chmod +x /usr/local/bin/f0-xcode-helper
```

### Step 8.3: Test Helper Permissions

```bash
/usr/local/bin/f0-xcode-helper --version
```

If permission denied, run:
```bash
sudo chmod 755 /usr/local/bin/f0-xcode-helper
```

### Step 8.4: Allow Network Connections

First time helper runs, macOS may ask:
```
"node" would like to accept incoming network connections.
```
Click **Allow**

✅ **Checkpoint**: All permissions granted

---

## Part 9: Authentication (5 minutes)

### Step 9.1: Login to F0

Open Terminal and run:
```bash
f0-xcode-helper login
```

**Expected**:
1. Browser opens
2. Google OAuth screen appears
3. After login, redirects to `http://localhost:14142/callback`
4. Terminal shows: "✓ Authentication successful"

### Step 9.2: Verify Token Stored

```bash
cat ~/Library/Application\ Support/F0/f0-config.json
```

Should contain:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "uid": "...",
  "apiBase": "http://localhost:3030"
}
```

✅ **Checkpoint**: Authenticated with F0 backend

---

## Part 10: Project Binding (5 minutes)

### Step 10.1: Navigate to Xcode Project Directory

```bash
cd ~/path/to/your/ios-project
```

### Step 10.2: Initialize F0 Project

```bash
f0-xcode-helper init <your-project-id>
```

Replace `<your-project-id>` with actual project ID from F0 dashboard.

**Expected output**:
```
✓ Project linked successfully
  Config saved to: .f0/config.json
```

### Step 10.3: Verify Config Created

```bash
cat .f0/config.json
```

Should contain:
```json
{
  "projectId": "your-project-id",
  "apiBase": "http://localhost:3030"
}
```

✅ **Checkpoint**: Project linked to F0

---

## Part 11: First Test (10 minutes)

### Step 11.1: Open Swift File in Extension Host Xcode

In the Extension Host Xcode (the one that opened when you ran the extension):
1. Open any `.swift` file
2. Select a few lines of code (e.g., a function)

### Step 11.2: Trigger Extension

**Method 1**: Menu
- Click **Editor** → **F0 — Ask AI**

**Method 2**: Context Menu
- Right-click selected code → **F0 — Ask AI**

### Step 11.3: Expected Behavior

1. Extension calls helper subprocess
2. Helper reads token from `~/Library/Application Support/F0/f0-config.json`
3. Helper reads project config from `.f0/config.json`
4. Helper creates/reuses IDE session
5. Helper sends chat request with file context
6. Helper receives AI response
7. Extension displays modal window with response

**Success looks like**:
```
┌─────────────────────────────────────┐
│         F0 AI Response              │
├─────────────────────────────────────┤
│ This function appears to...         │
│                                     │
│ [AI explanation of selected code]   │
│                                     │
│                  [Copy] [OK]        │
└─────────────────────────────────────┘
```

### Step 11.4: If It Fails

Check logs:
```bash
# Xcode extension logs
log stream --predicate 'subsystem contains "com.fromzero.xcode"' --level debug

# Helper logs (add console.log to helper code)
tail -f ~/.f0/helper.log
```

Common issues:
- **401 Unauthorized**: Run `f0-xcode-helper login` again
- **404 Project not found**: Check `.f0/config.json` has correct projectId
- **Helper not found**: Verify `/usr/local/bin/f0-xcode-helper` exists
- **Permission denied**: Run `chmod +x /usr/local/bin/f0-xcode-helper`

✅ **Checkpoint**: Extension works end-to-end!

---

## Part 12: Advanced Testing

### Test Case 1: Ask AI

1. Select code snippet
2. **Editor** → **F0 — Ask AI**
3. Verify: AI explains what the code does

### Test Case 2: Fix Code

1. Select code with intentional error
2. **Editor** → **F0 — Fix Code**
3. Verify: AI suggests fix

### Test Case 3: Refactor

1. Select function
2. **Editor** → **F0 — Refactor**
3. Verify: AI suggests improvements

### Test Case 4: Explain File

1. Open file (no selection needed)
2. **Editor** → **F0 — Explain File**
3. Verify: AI explains entire file

---

## Troubleshooting

### Issue: Extension doesn't appear in Editor menu

**Solution**:
1. Quit both Xcode instances
2. Re-enable extension in System Settings
3. Restart Xcode and run extension again

### Issue: "f0-xcode-helper: command not found"

**Solution**:
```bash
cd /Users/abdo/Desktop/from-zero-working/ide/xcode-f0-bridge/F0XcodeHelper
npm link
```

### Issue: Helper returns 401 Unauthorized

**Solution**:
```bash
f0-xcode-helper login
```

### Issue: Helper can't find project

**Solution**:
```bash
cd /path/to/your/xcode/project
f0-xcode-helper init <project-id>
```

### Issue: Modal window doesn't show

**Solution**:
- Check Xcode console for errors
- Verify `F0ResponseWindow.swift` is included in build
- Check Swift syntax in all 3 files

### Issue: macOS blocks helper execution

**Solution**:
1. **System Settings** → **Privacy & Security**
2. Look for message: "f0-xcode-helper was blocked"
3. Click **Allow Anyway**
4. Run helper again

---

## Production Deployment

### Step 1: Archive Extension

1. Xcode → **Product** → **Archive**
2. Wait for archive to complete
3. **Window** → **Organizer** → **Archives**

### Step 2: Export for Distribution

1. Select archive
2. Click **Distribute App**
3. Choose: **Developer ID** (for distribution outside Mac App Store)
4. Follow signing steps

### Step 3: Notarize Extension

```bash
# Submit for notarization
xcrun notarytool submit F0XcodeExtension.zip \
  --apple-id your-email@example.com \
  --team-id YOUR_TEAM_ID \
  --password YOUR_APP_SPECIFIC_PASSWORD
```

### Step 4: Distribute

- Upload to your website
- Provide install instructions
- Users enable in System Settings → Extensions

---

## Summary

You've successfully built and tested the F0 Xcode Extension!

**What You Built**:
- ✅ Node.js helper CLI (`f0-xcode-helper`)
- ✅ Swift Xcode Source Editor Extension
- ✅ OAuth authentication flow
- ✅ Project binding system
- ✅ File context collection
- ✅ AI response display

**Next Steps**:
- Test with real iOS/macOS projects
- Customize UI (colors, fonts, layout)
- Add keyboard shortcuts
- Add inline diff view
- Implement patch application
- Publish to Mac App Store (optional)

---

**Phase 84.8 Xcode Extension Build Complete!** 🎉
