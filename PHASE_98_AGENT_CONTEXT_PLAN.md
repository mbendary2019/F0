# Phase 98: Agent Context & Chat Persistence

**Date:** 2025-11-25
**Status:** 🚧 In Progress

---

## 🎯 Goal

Fix two critical issues:

1. **Agent doesn't know project context** - When user creates a project with specific app types, the agent should be aware
2. **Chat history disappears** - Conversation is lost when user leaves and returns to the agent page

---

## 📊 Current State

### Project Creation Flow

When user creates a new project in [projects/new/page.tsx](src/app/[locale]/projects/new/page.tsx):

```typescript
await addDoc(collection(db, 'ops_projects'), {
  ownerUid: user.uid,
  name: name.trim(),
  appTypes,                // ['web', 'mobile']
  mobileTargets,           // ['ios', 'android']
  desktopTargets,          // ['mac', 'windows']
  infraType,               // 'firebase' | 'supabase' | 'custom'
  // ... other fields
});
```

### Agent API Call

Currently in [api/agent/run/route.ts](src/app/api/agent/run/route.ts):

```typescript
const result = await askConversationalAgentWithArchitect({
  projectId,
  userId: userId || 'anonymous',
  userText: userPrompt,
  lang: detectedLang,
  forceArchitectMode,
});
```

**Problem:** No project metadata passed to agent!

### Chat UI

Currently in [agent/page.tsx](src/app/[locale]/agent/page.tsx):

```typescript
const [messages, setMessages] = useState<Message[]>([]);
```

**Problem:** Messages stored only in React state - lost on page reload!

---

## 🛠️ Solution Design

### Part 1: Pass Project Context to Agent

**Changes needed:**

1. **Load project metadata in API route**
   ```typescript
   // In /api/agent/run/route.ts
   const projectDoc = await getDoc(doc(db, 'ops_projects', projectId));
   const projectData = projectDoc.data();

   const result = await askConversationalAgentWithArchitect({
     projectId,
     userId,
     userText,
     lang,
     forceArchitectMode,
     projectContext: {  // ← NEW
       appTypes: projectData.appTypes,
       mobileTargets: projectData.mobileTargets,
       desktopTargets: projectData.desktopTargets,
       infraType: projectData.infraType,
       name: projectData.name,
     },
   });
   ```

2. **Update agent function signature**
   ```typescript
   // In conversationalAgentWithArchitect.ts
   export async function askConversationalAgentWithArchitect(params: {
     projectId: string;
     userId: string;
     userText: string;
     lang?: 'ar' | 'en';
     forceArchitectMode?: boolean;
     projectContext?: ProjectContext;  // ← NEW
   })
   ```

3. **Include context in system prompt**
   ```typescript
   const systemPrompt = `
   ${buildPersonalityPrompt(lang, existingBrief)}

   ## Project Context
   - Name: ${projectContext.name}
   - App Types: ${projectContext.appTypes.join(', ')}
   ${projectContext.mobileTargets.length > 0
     ? `- Mobile Platforms: ${projectContext.mobileTargets.join(', ')}`
     : ''}
   ${projectContext.desktopTargets.length > 0
     ? `- Desktop Platforms: ${projectContext.desktopTargets.join(', ')}`
     : ''}
   - Infrastructure: ${projectContext.infraType}

   **Important:** The user has already chosen these settings.
   Acknowledge them when relevant, and let them know they can change
   them in Project Settings if needed.
   `;
   ```

**Expected behavior:**
- When user says "عايز تطبيق شبه Facebook"
- Agent says: "شفت إنك اخترت Web + Mobile (iOS, Android). رائع! دلوقتي خليني أسألك..."
- Agent doesn't ask about platform choices that were already made

---

### Part 2: Persist Chat History

**Firestore structure:**

```
ops_projects/{projectId}/agent_messages/{messageId}
  - role: 'user' | 'assistant' | 'system'
  - content: string
  - createdAt: timestamp
  - lang: 'ar' | 'en'
  - metadata?: {
      mode?: 'CONVERSATIONAL' | 'ARCHITECT'
      hasArchitectPlan?: boolean
    }
```

**Changes needed:**

1. **Save messages in API route**
   ```typescript
   // In /api/agent/run/route.ts

   // Save user message
   await addDoc(collection(db, `ops_projects/${projectId}/agent_messages`), {
     role: 'user',
     content: message,
     createdAt: serverTimestamp(),
     lang: detectedLang,
   });

   // ... call agent ...

   // Save agent response
   await addDoc(collection(db, `ops_projects/${projectId}/agent_messages`), {
     role: 'assistant',
     content: result.visible,
     createdAt: serverTimestamp(),
     lang: detectedLang,
     metadata: {
       mode: result.mode,
       hasArchitectPlan: !!result.architectPlan,
     },
   });
   ```

2. **Load chat history in UI**
   ```typescript
   // In agent/page.tsx

   useEffect(() => {
     if (!projectId) return;

     const messagesRef = collection(
       db,
       `ops_projects/${projectId}/agent_messages`
     );

     const q = query(messagesRef, orderBy('createdAt', 'asc'));

     const unsubscribe = onSnapshot(q, (snapshot) => {
       const loadedMessages = snapshot.docs.map(doc => ({
         id: doc.id,
         role: doc.data().role,
         content: doc.data().content,
         createdAt: doc.data().createdAt?.toMillis() || Date.now(),
       }));

       setMessages(loadedMessages);
     });

     return () => unsubscribe();
   }, [projectId]);
   ```

3. **Send conversation history to agent**
   ```typescript
   // In /api/agent/run/route.ts

   // Load previous messages
   const messagesSnapshot = await getDocs(
     query(
       collection(db, `ops_projects/${projectId}/agent_messages`),
       orderBy('createdAt', 'asc'),
       limit(20)  // Last 20 messages
     )
   );

   const conversationHistory = messagesSnapshot.docs.map(doc => ({
     role: doc.data().role,
     content: doc.data().content,
   }));

   const result = await askConversationalAgentWithArchitect({
     // ... other params
     conversationHistory,  // ← NEW
   });
   ```

**Expected behavior:**
- User chats with agent
- User leaves page
- User returns → **Previous conversation is still there!**
- Agent remembers context from previous messages

---

## 📝 Implementation Steps

### Step 1: Add Project Context ✅
- [ ] Update `/api/agent/run/route.ts` to load project data
- [ ] Add `ProjectContext` type to agent function
- [ ] Include project context in system prompt
- [ ] Test: Agent acknowledges chosen app types

### Step 2: Persist Messages ✅
- [ ] Save user message to Firestore in API route
- [ ] Save agent response to Firestore in API route
- [ ] Test: Messages appear in Firestore console

### Step 3: Load Chat History ✅
- [ ] Add `onSnapshot` listener in `agent/page.tsx`
- [ ] Display loaded messages in UI
- [ ] Test: Refresh page → messages still there

### Step 4: Send History to Agent ✅
- [ ] Load recent messages in API route
- [ ] Pass conversation history to agent
- [ ] Agent uses history for context
- [ ] Test: Agent remembers previous discussion

---

## 🧪 Testing Plan

### Test 1: Project Context Awareness
```bash
# 1. Create project with Web + Mobile (iOS, Android)
# 2. Open agent
# 3. Say: "عايز تطبيق شبه Instagram"

# Expected:
Agent: "شفت إنك اخترت Web App + Mobile (iOS, Android) مع Firebase. ممتاز!
دلوقتي خليني أسألك عن الفكرة..."

# NOT expected:
Agent: "تطبيق ويب ولا موبايل؟"
```

### Test 2: Chat Persistence
```bash
# 1. Start chat with agent
# 2. Send 3-4 messages
# 3. Leave agent page
# 4. Return to agent page

# Expected:
- All previous messages visible
- Can continue conversation
- Agent remembers context

# NOT expected:
- Empty chat
- Agent asks same questions again
```

### Test 3: Multi-turn Conversation
```bash
# 1. User: "عايز تطبيق شبه Facebook"
# 2. Agent: asks clarifying questions
# 3. User: answers questions
# 4. Agent: suggests MVP
# 5. User: "تمام، ابدأ"
# 6. Agent: switches to architect mode with CONTEXT from previous messages

# Expected:
- Agent remembers all answers
- Doesn't re-ask questions
- Uses accumulated context in architecture plan
```

---

## 📄 Files to Modify

1. **src/app/api/agent/run/route.ts**
   - Load project metadata
   - Load conversation history
   - Save messages to Firestore
   - Pass context to agent

2. **src/lib/agent/conversationalAgentWithArchitect.ts**
   - Accept projectContext parameter
   - Accept conversationHistory parameter
   - Include context in system prompt

3. **src/app/[locale]/agent/page.tsx**
   - Load messages from Firestore
   - Real-time updates with onSnapshot

4. **src/types/project.ts** (maybe)
   - Add ProjectContext interface
   - Add AgentMessage interface

---

## 🎯 Success Criteria

✅ Agent knows project app types and acknowledges them
✅ Agent doesn't ask about already-chosen settings
✅ Chat history persists across page reloads
✅ Agent remembers previous conversation context
✅ Multi-turn conversations work smoothly

---

**Ready to implement!** 🚀
