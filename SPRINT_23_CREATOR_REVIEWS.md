# Sprint 23 - Part 2: Creator Console, Reviews & Marketplace
## Continuation of Sprint 23 Execution Guide

---

## 5) Creator Console & Upload Flow

### 5.1 Agent Upload Page

**File**: `src/app/(creator)/agents/new/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const agentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(20).max(500),
  priceUSD: z.number().min(5).max(999),
  category: z.enum(['productivity', 'creative', 'analytics', 'automation', 'other']),
  tags: z.array(z.string()).min(1).max(5),
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string(),
  systemPrompt: z.string().min(50),
  config: z.record(z.any()).optional()
});

export default function NewAgentPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceUSD: 10,
    category: 'productivity',
    tags: [] as string[],
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: '',
    config: {}
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      // Validate form data
      const validated = agentSchema.parse(formData);

      // Upload agent
      const res = await fetch('/api/agents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { agentId } = await res.json();

      // Redirect to agent page
      router.push(`/creator/agents/${agentId}`);

    } catch (err: any) {
      setError(err.message || 'Failed to upload agent');
    } finally {
      setUploading(false);
    }
  }

  function addTag(tag: string) {
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  }

  function removeTag(tag: string) {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Upload New Agent</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium mb-2">Agent Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="e.g., SEO Content Writer"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description *</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            rows={4}
            placeholder="Describe what your agent does and how it helps users..."
            required
          />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Price (USD) *</label>
            <input
              type="number"
              value={formData.priceUSD}
              onChange={(e) => setFormData({ ...formData, priceUSD: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg"
              min={5}
              max={999}
              step={1}
              required
            />
            <p className="text-xs text-gray-500 mt-1">You earn 85% (${(formData.priceUSD * 0.85).toFixed(2)})</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
              className="w-full px-4 py-2 border rounded-lg"
              required
            >
              <option value="productivity">Productivity</option>
              <option value="creative">Creative</option>
              <option value="analytics">Analytics</option>
              <option value="automation">Automation</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2">Tags * (up to 5)</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add tag and press Enter"
              className="flex-1 px-4 py-2 border rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-600">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* AI Configuration */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">AI Configuration</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Provider *</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Model *</label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                {formData.provider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {formData.provider === 'anthropic' && (
                  <>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  </>
                )}
                {formData.provider === 'google' && (
                  <option value="gemini-pro">Gemini Pro</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">System Prompt *</label>
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
              rows={8}
              placeholder="You are a helpful assistant that..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This defines how your agent behaves. Be specific and clear.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload Agent
              </>
            )}
          </button>
        </div>
      </form>

      {/* Guidelines */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Upload Guidelines</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Agents are reviewed within 24-48 hours</li>
          <li>• Ensure your description is clear and accurate</li>
          <li>• Test your agent thoroughly before uploading</li>
          <li>• Price competitively based on value provided</li>
          <li>• Provide helpful tags for discoverability</li>
        </ul>
      </div>
    </div>
  );
}
```

### 5.2 Agent Upload API

**File**: `src/app/api/agents/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const agentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(20).max(500),
  priceUSD: z.number().min(5).max(999),
  category: z.enum(['productivity', 'creative', 'analytics', 'automation', 'other']),
  tags: z.array(z.string()).min(1).max(5),
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string(),
  systemPrompt: z.string().min(50),
  config: z.record(z.any()).optional()
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creatorUid = session.user.id;

  try {
    // Validate creator has Connect account
    const creatorDoc = await adminDb.collection('creators').doc(creatorUid).get();
    if (!creatorDoc.exists || creatorDoc.data()?.connectStatus !== 'verified') {
      return NextResponse.json(
        { error: 'Creator account not verified. Please complete onboarding first.' },
        { status: 403 }
      );
    }

    // Validate input
    const data = await req.json();
    const validated = agentSchema.parse(data);

    // Content safety check (AI moderation)
    const flags = await checkContentSafety(validated.name, validated.description, validated.systemPrompt);

    if (flags.length > 0) {
      return NextResponse.json(
        { error: 'Content flagged for review', flags },
        { status: 400 }
      );
    }

    // Check feature flags
    const flagsDoc = await adminDb.collection('config').doc('feature_flags').get();
    const requireReview = flagsDoc.data()?.creator_uploads?.require_review ?? true;

    // Create agent document
    const agentRef = await adminDb.collection('agents').add({
      creatorUid,
      name: validated.name,
      description: validated.description,
      priceUSD: validated.priceUSD,
      category: validated.category,
      tags: validated.tags,
      provider: validated.provider,
      model: validated.model,
      systemPrompt: validated.systemPrompt,
      config: validated.config || {},
      status: requireReview ? 'pending' : 'approved',
      purchases: 0,
      revenue: 0,
      rating: 0,
      reviewCount: 0,
      audit: {
        aiCheck: flags.length === 0 ? 'pass' : 'flag',
        flags,
        createdAt: Date.now()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Log upload event
    await adminDb.collection('audit_logs').add({
      type: 'agent_upload',
      creatorUid,
      agentId: agentRef.id,
      agentName: validated.name,
      status: requireReview ? 'pending_review' : 'auto_approved',
      timestamp: Date.now()
    });

    return NextResponse.json({ agentId: agentRef.id });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }

    console.error('Agent upload failed:', err);
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

async function checkContentSafety(name: string, description: string, systemPrompt: string): Promise<string[]> {
  const flags: string[] = [];

  // Basic checks
  const bannedWords = ['hack', 'exploit', 'crack', 'pirate', 'illegal'];
  const content = `${name} ${description} ${systemPrompt}`.toLowerCase();

  for (const word of bannedWords) {
    if (content.includes(word)) {
      flags.push(`Contains banned word: ${word}`);
    }
  }

  // Length checks
  if (systemPrompt.length > 10000) {
    flags.push('System prompt too long');
  }

  // TODO: Integrate with OpenAI Moderation API or similar
  // const moderationResult = await openai.moderations.create({ input: content });

  return flags;
}
```

---

## 6) Reviews & Ratings System

### 6.1 Review Submission Component

**File**: `src/app/(public)/agents/[id]/ReviewSection.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Star, Send, Flag } from 'lucide-react';

interface Review {
  id: string;
  userUid: string;
  userName: string;
  rating: number;
  text: string;
  images?: string[];
  state: 'visible' | 'hidden' | 'flagged';
  createdAt: number;
}

export function ReviewSection({ agentId }: { agentId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
    checkCanReview();
  }, [agentId]);

  async function fetchReviews() {
    const res = await fetch(`/api/reviews?agentId=${agentId}`);
    const data = await res.json();
    setReviews(data.reviews || []);
  }

  async function checkCanReview() {
    const res = await fetch(`/api/reviews/can-review?agentId=${agentId}`);
    const data = await res.json();
    setCanReview(data.canReview);
  }

  async function submitReview() {
    if (!text.trim() || text.length < 10) {
      alert('Please write at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, rating, text })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // Reset form and refresh reviews
      setText('');
      setRating(5);
      setCanReview(false);
      fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="mt-12">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${i <= avgRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">
              {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        )}
      </div>

      {/* Submit Review Form */}
      {canReview && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-4">Write a Review</h3>

          {/* Rating */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  className="transition hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Your Review</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              rows={4}
              placeholder="Share your experience with this agent..."
            />
          </div>

          <button
            onClick={submitReview}
            disabled={submitting || !text.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No reviews yet. Be the first to review this agent!
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="p-6 bg-white border rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold">{review.userName}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <Flag className="w-4 h-4" />
        </button>
      </div>
      <p className="text-gray-700">{review.text}</p>
      {review.images && review.images.length > 0 && (
        <div className="flex gap-2 mt-3">
          {review.images.map((img, i) => (
            <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded" />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6.2 Reviews API

**File**: `src/app/api/reviews/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  try {
    const reviewsSnap = await adminDb.collection('reviews')
      .where('agentId', '==', agentId)
      .where('state', '==', 'visible')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const reviews = await Promise.all(reviewsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const userDoc = await adminDb.collection('users').doc(data.userUid).get();
      const userName = userDoc.data()?.displayName || 'Anonymous';

      return {
        id: doc.id,
        ...data,
        userName
      };
    }));

    return NextResponse.json({ reviews });

  } catch (err: any) {
    console.error('Failed to fetch reviews:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentId, rating, text, images } = await req.json();

  try {
    // Validate purchase
    const orderSnap = await adminDb.collection('orders')
      .where('buyerUid', '==', session.user.id)
      .where('agentId', '==', agentId)
      .where('status', '==', 'paid')
      .limit(1)
      .get();

    if (orderSnap.empty) {
      return NextResponse.json(
        { error: 'You must purchase this agent to review it' },
        { status: 403 }
      );
    }

    // Check for existing review
    const existingSnap = await adminDb.collection('reviews')
      .where('userUid', '==', session.user.id)
      .where('agentId', '==', agentId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'You have already reviewed this agent' },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    // Check spam guard
    const flagsDoc = await adminDb.collection('config').doc('feature_flags').get();
    const spamGuard = flagsDoc.data()?.reviews?.spam_guard ?? false;

    let state: 'visible' | 'hidden' | 'flagged' = 'visible';

    if (spamGuard) {
      // Basic spam check
      const spamScore = await checkSpamScore(text);
      if (spamScore > 0.7) {
        state = 'flagged';
      }
    }

    // Create review
    const reviewRef = await adminDb.collection('reviews').add({
      agentId,
      userUid: session.user.id,
      rating,
      text: text.trim(),
      images: images || [],
      state,
      createdAt: Date.now()
    });

    // Update agent rating
    await updateAgentRating(agentId);

    return NextResponse.json({ reviewId: reviewRef.id });

  } catch (err: any) {
    console.error('Review submission failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}

async function checkSpamScore(text: string): Promise<number> {
  // Simple spam detection (replace with proper AI moderation)
  const spamPatterns = [
    /visit.*website/i,
    /click.*here/i,
    /amazing.*offer/i,
    /limited.*time/i,
    /(buy|cheap|discount).*now/i
  ];

  let score = 0;
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      score += 0.3;
    }
  }

  return Math.min(score, 1);
}

async function updateAgentRating(agentId: string) {
  const reviewsSnap = await adminDb.collection('reviews')
    .where('agentId', '==', agentId)
    .where('state', '==', 'visible')
    .get();

  if (reviewsSnap.empty) return;

  const ratings = reviewsSnap.docs.map(doc => doc.data().rating);
  const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

  await adminDb.collection('agents').doc(agentId).update({
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: ratings.length,
    updatedAt: Date.now()
  });
}
```

---

## 7) Marketplace Frontend

### 7.1 Marketplace Landing Page

**File**: `src/app/(public)/marketplace/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  purchases: number;
  creatorName: string;
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    priceRange: 'all',
    sortBy: 'popular'
  });

  useEffect(() => {
    fetchAgents();
  }, [filters]);

  async function fetchAgents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filters.search,
        category: filters.category,
        priceRange: filters.priceRange,
        sortBy: filters.sortBy
      });

      const res = await fetch(`/api/marketplace?${params}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-2">AI Agent Marketplace</h1>
          <p className="text-gray-600">Discover and purchase AI agents built by the community</p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          {/* Category */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Categories</option>
            <option value="productivity">Productivity</option>
            <option value="creative">Creative</option>
            <option value="analytics">Analytics</option>
            <option value="automation">Automation</option>
          </select>

          {/* Price Range */}
          <select
            value={filters.priceRange}
            onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Prices</option>
            <option value="0-20">$0 - $20</option>
            <option value="20-50">$20 - $50</option>
            <option value="50-100">$50 - $100</option>
            <option value="100+">$100+</option>
          </select>

          {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No agents found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="bg-white rounded-lg border hover:shadow-lg transition p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-lg">{agent.name}</h3>
          <div className="text-xl font-bold text-blue-600">${agent.priceUSD}</div>
        </div>

        <p className="text-gray-600 text-sm mb-4 flex-1">{agent.description}</p>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-medium">{agent.rating.toFixed(1)}</span>
          </div>
          <span className="text-sm text-gray-500">({agent.reviewCount})</span>
          <span className="text-sm text-gray-400">•</span>
          <span className="text-sm text-gray-500">{agent.purchases} sales</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {agent.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>

        <div className="text-xs text-gray-500">
          by {agent.creatorName}
        </div>
      </div>
    </Link>
  );
}
```

---

This completes the core implementation for Sprint 23. The guide now includes:

✅ **Stripe Connect Integration** - Creator onboarding & account management
✅ **Orders with Platform Fees** - 15% application fee with destination charges
✅ **Payout Lifecycle** - Scheduler, processor, retry logic, creator dashboard
✅ **Creator Console** - Agent upload with validation & moderation
✅ **Reviews & Ratings** - Purchase-verified reviews with spam detection
✅ **Marketplace Frontend** - Search, filters, sorting, agent cards

Would you like me to add the final sections covering security, testing, deployment procedures, and runbooks?