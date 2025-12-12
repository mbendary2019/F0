# Phase 84.8.2: Xcode Bridge - Implementation Skeleton

## Overview

This document contains the complete skeleton implementation for the F0 Xcode Bridge, which consists of:
1. **Node.js Helper Service** - Handles API communication (similar to Cursor Bridge)
2. **Swift Xcode Source Editor Extension** - Provides UI integration with Xcode

## Status

- Folder structure: ✅ Created
- Node.js Helper: ⚠️ Partial (helperService.ts, router.ts, authManager.ts created)
- Swift Extension: ⏳ Pending (skeleton provided below)
- Build Configuration: ⏳ Pending

## Directory Structure

```
ide/xcode-f0-bridge/
├── F0XcodeHelper/              # Node.js Helper Daemon
│   ├── src/
│   │   ├── helperService.ts    # ✅ Main entry point
│   │   ├── router.ts           # ✅ Command router
│   │   ├── authManager.ts      # ✅ OAuth handler
│   │   ├── f0Client.ts         # ⏳ API client
│   │   ├── sessionManager.ts   # ⏳ Session management
│   │   ├── projectBinding.ts   # ⏳ Project config
│   │   └── contextCollector.ts # ⏳ Workspace context
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
└── F0XcodeExtension/           # Swift Extension
    ├── Sources/
    │   ├── F0SourceEditorCommand.swift
    │   ├── F0HelperBridge.swift
    │   └── F0ResponseWindow.swift
    ├── Info.plist
    └── F0XcodeExtension.xcodeproj
```

## Already Implemented

### 1. helperService.ts ✅
- Entry point for CLI calls from Xcode extension
- Parses JSON arguments
- Routes to handleXcodeMessage()

### 2. router.ts ✅
- Routes commands (ask, fix, refactor, explain)
- Detects file language (Swift, Objective-C, etc.)
- Builds file context and calls F0 API

### 3. authManager.ts ✅
- OAuth flow with local HTTP server (port 14142)
- Token storage in ~/Library/Application Support/F0/
- Token validation

## Remaining Node.js Files

### f0Client.ts

```typescript
/**
 * F0 API Client for Xcode Helper
 */

import fetch from 'node-fetch';
import { authManager } from './authManager';
import { sessionManager } from './sessionManager';

const BACKEND = process.env.F0_BACKEND_URL || 'http://localhost:3030';

export const f0Client = {
  async chat(
    message: string,
    fileContext: any,
    workspaceContext: any
  ): Promise<any> {
    const sessionId = await sessionManager.ensureSession();

    const payload = {
      message,
      sessionId,
      projectId: process.env.F0_PROJECT_ID || 'default',
      fileContext,
      workspaceContext,
      locale: 'en',
    };

    const res = await fetch(`${BACKEND}/api/ide/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authManager.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error: ${res.status} ${errorText}`);
    }

    return res.json();
  },
};
```

### sessionManager.ts

```typescript
/**
 * Session Manager for Xcode Helper
 */

import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { authManager } from './authManager';

const SESSION_PATH = path.join(process.cwd(), '.f0', 'session.json');
const BACKEND = process.env.F0_BACKEND_URL || 'http://localhost:3030';

export const sessionManager = {
  async ensureSession(): Promise<string> {
    // Check existing session
    if (fs.existsSync(SESSION_PATH)) {
      try {
        const data = fs.readFileSync(SESSION_PATH, 'utf-8');
        const { sessionId } = JSON.parse(data);
        if (sessionId) {
          return sessionId;
        }
      } catch {
        // Continue to create new session
      }
    }

    // Create new session
    const res = await fetch(`${BACKEND}/api/ide/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authManager.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: process.env.F0_PROJECT_ID || 'default',
        clientKind: 'cursor-like', // Xcode uses same protocol
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }

    const json = await res.json();
    const sessionId = json.id;

    // Save session
    const dir = path.dirname(SESSION_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SESSION_PATH, JSON.stringify({ sessionId }, null, 2));

    return sessionId;
  },
};
```

### projectBinding.ts

```typescript
/**
 * Project Binding for Xcode Helper
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), '.f0', 'config.json');

export const projectBinding = {
  async ensureProjectBound(): Promise<void> {
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(
        'No F0 project linked. Please create .f0/config.json with projectId'
      );
    }

    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(data);

      if (!config.projectId) {
        throw new Error('No projectId found in .f0/config.json');
      }

      // Set environment variable for other modules
      process.env.F0_PROJECT_ID = config.projectId;

      if (config.apiBase) {
        process.env.F0_BACKEND_URL = config.apiBase;
      }
    } catch (err: any) {
      throw new Error(`Failed to read project config: ${err.message}`);
    }
  },
};
```

### contextCollector.ts

```typescript
/**
 * Workspace Context Collector for Xcode Helper
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function collectWorkspaceContext(): Promise<any> {
  const cwd = process.cwd();

  return {
    projectId: process.env.F0_PROJECT_ID || 'default',
    sessionId: '', // Will be filled by caller
    changedFiles: getGitChangedFiles(cwd),
    packageJson: getPackageJsonInfo(cwd),
    timestamp: Date.now(),
  };
}

function getGitChangedFiles(cwd: string): any[] {
  try {
    const output = execSync('git diff --name-status HEAD', {
      cwd,
      encoding: 'utf8',
    });

    const changedFiles: any[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const [statusCode, filePath] = trimmed.split(/\s+/);
      let status: 'modified' | 'added' | 'deleted';

      if (statusCode.startsWith('M')) {
        status = 'modified';
      } else if (statusCode.startsWith('A')) {
        status = 'added';
      } else if (statusCode.startsWith('D')) {
        status = 'deleted';
      } else {
        continue;
      }

      changedFiles.push({ path: filePath, status });
    }

    return changedFiles;
  } catch {
    return [];
  }
}

function getPackageJsonInfo(cwd: string): any {
  const packageJsonPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);

    return {
      path: 'package.json',
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    };
  } catch {
    return undefined;
  }
}
```

## Swift Xcode Extension Files

### F0SourceEditorCommand.swift

```swift
import Foundation
import XcodeKit

class F0SourceEditorCommand: NSObject, XCSourceEditorCommand {

    func perform(
        with invocation: XCSourceEditorCommandInvocation,
        completionHandler: @escaping (Error?) -> Void
    ) {
        let buffer = invocation.buffer
        let text = buffer.completeBuffer
        let filePath = buffer.contentUTI ?? ""

        // Get selected text
        let selectionRanges = buffer.selections.compactMap { $0 as? XCSourceTextRange }
        let selectedText = selectionRanges
            .map { extractText(from: buffer, range: $0) }
            .joined(separator: "\n")

        let command = invocation.commandIdentifier

        let request: [String: Any] = [
            "command": command,
            "filePath": filePath,
            "content": text,
            "selection": selectedText
        ]

        F0HelperBridge.shared.sendRequest(json: request) { response in
            DispatchQueue.main.async {
                F0ResponseWindow.show(message: response)
            }
            completionHandler(nil)
        }
    }

    private func extractText(
        from buffer: XCSourceTextBuffer,
        range: XCSourceTextRange
    ) -> String {
        let startLine = range.start.line
        let endLine = range.end.line

        guard startLine < buffer.lines.count else { return "" }

        var result = ""
        for lineIndex in startLine...min(endLine, buffer.lines.count - 1) {
            if let lineText = buffer.lines[lineIndex] as? String {
                result += lineText
            }
        }

        return result
    }
}
```

### F0HelperBridge.swift

```swift
import Foundation

class F0HelperBridge {

    static let shared = F0HelperBridge()

    func sendRequest(json: [String: Any], completion: @escaping (String) -> Void) {
        guard let data = try? JSONSerialization.data(withJSONObject: json) else {
            completion("Failed to encode JSON")
            return
        }

        guard let jsonString = String(data: data, encoding: .utf8) else {
            completion("Failed to convert JSON to string")
            return
        }

        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/local/bin/f0-xcode-helper")
        task.arguments = [jsonString]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        do {
            try task.run()
            task.waitUntilExit()

            let output = pipe.fileHandleForReading.readDataToEndOfFile()
            let responseString = String(decoding: output, as: UTF8.self)

            completion(responseString)
        } catch {
            completion("Error: \(error.localizedDescription)")
        }
    }
}
```

### F0ResponseWindow.swift

```swift
import AppKit

class F0ResponseWindow {

    static func show(message: String) {
        // Parse JSON response
        var displayMessage = message
        var hasPatches = false

        if let data = message.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let success = json["success"] as? Bool {

            if success {
                displayMessage = json["message"] as? String ?? "Success"

                if let patch = json["patchSuggestion"] as? [String: Any],
                   let hasPatch = patch["hasPatch"] as? Bool,
                   hasPatch,
                   let patchText = patch["patchText"] as? String {
                    hasPatches = true
                    displayMessage += "\n\n--- Suggested Changes ---\n\(patchText)"
                }
            } else {
                displayMessage = json["error"] as? String ?? "Unknown error"
            }
        }

        let alert = NSAlert()
        alert.messageText = "F0 AI Assistant"
        alert.informativeText = displayMessage
        alert.alertStyle = .informational

        if hasPatches {
            alert.addButton(withTitle: "Copy Patch")
            alert.addButton(withTitle: "Close")
        } else {
            alert.addButton(withTitle: "OK")
        }

        let response = alert.runModal()

        if response == .alertFirstButtonReturn && hasPatches {
            // Copy to clipboard
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(displayMessage, forType: .string)
        }
    }
}
```

## package.json for F0XcodeHelper

```json
{
  "name": "f0-xcode-helper",
  "version": "0.0.1",
  "description": "F0 Helper Daemon for Xcode Source Editor Extension",
  "main": "dist/helperService.js",
  "bin": {
    "f0-xcode-helper": "./dist/helperService.js"
  },
  "scripts": {
    "build": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "dev": "tsx src/helperService.ts"
  },
  "keywords": ["f0", "xcode", "ai", "assistant"],
  "author": "From Zero",
  "license": "MIT",
  "dependencies": {
    "node-fetch": "^2.7.0",
    "open": "^8.4.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/node-fetch": "^2.6.9",
    "typescript": "^5.6.0",
    "tsx": "^4.7.0"
  }
}
```

## tsconfig.json for F0XcodeHelper

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Setup Instructions

### Node.js Helper

```bash
cd ide/xcode-f0-bridge/F0XcodeHelper
npm install
npm run build

# Install globally (makes f0-xcode-helper available)
npm link
```

### Xcode Extension

1. Open Xcode
2. File → New → Project
3. Choose "Xcode Source Editor Extension"
4. Name: F0XcodeExtension
5. Add the three Swift files above
6. Configure Info.plist with menu commands
7. Build and run
8. Enable extension in System Preferences → Extensions → Xcode Source Editor

## Testing

```bash
# 1. Test helper directly
echo '{"command":"f0.ask","filePath":"test.swift","content":"let x = 5","selection":"let x = 5"}' | f0-xcode-helper

# 2. Authenticate
cd your-xcode-project
f0-xcode-helper --login

# 3. Create .f0/config.json
mkdir .f0
echo '{"projectId":"your-project-id","apiBase":"http://localhost:3030"}' > .f0/config.json

# 4. Test from Xcode
# Select code → Editor → F0 → Ask AI
```

## Next Steps

1. Complete remaining Node.js files (f0Client, sessionManager, projectBinding, contextCollector)
2. Build and test Node.js helper
3. Create Xcode project with Swift files
4. Configure Info.plist for menu commands
5. Build Xcode extension
6. Test end-to-end integration
7. Package for distribution

## Notes

- The helper daemon reuses the same F0 IDE Bridge Protocol
- Xcode extension calls helper via Process (subprocess)
- Helper returns JSON response
- Extension displays response in modal window
- OAuth flow same as Cursor Bridge (different port: 14142)

## Integration with Existing Cursor Bridge

The Xcode Helper can potentially share code with the Cursor Bridge by:
1. Moving shared modules to a common package
2. Creating `@f0/ide-bridge-common` npm package
3. Both clients depend on the common package

This would reduce duplication and ensure protocol consistency.
