# F0 CLI Bridge for Cursor IDE

Phase 84.8: Cross-platform CLI tool for integrating Cursor and other IDEs with F0 AI Agent.

## Overview

The Cursor F0 Bridge is a command-line interface that allows any IDE or text editor to communicate with the F0 AI Agent system. It implements the same F0 IDE Bridge Protocol used by the VS Code extension, demonstrating protocol reusability across different clients.

## Features

- OAuth authentication with F0
- Project linking and session management
- AI-powered chat with workspace context awareness
- Automatic collection of:
  - Git changed files
  - Package.json dependencies
  - Source file structure
- Patch suggestion support
- Cross-platform (macOS, Linux, Windows)

## Installation

### From Source

```bash
cd ide/cursor-f0-bridge
npm install
npm run build
```

### Global Installation (Optional)

```bash
npm link
```

This makes the `f0` command available globally.

## Quick Start

### 1. Authenticate with F0

```bash
f0 login
```

This will open your browser to complete OAuth authentication. The CLI will wait for the callback.

### 2. Link Your Project

Navigate to your project directory and link it to an F0 project:

```bash
cd /path/to/your/project
f0 init <projectId>
```

This creates a `.f0/config.json` file in your project directory.

### 3. Create an IDE Session

```bash
f0 session
```

This creates a new IDE session for communicating with the F0 agent.

### 4. Chat with F0 Agent

```bash
f0 chat "Help me fix the authentication bug"
```

Include workspace context (recommended):

```bash
f0 chat "Refactor this component" --with-context
```

## Commands

### Authentication

**f0 login**
Authenticate with F0 using OAuth

Options:
- `--api-base <url>` - API base URL (default: http://localhost:3030)

**f0 logout**
Clear stored authentication

**f0 status**
Show current configuration and authentication status

### Project Management

**f0 init <projectId>**
Link current directory to F0 project

Options:
- `--api-base <url>` - API base URL (default: http://localhost:3030)

**f0 session**
Create or show current IDE session

Options:
- `--new` - Force create new session

### AI Interaction

**f0 chat <message>**
Send chat message to F0 agent

Options:
- `--locale <locale>` - Language locale (en or ar, default: en)
- `--with-context` - Include workspace context (recommended)

**f0 context**
Show or upload workspace context

Options:
- `--upload` - Upload context to F0 backend
- `--show` - Show context (default)

## Configuration Files

### Global Config (~/.f0/config.json)

Stores authentication token and API base URL:

```json
{
  "apiBase": "http://localhost:3030",
  "token": {
    "accessToken": "...",
    "expiresAt": 1234567890
  }
}
```

### Project Config (.f0/config.json)

Stores project-specific configuration:

```json
{
  "projectId": "your-project-id",
  "apiBase": "http://localhost:3030",
  "sessionId": "session-123"
}
```

## Workspace Context

The CLI automatically collects workspace information when using `--with-context`:

- **Git Changes**: Modified, added, deleted files from git diff
- **Dependencies**: Dependencies and devDependencies from package.json
- **Source Files**: Common source files (.ts, .tsx, .js, .jsx, .py, etc.)

This context helps the AI agent provide more accurate and project-aware responses.

## Example Workflows

### Fix a Bug

```bash
f0 chat "There's a bug in the login function where users can't sign in" --with-context
```

### Refactor Code

```bash
f0 chat "Refactor the UserProfile component to use hooks instead of classes" --with-context
```

### Add New Feature

```bash
f0 chat "Add a dark mode toggle to the settings page" --with-context
```

### Code Review

```bash
f0 chat "Review my recent changes and suggest improvements" --with-context
```

## Development

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Development Mode

```bash
npm run dev -- <command>
```

Example:
```bash
npm run dev -- status
npm run dev -- chat "Hello F0"
```

## Architecture

### Components

**AuthManager** ([src/auth/authManager.ts](src/auth/authManager.ts))
- OAuth flow with local HTTP server for callback
- Token storage in ~/.f0/config.json
- Token validation and refresh

**F0Client** ([src/api/f0Client.ts](src/api/f0Client.ts))
- Session creation
- Chat message sending
- Context upload/retrieval
- API communication with F0 backend

**ContextCollector** ([src/context/contextCollector.ts](src/context/contextCollector.ts))
- Git diff parsing
- Package.json reading
- Source file discovery
- Workspace context aggregation

**ProjectBinding** ([src/config/projectBinding.ts](src/config/projectBinding.ts))
- Project configuration management
- Session ID persistence

### Protocol Compliance

This CLI implements the F0 IDE Bridge Protocol v1:

- Uses `/api/ide/session` for session creation
- Uses `/api/ide/chat` for agent communication
- Uses `/api/ide/context` for workspace context
- Sends `clientKind: 'cursor-like'` to identify itself
- Supports all protocol features: file context, workspace context, patch suggestions

## Integration with Cursor

To use with Cursor IDE, you can:

1. Add custom keyboard shortcuts that run `f0` commands
2. Use Cursor's terminal integration
3. Create custom Cursor rules that invoke `f0 chat`

Example Cursor rule:

```
When user selects code and types "@f0", run:
f0 chat "$SELECTION" --with-context
```

## Troubleshooting

### Authentication Issues

If authentication fails:

```bash
f0 logout
f0 login
```

### Session Expired

Create a new session:

```bash
f0 session --new
```

### API Connection Issues

Check your API base URL:

```bash
f0 status
```

Update if needed:

```bash
f0 init <projectId> --api-base http://your-api-url
```

### Permission Errors

Make sure the CLI script is executable:

```bash
chmod +x dist/cli.js
```

## Roadmap

- [ ] Support for file context (specific file + selection)
- [ ] Interactive mode with continuous chat
- [ ] Rich terminal UI with progress indicators
- [ ] Patch application helpers (apply diff to files)
- [ ] IDE-specific integrations (Cursor plugins, VSCode Marketplace)
- [ ] Support for streaming responses
- [ ] Multi-project management
- [ ] Context caching for faster responses

## Contributing

This is part of the F0 project. See main project README for contribution guidelines.

## License

MIT
