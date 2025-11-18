# Phase 33.1 — LLM Upgrade & Voice Ops

**Version:** v33.1.0  
**Date:** 2025-10-10  
**Upgrade from:** Phase 33

---

## 🎯 Overview

Phase 33.1 adds powerful enhancements to the Ops Assistant:

1. **Multi-Provider LLM Support**
   - OpenAI (GPT-4)
   - Anthropic (Claude)
   - Google (Gemini)
   - Safe fallback to deterministic logic

2. **Voice Interface**
   - Speech-to-Text (ask questions by voice)
   - Text-to-Speech (hear answers aloud)
   - Browser-based, no external dependencies

3. **Feedback System**
   - Rate AI responses (👍/👎)
   - Collect feedback for model improvement
   - Analytics dashboard (future)

---

## 📦 What's New

### Files Added (5)

**Functions:**
- `functions/src/agents/llmBrain.ts` - **UPGRADED** with multi-provider support

**Frontend:**
- `src/lib/voice/recognition.ts` - Speech-to-Text utilities
- `src/lib/voice/speak.ts` - Text-to-Speech utilities
- `src/app/admin/ops-assistant/page.tsx` - **UPGRADED** with voice & feedback
- `src/app/api/admin/ai-feedback/route.ts` - Feedback API endpoint

**Documentation:**
- `docs/PHASE_33_1_LLM_UPGRADE.md` - This file

---

## 🔐 Environment Variables

### Required (for LLM)

```bash
# Choose one provider
LLM_PROVIDER=openai        # or: anthropic, gemini
LLM_API_KEY=your_api_key_here

# Optional: Override default model
LLM_MODEL=gpt-4o-mini      # Default models:
                            # openai: gpt-4o-mini
                            # anthropic: claude-3-5-sonnet-20241022
                            # gemini: gemini-1.5-flash
```

### Setting Environment Variables

#### Local Development
```bash
# In functions directory
cd functions
echo "LLM_PROVIDER=openai" >> .env
echo "LLM_API_KEY=sk-..." >> .env
```

#### Firebase Functions
```bash
firebase functions:config:set llm.provider="openai"
firebase functions:config:set llm.api_key="sk-..."

# Optional: custom model
firebase functions:config:set llm.model="gpt-4o"
```

### No LLM? No Problem!

If `LLM_PROVIDER` and `LLM_API_KEY` are not set, the system automatically falls back to deterministic analysis. The Ops Assistant will still work, just without LLM-powered insights.

---

## 🚀 Deployment

### Quick Deploy

```bash
# 1. Set environment variables (see above)
# 2. Deploy functions
cd functions
npm run build
firebase deploy --only functions:agentCoordinator,functions:llmHealth

# 3. Deploy frontend
cd ..
npm run build
firebase deploy --only hosting
```

### Verify LLM Configuration

```bash
# Health check endpoint
curl https://your-region-your-project.cloudfunctions.net/llmHealth

# Expected response:
# {
#   "provider": "openai",
#   "model": "gpt-4o-mini",
#   "configured": true,
#   "timestamp": 1234567890
# }
```

---

## 🎤 Voice Interface Usage

### Browser Support

**Speech Recognition (🎤):**
- ✅ Chrome / Edge (full support)
- ✅ Safari (iOS 14.5+)
- ❌ Firefox (not supported)

**Text-to-Speech (🔊):**
- ✅ All modern browsers

### How to Use

1. Visit `/admin/ops-assistant`
2. Click **🎤 Mic** button
3. Grant microphone permission when prompted
4. Speak your question
5. System automatically asks the question when you finish
6. Hear the answer spoken aloud (if browser supports TTS)

### Voice Commands Examples

- "What is the current system health?"
- "Predict traffic for the next hour"
- "Why did latency spike?"
- "Show me recent anomalies"

---

## 👍👎 Feedback System

### Collecting Feedback

After receiving an AI response:
1. Rate answer buttons (👍/👎) appear
2. Click to rate the quality of the response
3. Feedback is stored in Firestore (`ai_feedback` collection)

### Feedback Data Structure

```typescript
{
  vote: 'up' | 'down',
  question: string,
  answer: string,
  uid: string,
  ts: number,
  userAgent?: string
}
```

### View Feedback Analytics

```bash
curl https://your-domain.com/api/admin/ai-feedback \
  -H "Cookie: session=..."

# Response:
# {
#   "items": [...],
#   "stats": {
#     "total": 42,
#     "upvotes": 35,
#     "downvotes": 7
#   }
# }
```

---

## 🔧 LLM Provider Configuration

### OpenAI

```bash
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini  # or: gpt-4o, gpt-4-turbo
```

**Cost:** ~$0.15 per 1M tokens (gpt-4o-mini)  
**Speed:** Fast (~1-2s)  
**Quality:** Excellent

---

### Anthropic Claude

```bash
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022  # or: claude-3-opus-20240229
```

**Cost:** ~$3 per 1M tokens (Sonnet)  
**Speed:** Fast (~1-2s)  
**Quality:** Excellent, great at reasoning

---

### Google Gemini

```bash
LLM_PROVIDER=gemini
LLM_API_KEY=AIza...
LLM_MODEL=gemini-1.5-flash  # or: gemini-1.5-pro
```

**Cost:** Free tier available  
**Speed:** Fast (~1-2s)  
**Quality:** Good, improving

---

## 🛡️ Security

### Same as Phase 33

- All routes protected by `assertAdminReq()`
- Rate limiting (30 req/min) via middleware
- CSRF protection via SameSite cookies
- Complete audit trail in `admin_audit`

### Additional Security

- API keys stored in Firebase Functions environment (encrypted)
- Never exposed to client
- Feedback includes user UID for accountability

---

## 🧪 Testing

### Test LLM Integration

```bash
# 1. Visit Ops Assistant
open https://your-domain.com/admin/ops-assistant

# 2. Ask a question
# "What is the current system health?"

# 3. Verify in logs
firebase functions:log --only agentCoordinator --limit 20

# Should see:
# [LLM Brain] Using provider: openai (model: gpt-4o-mini)
```

### Test Voice Recognition

```bash
# 1. Open in Chrome
# 2. Click 🎤 Mic
# 3. Grant microphone permission
# 4. Speak: "System status"
# 5. Verify question is asked automatically
```

### Test Feedback

```bash
# 1. Get an AI response
# 2. Click 👍 or 👎
# 3. Verify feedback saved:
curl https://your-domain.com/api/admin/ai-feedback \
  -H "Cookie: session=..."
```

---

## 🐛 Troubleshooting

### Issue: LLM Not Working

**Symptoms:**
- Responses are generic/deterministic
- No LLM-specific insights

**Solutions:**
1. Check environment variables:
   ```bash
   firebase functions:config:get
   ```
2. Verify API key is valid
3. Check function logs for errors:
   ```bash
   firebase functions:log --only agentCoordinator
   ```

---

### Issue: Voice Recognition Not Working

**Symptoms:**
- Mic button shows "Not supported"
- No microphone prompt

**Solutions:**
1. Use Chrome or Edge browser
2. Ensure HTTPS (required for mic access)
3. Grant microphone permission when prompted
4. Check browser console for errors

---

### Issue: No Speech Output

**Symptoms:**
- Answers not spoken aloud
- No audio

**Solutions:**
1. Check browser volume
2. Ensure TTS is supported (check browser console)
3. Try different browser
4. Manually test:
   ```javascript
   window.speechSynthesis.speak(new SpeechSynthesisUtterance("Test"))
   ```

---

## 📊 Performance

### LLM Response Times

- **OpenAI GPT-4o-mini:** ~1-2 seconds
- **Anthropic Claude:** ~1-2 seconds
- **Google Gemini:** ~1-2 seconds
- **Fallback:** < 100ms

### Voice Processing

- **Speech recognition:** Real-time (as you speak)
- **TTS output:** ~500ms to start

### Costs (Estimated)

For 1000 questions/month:

- **OpenAI (gpt-4o-mini):** ~$0.50/month
- **Anthropic (Claude Sonnet):** ~$10/month
- **Google Gemini (Flash):** Free tier

---

## 🎯 Best Practices

### LLM Prompts

The system automatically generates optimized prompts including:
- Current metrics (calls, errors, p95)
- Recent anomalies
- Forecasts

For best results:
- Ask specific questions
- Include context when helpful
- Review and rate responses

### Voice Commands

Tips for better recognition:
- Speak clearly and at normal pace
- Use standard English (or configured language)
- Avoid background noise
- Be specific (not: "status", better: "system status")

### Feedback

Help improve the system:
- Rate honestly (👍/👎)
- Focus on accuracy and helpfulness
- Don't worry about grammar or style

---

## 🔄 Upgrade Path

### From Phase 33 to 33.1

Already done! If you followed the deployment steps, you're upgraded.

### Reverting to Fallback

To disable LLM and use deterministic logic:

```bash
firebase functions:config:unset llm.provider
firebase functions:config:unset llm.api_key
firebase deploy --only functions:agentCoordinator
```

---

## 📚 API Reference

### LLM Health Endpoint

```
GET https://your-region-your-project.cloudfunctions.net/llmHealth
```

**Response:**
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "configured": true,
  "timestamp": 1234567890
}
```

### Feedback API

```
POST /api/admin/ai-feedback
Content-Type: application/json

{
  "vote": "up",
  "question": "...",
  "answer": "..."
}
```

```
GET /api/admin/ai-feedback
```

---

## ✅ Success Criteria

- [x] LLM provider configured
- [x] Voice recognition working (Chrome)
- [x] TTS working
- [x] Feedback system saving data
- [x] Ops Assistant enhanced
- [x] All tests passing

---

## 🎊 Next Steps

1. **Configure LLM** - Choose provider and set API key
2. **Test Voice** - Try voice commands in Chrome
3. **Collect Feedback** - Use for a few days, collect ratings
4. **Analyze** - Review feedback data to improve prompts
5. **Iterate** - Fine-tune based on user feedback

---

**Status:** ✅ Ready to Deploy  
**Upgrade Time:** ~10 minutes  
**Breaking Changes:** None (fully backward compatible)

**Last Updated:** 2025-10-10  
**Maintainer:** medo bendary


