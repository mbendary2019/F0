# Sprint 14 — Phase 2 Deployment Guide

## 🎯 Phase 2: Remediation Tools

This phase adds PII redaction and safe regeneration capabilities to the HITL review workflow.

---

## ✅ Components Delivered

### **Cloud Functions (2)**
1. ✅ `redactPII` - Callable - Masks or removes PII (emails, phones, SSNs, credit cards)
2. ✅ `safeRegenerate` - Callable - Regenerates content with safety constraints

### **Admin UI (2)**
1. ✅ `ReviewDrawer` - Enhanced review panel with remediation tools
2. ✅ Updated `/admin/hitl` - Click-to-open drawer interaction

---

## 🚀 Deployment Steps

### 1. Deploy Functions

```bash
firebase deploy --only functions:redactPII,functions:safeRegenerate
```

**Verify:**
```bash
firebase functions:list | grep -E "redactPII|safeRegenerate"
# Expected: Both functions listed with ACTIVE status
```

### 2. Test Locally (Optional)

```bash
npm run dev
# Navigate to: http://localhost:3000/admin/hitl
```

---

## 🧪 Smoke Tests

### Test 1: Redact PII

**Steps:**

1. Navigate to `/admin/hitl` as reviewer
2. Click on any review row to open ReviewDrawer
3. Paste this test text in "Input to remediate":
   ```
   Contact me at john.doe@example.com or call 555-123-4567.
   My SSN is 123-45-6789 and card is 4532 1234 5678 9010.
   ```
4. Click **"Redact PII"** button

**Expected Result:**
```
Contact me at jo**********@example.com or call ************.
My SSN is ************ and card is *****************.
```

**Verify:**
- Emails: `jo**********@example.com` (first 2 chars visible)
- Phones: All masked with `*`
- SSNs: All masked with `*`
- Credit cards: All masked with `*`

---

### Test 2: Safe Regenerate (Fallback Mode)

**Steps:**

1. Open ReviewDrawer
2. Paste this test text:
   ```
   You are so stupid and I hate you. Let's bomb that place!
   Contact me at admin@secret.com with SSN 987-65-4321.
   ```
3. Click **"Safe Regenerate"** button

**Expected Result:**
```
You are so [REDACTED] and I [REDACTED] you. Let's [REDACTED] that place!
Contact me at [EMAIL] with SSN [SSN].
```

**Verify:**
- Toxic words replaced with `[REDACTED]`
- PII replaced with `[EMAIL]`, `[SSN]`, etc.
- Text truncated to 1200 chars if longer

---

### Test 3: Resolve with Remediation

**Steps:**

1. Open ReviewDrawer on a queued/assigned review
2. Paste sensitive content and click "Redact PII"
3. Add notes: "Redacted PII before approval"
4. Click **"Approve & Resolve"**

**Expected Result:**
- Review status changes to "resolved"
- `outcome.notes` contains:
  - Notes: "Redacted PII before approval"
  - Redacted: (preview of redacted text)
- Timeline event added with action='approve'

**Verify in Firestore:**
```javascript
db.collection('ai_reviews').doc('REVIEW_ID').get()
// Expected:
// status='resolved'
// outcome.notes includes redacted preview
// outcome.action='approve'
```

---

### Test 4: Safe Regenerate (Custom Max Length)

**Steps:**

1. Open ReviewDrawer
2. Paste long text (>1500 chars)
3. Click "Safe Regenerate"

**Expected Result:**
- Output truncated to ~1200 chars with "…" suffix

---

### Test 5: Combined Remediation

**Steps:**

1. Paste text with PII + toxic content
2. Click "Redact PII" → Copy result
3. Paste result in input
4. Click "Safe Regenerate"

**Expected Result:**
- All PII redacted first
- Then toxic words sanitized
- Final output is doubly-safe

---

## 📊 Function Behavior Details

### **redactPII**

**Strategies:**
- `mask` (default): Shows first N characters, rest as `*`
- `remove`: Replaces with placeholder `[EMAIL]`, `[PHONE]`, etc.

**Patterns Detected:**
- **Email**: `([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`
- **Phone**: `(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}`
- **Credit Card**: `\b(?:\d[ -]*?){13,19}\b`
- **SSN**: `\b\d{3}-\d{2}-\d{4}\b`

**Returns:**
```typescript
{
  redactedText: string;
  stats: {
    emails: number;
    phones: number;
    cards: number;
    ssns: number;
  }
}
```

---

### **safeRegenerate**

**Safety Measures:**
1. **LLM Provider** (if configured):
   - Calls `callSafeModel()` with safety prompt
   - Lower temperature (0.3)
   - Safety system prompt

2. **Fallback Sanitizer** (default):
   - Replaces toxic keywords: `["idiot","stupid","kill","hate","bomb","rape"]`
   - Truncates to `maxLen` (default: 1200 chars)
   - Redacts PII with regex

**Returns:**
```typescript
{
  safeText: string;
  used: 'model' | 'fallback';  // Which method was used
}
```

**LLM Integration (Optional):**
To use your LLM provider, edit `functions/src/hitl/safeRegenerate.ts`:

```typescript
async function callSafeModel(prompt: string): Promise<string | null> {
  // Example: OpenAI integration
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a safety rewriter. Remove PII, mask sensitive tokens, avoid toxicity.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 500
  });
  return response.choices[0]?.message?.content || null;
}
```

---

## 🔍 Cloud Logging Queries

**Redact PII Activity:**
```
resource.type="cloud_function"
"redactPII"
severity=INFO
```

**Safe Regenerate Activity:**
```
resource.type="cloud_function"
"safeRegenerate"
severity=INFO
```

**Audit Logs:**
```
resource.type="cloud_function"
"hitl_safe_regen"
```

---

## 🚨 Troubleshooting

### Issue: Redaction Not Working

**Diagnosis:**
- Check input text format
- Verify PII patterns match (e.g., SSN must be `###-##-####`)

**Resolution:**
- Test with known patterns
- Adjust regex in `redactPII.ts` if needed

---

### Issue: Safe Regenerate Returns Original Text

**Diagnosis:**
```javascript
// Check if callSafeModel is returning null (fallback mode)
// Check Cloud Logs for "fallback" in output
```

**Resolution:**
- This is expected if LLM provider not configured
- Fallback sanitizer is working correctly
- To use LLM: Configure `callSafeModel()` in `safeRegenerate.ts`

---

### Issue: Drawer Not Opening

**Diagnosis:**
- Check browser console for errors
- Verify ReviewDrawer component imported

**Resolution:**
```bash
# Ensure file exists
ls src/app/\(admin\)/hitl/_components/ReviewDrawer.tsx

# Check import in page.tsx
grep "ReviewDrawer" src/app/\(admin\)/hitl/page.tsx
```

---

## 📋 Post-Deployment Checklist

- [ ] Both Functions deployed successfully
- [ ] Test 1: Redact PII works (emails, phones, SSNs, cards)
- [ ] Test 2: Safe Regenerate works (toxic words + PII)
- [ ] Test 3: Resolve with remediation notes
- [ ] Test 4: Long text truncated
- [ ] Test 5: Combined remediation
- [ ] ReviewDrawer opens on row click
- [ ] Cloud Logging shows no errors
- [ ] UI responsive and functional

---

## 🎯 Next Steps (Phase 3 & 4)

After Phase 2 is stable, proceed to:

**Phase 3: Red-Teaming**
- `redteamRun` - Adversarial test runner
- Test bank management UI
- Red-team dashboard with pass/fail metrics

**Phase 4: Policies**
- `policyEvaluate` - Policy rules engine
- Policy editor UI
- Auto-escalation based on rules

---

## 📞 Support

**Common Issues:**
- PII patterns not matching: Adjust regex in `redactPII.ts`
- LLM integration: Update `callSafeModel()` in `safeRegenerate.ts`
- Drawer not opening: Check imports and component path

**Escalation:**
- Review Cloud Logs for detailed errors
- Test functions directly via Firebase Console → Cloud Functions → Testing
- Consult [SPRINT-14-PRD.md](./SPRINT-14-PRD.md) for full specification
