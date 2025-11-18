# Phase 50 — AI Studio: Assets Pipeline Integration

**Duration:** 6 Days
**Goal:** Intelligent media management system (AI Studio v1)
**Final Output:** Complete media asset management with AI processing via Runway/Veo integration

---

## 📊 Overview

Phase 50 Part 3 focuses on building **AI Studio** - an integrated media management system that handles images and videos, managing the complete lifecycle from upload to automatic processing via Webhooks from Runway/Veo platforms.

---

## 🎯 Core Features

### 1. Media Asset Management (`/studio/assets`)
- Grid view with thumbnails
- Upload with drag-and-drop
- Metadata display (name, type, size, status)
- Pagination for large collections
- Filter and search capabilities

### 2. AI Job Processing
- Queue management (queued → processing → done)
- Status tracking via webhooks
- Real-time updates
- Error handling and retry logic

### 3. Scene Creation (`/studio/create-scene`)
- Text-to-video generation
- Image-to-video conversion
- Style and duration controls
- Background customization

### 4. Metadata Viewer (`/studio/[id]`)
- Detailed asset information
- Job status tracking
- Download links (input/output)
- Processing history

---

## 🏗 System Architecture

### Directory Structure

```
src/
├── app/
│   └── [locale]/
│       └── studio/
│           ├── assets/
│           │   ├── page.tsx              # Main assets list
│           │   ├── upload/
│           │   │   └── page.tsx          # Upload interface
│           │   └── [id]/
│           │       └── page.tsx          # Metadata viewer
│           ├── create-scene/
│           │   └── page.tsx              # Scene creation form
│           └── api/
│               ├── upload/
│               │   └── route.ts          # File upload handler
│               ├── webhook/
│               │   └── route.ts          # Runway/Veo webhook
│               └── job-status/
│                   └── route.ts          # Job status query
├── components/
│   └── studio/
│       ├── AssetCard.tsx                 # Asset display card
│       ├── AssetGrid.tsx                 # Grid layout
│       ├── UploadDropzone.tsx            # Drag-and-drop upload
│       ├── CreateSceneForm.tsx           # Scene creation UI
│       ├── MetadataViewer.tsx            # Detailed view
│       └── JobStatusBadge.tsx            # Status indicator
└── lib/
    └── studio/
        ├── storage.ts                    # Firebase Storage helpers
        ├── jobs.ts                       # Job management logic
        └── webhooks.ts                   # Webhook processing
```

### Firestore Collections

#### `studio_assets`
```typescript
interface Asset {
  id: string;
  userId: string;
  orgId?: string;

  // File info
  fileName: string;
  fileType: 'image' | 'video' | 'audio';
  fileSize: number;
  mimeType: string;

  // Storage
  storagePath: string;
  storageUrl: string;
  thumbnailUrl?: string;

  // AI Processing
  jobId?: string;
  jobStatus?: 'queued' | 'processing' | 'done' | 'failed';
  outputUrl?: string;

  // Metadata
  width?: number;
  height?: number;
  duration?: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

#### `studio_jobs`
```typescript
interface Job {
  id: string;
  assetId: string;
  userId: string;

  // Job details
  type: 'generate' | 'transform' | 'enhance';
  provider: 'runway' | 'veo' | 'local';

  // Input
  inputType: 'prompt' | 'image' | 'video';
  inputData: string | object;

  // Configuration
  parameters: {
    duration?: number;
    style?: string;
    background?: string;
    resolution?: string;
  };

  // Status
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress?: number;
  error?: string;

  // Output
  outputUrl?: string;
  outputSize?: number;
  outputDuration?: number;

  // Metadata
  providerJobId?: string;
  webhookReceived?: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}
```

---

## 📅 6-Day Implementation Plan

### **Day 1: Foundation Setup** ✅ In Progress

**Objectives:**
- Create page structure for `/studio/assets`
- Define Firestore collections schema
- Set up Firebase Storage configuration
- Create basic UI layout

**Tasks:**
1. [x] Create studio route structure
2. [ ] Define TypeScript interfaces
3. [ ] Set up Firestore collections
4. [ ] Configure Storage bucket
5. [ ] Create basic layout components

**Deliverables:**
- Basic `/studio/assets` page
- Firestore schema documentation
- Storage bucket configured
- Initial UI components

---

### **Day 2: File Upload System**

**Objectives:**
- Implement file upload to Firebase Storage
- Create drag-and-drop interface
- Write metadata to Firestore
- Handle upload errors

**Tasks:**
1. [ ] Create UploadDropzone component
2. [ ] Implement Storage upload logic
3. [ ] Generate thumbnails for images/videos
4. [ ] Write metadata to studio_assets
5. [ ] Add progress indicators

**Deliverables:**
- Working file upload
- Drag-and-drop interface
- Thumbnail generation
- Metadata persistence

**Code Example:**
```typescript
// lib/studio/storage.ts
import { storage, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function uploadAsset(
  file: File,
  userId: string
): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const storagePath = `studio/${userId}/${fileName}`;

  // Upload to Storage
  const bucket = storage.bucket();
  const fileRef = bucket.file(storagePath);

  await fileRef.save(await file.arrayBuffer(), {
    contentType: file.type,
    metadata: {
      uploader: userId,
      originalName: file.name
    }
  });

  // Get public URL
  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year
  });

  // Write metadata
  const assetRef = db.collection('studio_assets').doc();
  await assetRef.set({
    userId,
    fileName: file.name,
    fileType: file.type.startsWith('image/') ? 'image' : 'video',
    fileSize: file.size,
    mimeType: file.type,
    storagePath,
    storageUrl: url,
    jobStatus: 'queued',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });

  return assetRef.id;
}
```

---

### **Day 3: Webhook Integration**

**Objectives:**
- Create webhook endpoint for Runway/Veo
- Implement job status updates
- Test with mock webhook data
- Handle edge cases

**Tasks:**
1. [ ] Create `/api/webhook` endpoint
2. [ ] Implement signature verification
3. [ ] Update job status logic
4. [ ] Test with mock data
5. [ ] Add error handling

**Deliverables:**
- Working webhook endpoint
- Job status update flow
- Mock testing suite
- Error handling

**Webhook Endpoint:**
```typescript
// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify webhook signature (Runway/Veo specific)
    const signature = req.headers.get('x-webhook-signature');
    if (!verifySignature(signature, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { jobId, status, outputUrl, error } = body;

    // Update job
    const jobRef = db.collection('studio_jobs').doc(jobId);
    await jobRef.update({
      status,
      outputUrl,
      error,
      webhookReceived: true,
      updatedAt: Timestamp.now(),
      ...(status === 'done' && { completedAt: Timestamp.now() })
    });

    // Update associated asset
    const jobDoc = await jobRef.get();
    const assetId = jobDoc.data()?.assetId;

    if (assetId) {
      await db.collection('studio_assets').doc(assetId).update({
        jobStatus: status,
        outputUrl,
        updatedAt: Timestamp.now()
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function verifySignature(signature: string | null, body: any): boolean {
  // Implement signature verification logic
  // This depends on Runway/Veo webhook security
  return true; // Placeholder
}
```

---

### **Day 4: Scene Creation Interface**

**Objectives:**
- Build dynamic scene creation form
- Implement job creation logic
- Add parameter validation
- Test job submission

**Tasks:**
1. [ ] Create CreateSceneForm component
2. [ ] Add form validation
3. [ ] Implement job creation
4. [ ] Add preview functionality
5. [ ] Test end-to-end flow

**Deliverables:**
- Scene creation form
- Job submission logic
- Parameter validation
- E2E test coverage

**Scene Creation Form:**
```typescript
// components/studio/CreateSceneForm.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function CreateSceneForm() {
  const t = useTranslations('studio.createScene');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    inputType: 'prompt' as 'prompt' | 'image' | 'video',
    inputData: '',
    duration: 5,
    style: 'realistic',
    background: 'auto'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/studio/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Job creation failed');

      const { jobId } = await response.json();
      // Redirect to job status page
      window.location.href = `/studio/jobs/${jobId}`;
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create scene');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('title')}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          {t('inputType')}
        </label>
        <select
          value={formData.inputType}
          onChange={(e) => setFormData({
            ...formData,
            inputType: e.target.value as any
          })}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="prompt">{t('prompt')}</option>
          <option value="image">{t('image')}</option>
          <option value="video">{t('video')}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          {t('duration')}
        </label>
        <input
          type="number"
          min="1"
          max="30"
          value={formData.duration}
          onChange={(e) => setFormData({
            ...formData,
            duration: parseInt(e.target.value)
          })}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? t('creating') : t('createScene')}
      </button>
    </form>
  );
}
```

---

### **Day 5: Metadata Viewer**

**Objectives:**
- Create detailed asset view page
- Add real-time status updates
- Display processing history
- Implement download functionality

**Tasks:**
1. [ ] Create `/studio/[id]` page
2. [ ] Fetch asset and job data
3. [ ] Add real-time listeners
4. [ ] Display metadata
5. [ ] Add download buttons

**Deliverables:**
- Metadata viewer page
- Real-time status updates
- Processing history display
- Download functionality

---

### **Day 6: QA & Security**

**Objectives:**
- Comprehensive testing
- Configure Firestore security rules
- Add RBAC checks
- Performance optimization

**Tasks:**
1. [ ] End-to-end testing
2. [ ] Write Firestore security rules
3. [ ] Add RBAC checks
4. [ ] Performance audit
5. [ ] Create demo video

**Deliverables:**
- QA test report
- Security rules configured
- Performance metrics
- Demo video

---

## 🔐 Security Considerations

### Firestore Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Studio Assets
    match /studio_assets/{assetId} {
      // Users can read their own assets
      allow read: if request.auth != null &&
                    resource.data.userId == request.auth.uid;

      // Users can create assets
      allow create: if request.auth != null &&
                      request.resource.data.userId == request.auth.uid;

      // Users can update their own assets
      allow update: if request.auth != null &&
                      resource.data.userId == request.auth.uid;

      // Users can delete their own assets
      allow delete: if request.auth != null &&
                      resource.data.userId == request.auth.uid;
    }

    // Studio Jobs
    match /studio_jobs/{jobId} {
      // Users can read their own jobs
      allow read: if request.auth != null &&
                    resource.data.userId == request.auth.uid;

      // Users can create jobs
      allow create: if request.auth != null &&
                      request.resource.data.userId == request.auth.uid;

      // System can update job status (via webhook)
      allow update: if request.auth != null &&
                      (resource.data.userId == request.auth.uid ||
                       request.auth.token.admin == true);
    }
  }
}
```

### Storage Rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /studio/{userId}/{allPaths=**} {
      // Users can read their own files
      allow read: if request.auth != null &&
                    request.auth.uid == userId;

      // Users can write to their own directory
      allow write: if request.auth != null &&
                     request.auth.uid == userId &&
                     request.resource.size < 100 * 1024 * 1024; // 100MB limit
    }
  }
}
```

---

## 📊 Translation Keys Required

Add to `src/messages/en.json` and `src/messages/ar.json`:

```json
{
  "studio": {
    "title": "AI Studio",
    "subtitle": "Manage your media assets and AI generations",

    "assets": {
      "title": "Assets",
      "empty": "No assets yet",
      "upload": "Upload",
      "uploading": "Uploading...",
      "delete": "Delete",
      "view": "View Details"
    },

    "createScene": {
      "title": "Create Scene",
      "subtitle": "Generate a new video scene",
      "title_label": "Title",
      "description_label": "Description",
      "inputType": "Input Type",
      "prompt": "Text Prompt",
      "image": "Image",
      "video": "Video",
      "duration": "Duration (seconds)",
      "style": "Style",
      "background": "Background",
      "createScene": "Create Scene",
      "creating": "Creating..."
    },

    "job": {
      "status": {
        "queued": "Queued",
        "processing": "Processing",
        "done": "Done",
        "failed": "Failed"
      },
      "progress": "Progress",
      "startedAt": "Started",
      "completedAt": "Completed",
      "error": "Error"
    },

    "metadata": {
      "title": "Asset Details",
      "fileName": "File Name",
      "fileType": "Type",
      "fileSize": "Size",
      "dimensions": "Dimensions",
      "duration": "Duration",
      "created": "Created",
      "updated": "Updated",
      "download": "Download",
      "downloadOutput": "Download Output"
    }
  }
}
```

---

## 🧪 Testing Checklist

### Upload Flow
- [ ] Drag and drop works
- [ ] File type validation
- [ ] Size limit enforcement
- [ ] Metadata saved correctly
- [ ] Thumbnail generated

### Webhook Flow
- [ ] Webhook signature verified
- [ ] Job status updated
- [ ] Asset status updated
- [ ] Error handling works

### Scene Creation
- [ ] Form validation works
- [ ] Job created successfully
- [ ] Parameters saved correctly
- [ ] Redirects to status page

### Metadata Viewer
- [ ] Asset data loads
- [ ] Job status displays
- [ ] Real-time updates work
- [ ] Download links functional

---

## 📈 Success Metrics

- **Upload Success Rate:** > 99%
- **Webhook Processing Time:** < 1s
- **Asset Page Load Time:** < 2s
- **Job Creation Time:** < 500ms
- **Real-time Update Latency:** < 5s

---

## 🚀 Deployment Steps

```bash
# 1. Deploy Firestore rules
firebase deploy --only firestore:rules

# 2. Deploy Storage rules
firebase deploy --only storage

# 3. Deploy functions (if any)
firebase deploy --only functions

# 4. Deploy hosting
firebase deploy --only hosting

# 5. Test webhooks
curl -X POST https://your-project.web.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test","status":"done","outputUrl":"https://example.com/output.mp4"}'
```

---

**Status:** Day 1 In Progress 🚧
**Last Updated:** 2025-11-05
**Phase Owner:** AI Studio Team
