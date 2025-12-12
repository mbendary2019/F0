# 🚀 F0 OpenAI-Compatible API — Quick Start Guide

**Phase 106 Complete** | Ready for Production

---

## ⚡ 5-Minute Setup

### 1. Start F0 Server

```bash
PORT=3030 pnpm dev
```

### 2. Get Your API Key

```bash
grep F0_EXT_API_KEY .env.local
```

Copy the key (example: `f298b769047167e2c2504ff6fc5d55f9c40f90838e34527d47123470a945351f`)

### 3. Test with CURL

```bash
curl -X POST http://localhost:3030/api/openai_compat/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "f0-code-agent",
    "messages": [
      {"role": "user", "content": "Create a simple React button"}
    ]
  }'
```

✅ You should see full TypeScript code in the response!

---

## 🔌 Connect Continue.dev

### 1. Install Continue Extension

- **VS Code**: Search "Continue" in extensions
- **Cursor**: Built-in, just needs config

### 2. Copy Config File

```bash
cp .continue/config.yaml ~/.continue/config.yaml
```

Or manually create `~/.continue/config.yaml`:

```yaml
models:
  - name: f0-code-agent
    provider: openai
    model: f0-code-agent
    apiBase: http://localhost:3030/api/openai_compat/v1
    apiKey: "YOUR_F0_EXT_API_KEY"
    roles:
      - chat

chat:
  defaultModel: f0-code-agent
```

### 3. Reload VS Code

- Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
- Type "Reload Window"
- Press Enter

### 4. Test in Continue

1. Open Continue sidebar (`Cmd+L`)
2. Select model: `f0-code-agent`
3. Type: "Create a React login form"
4. Get instant code! ✨

---

## 📚 Documentation

### Complete Phase 106 Series

1. **[PHASE_106_OPENAI_COMPAT_COMPLETE.md](PHASE_106_OPENAI_COMPAT_COMPLETE.md)**
   - API infrastructure and architecture
   - Authentication and security
   - Bug fixes and solutions

2. **[PHASE_106_1_CODE_QUALITY_COMPLETE.md](PHASE_106_1_CODE_QUALITY_COMPLETE.md)**
   - Filename quality improvements
   - Smart fallback paths
   - LLM prompt enhancements

3. **[PHASE_106_2_FALLBACK_COMPLETE.md](PHASE_106_2_FALLBACK_COMPLETE.md)**
   - Guaranteed code output
   - Static fallback component
   - Debug logging system

4. **[PHASE_106_2_LLM_BEHAVIOR_COMPLETE.md](PHASE_106_2_LLM_BEHAVIOR_COMPLETE.md)**
   - LLM behavior guarantees
   - Production fallback strategy
   - Zero empty responses

5. **[PHASE_106_3_CONTINUE_INTEGRATION_COMPLETE.md](PHASE_106_3_CONTINUE_INTEGRATION_COMPLETE.md)**
   - Continue.dev setup guide
   - Test scenarios
   - Troubleshooting

---

## 🎯 Common Use Cases

### Use Case 1: Generate React Components

**Prompt:**
```
Create a responsive navbar with logo, menu items, and mobile hamburger
```

**Result:** Full TypeScript React component with:
- ✅ Proper types
- ✅ Mobile responsive
- ✅ Clean styling
- ✅ No placeholders

---

### Use Case 2: Create API Routes

**Prompt:**
```
Create a Next.js API route for user login with email and password
```

**Result:** Complete API route with:
- ✅ Input validation
- ✅ Error handling
- ✅ TypeScript types
- ✅ NextRequest/NextResponse

---

### Use Case 3: Utility Functions

**Prompt:**
```
Create a TypeScript function to debounce user input
```

**Result:** Production-ready utility with:
- ✅ Full TypeScript types
- ✅ Proper implementation
- ✅ Usage examples

---

## 🔐 Security Best Practices

### API Key Management

✅ **DO:**
- Store keys in `.env.local`
- Rotate keys regularly
- Use different keys for dev/prod
- Use HTTPS in production

❌ **DON'T:**
- Commit keys to git
- Share keys publicly
- Use same key everywhere
- Skip authentication

---

## 🐛 Quick Troubleshooting

### Problem: "Unauthorized" Error

**Solution:**
```bash
# Verify key in .env.local
grep F0_EXT_API_KEY .env.local

# Test with correct key
curl -H "Authorization: Bearer YOUR_ACTUAL_KEY" \
  http://localhost:3030/api/openai_compat/v1/models
```

---

### Problem: Empty Code Response

**Solution:**
Phase 106.2 fallback should prevent this. Check logs:

```bash
NODE_ENV=development PORT=3030 pnpm dev
```

Look for `[F0::DEBUG]` messages.

---

### Problem: Continue Not Connecting

**Solutions:**

1. **Check server is running:**
   ```bash
   curl http://localhost:3030/api/openai_compat/v1/models
   ```

2. **Verify config.yaml:**
   ```bash
   cat ~/.continue/config.yaml
   ```

3. **Reload VS Code:**
   `Cmd+Shift+P` → "Reload Window"

---

## 📊 API Endpoints

### 1. List Models

```bash
GET /api/openai_compat/v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "f0-code-agent",
      "object": "model",
      "created": 1732674000,
      "owned_by": "f0"
    }
  ]
}
```

---

### 2. Chat Completions

```bash
POST /api/openai_compat/v1/chat/completions
```

**Request:**
```json
{
  "model": "f0-code-agent",
  "messages": [
    {"role": "system", "content": "You are a helpful coding assistant"},
    {"role": "user", "content": "Create a React button"}
  ]
}
```

**Response:**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1732674000,
  "model": "f0-code-agent",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "import React from 'react';\n\n..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 150,
    "total_tokens": 160
  }
}
```

---

## 🚀 What's Next?

### Immediate Next Steps

1. **Test with Continue** - Try the 3 test scenarios in Phase 106.3 docs
2. **Check Debug Logs** - Run in dev mode and watch `[F0::DEBUG]` output
3. **Try Different Prompts** - Test various component types

### Future Enhancements

- **Streaming Support** (Phase 107) - Real-time code generation
- **File Context** - Send open files to F0 for better context
- **Project Memory** - Leverage existing F0 project memory system
- **Custom Templates** - More fallback component types

---

## 💡 Pro Tips

### Tip 1: Better Prompts = Better Code

❌ **Bad:** "make a button"
✅ **Good:** "Create a TypeScript React button component with primary/secondary variants and onClick handler"

### Tip 2: Use System Messages

Add context in Continue config `systemMessage`:

```yaml
chat:
  systemMessage: |
    You are building a Next.js 14 app with TypeScript and Tailwind.
    Always use app directory conventions.
```

### Tip 3: Leverage Debug Mode

```bash
NODE_ENV=development PORT=3030 pnpm dev
```

Watch for:
- `[F0::DEBUG] runIdeChat request`
- `[F0::DEBUG] runCodeGeneratorAgent output`
- `[F0::DEBUG] No usable files from generator` (fallback triggered)

---

## 📞 Support

### Documentation
- All Phase 106.x markdown files in project root
- Example config: `.continue/config.yaml`

### Testing
- CURL examples in each phase doc
- Continue test scenarios in Phase 106.3

### Debugging
- Enable `NODE_ENV=development`
- Check `[F0::DEBUG]` logs
- Verify API key with `/v1/models` endpoint

---

**Phase 106 Complete** ✅ | F0 is production-ready for external IDE integration!

🚀 Start building with F0 Code Agent today!
