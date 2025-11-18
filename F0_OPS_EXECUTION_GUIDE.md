# 🛡️ F0 Operations Execution Guide — Phase 22

> **Operational guide for implementing Reliability, Ops & Status features. Covers observability, SLOs, status page, incident management, and cost tracking.**

**Version:** 1.0
**Phase:** Sprint 22 (v23.0.0)
**Last Updated:** 2025-01-30
**Owner:** _____________________

---

## 🧭 Overview

This guide covers the operations and reliability layer implementation:
- **Observability & Metrics** - Real-time performance monitoring
- **SLOs & Alerts** - Automated alerting based on service level objectives
- **Public Status Page** - Component health visibility
- **Incident Management** - Track and resolve incidents with runbooks
- **Cost & Quota Tracking** - Resource usage and spending analysis

---

## 1️⃣ Observability & Metrics

### Goal
Monitor performance and reliability through automated collectors.

### File Structure

```
functions/src/ops/
  └── metricsIngest.ts         # Metrics ingestion function

src/lib/observability/
  └── metrics.ts               # Client-side metrics collection

Firestore Collection:
  ops_metrics/{day}/{metricId}
```

### Metrics Collection Implementation

#### Client-Side Metrics

```typescript
// src/lib/observability/metrics.ts
interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private buffer: Metric[] = [];
  private flushInterval = 60000; // 1 minute

  constructor() {
    // Auto-flush every minute
    setInterval(() => this.flush(), this.flushInterval);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  record(name: string, value: number, labels?: Record<string, string>) {
    this.buffer.push({
      name,
      value,
      labels: {
        ...labels,
        environment: process.env.NODE_ENV,
        version: process.env.NEXT_PUBLIC_APP_VERSION
      },
      timestamp: Date.now()
    });

    // Flush if buffer is full
    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const metrics = [...this.buffer];
    this.buffer = [];

    try {
      await fetch('/api/metrics/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
      // Re-add to buffer for retry
      this.buffer.unshift(...metrics);
    }
  }

  // Convenience methods
  recordLatency(endpoint: string, duration: number) {
    this.record('req_latency_ms', duration, { endpoint });
  }

  recordError(endpoint: string, statusCode: number) {
    this.record('error_rate', 1, { endpoint, status: String(statusCode) });
  }

  recordRequest(endpoint: string) {
    this.record('req_count', 1, { endpoint });
  }

  recordTokenUsage(model: string, inputTokens: number, outputTokens: number) {
    this.record('token_input', inputTokens, { model });
    this.record('token_output', outputTokens, { model });

    // Calculate cost (example pricing)
    const pricing = {
      'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
      'claude-opus-4': { input: 15.00, output: 75.00 }
    };

    const modelPricing = pricing[model] || { input: 0, output: 0 };
    const cost = (inputTokens / 1_000_000) * modelPricing.input +
                 (outputTokens / 1_000_000) * modelPricing.output;

    this.record('token_cost', cost, { model });
  }
}

export const metrics = new MetricsCollector();
```

#### Usage in API Routes

```typescript
// Example: src/app/api/agent/status/route.ts
import { metrics } from '@/lib/observability/metrics';

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    metrics.recordRequest('/api/agent/status');

    // ... API logic

    const duration = Date.now() - startTime;
    metrics.recordLatency('/api/agent/status', duration);

    return Response.json({ status: 'ok' });
  } catch (error) {
    metrics.recordError('/api/agent/status', 500);
    throw error;
  }
}
```

#### Server-Side Ingestion

```typescript
// functions/src/ops/metricsIngest.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export const metricsIngest = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { metrics } = req.body as { metrics: Metric[] };

  if (!Array.isArray(metrics)) {
    res.status(400).send('Invalid metrics format');
    return;
  }

  const batch = admin.firestore().batch();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  for (const metric of metrics) {
    const docRef = admin.firestore()
      .collection('ops_metrics')
      .doc(today)
      .collection('metrics')
      .doc();

    batch.set(docRef, {
      name: metric.name,
      value: metric.value,
      labels: metric.labels || {},
      timestamp: metric.timestamp,
      ingested: Date.now()
    });
  }

  await batch.commit();
  res.status(200).send({ received: metrics.length });
});
```

### Firestore Structure

```javascript
ops_metrics/{day}/{metricId}
{
  name: "req_latency_ms" | "error_rate" | "req_count" | "token_cost" | "active_users",
  value: number,
  labels: {
    endpoint?: string,
    model?: string,
    status?: string,
    environment: "production" | "staging",
    version: string
  },
  timestamp: number,
  ingested: number
}
```

### Key Metrics

1. **Request Latency** - `req_latency_ms`
2. **Error Rate** - `error_rate`
3. **Request Count** - `req_count`
4. **Token Cost** - `token_cost`
5. **Active Users** - `active_users`

### Deployment

```bash
# Deploy metrics ingestion function
cd functions
npm install
firebase deploy --only functions:metricsIngest

# Verify
firebase functions:log --only metricsIngest --lines 20
```

---

## 2️⃣ SLOs & Alerts

### Goal
Create automated alerting system based on Service Level Objectives.

### File Structure

```
config/
  └── slo.json                 # SLO definitions

functions/src/ops/
  └── alertRules.ts            # Alert evaluation logic

.env:
  SLACK_WEBHOOK_URL
  ALERT_EMAILS
```

### SLO Configuration

```json
// config/slo.json
{
  "slos": [
    {
      "name": "API Availability",
      "metric": "api.uptime",
      "target": 99.5,
      "window": "30d",
      "threshold": 99.0,
      "severity": "critical",
      "channels": ["slack", "email", "pagerduty"]
    },
    {
      "name": "API Latency (p95)",
      "metric": "api.latency.p95",
      "target": 400,
      "window": "24h",
      "threshold": 500,
      "severity": "warning",
      "channels": ["slack"]
    },
    {
      "name": "Webhook Success Rate",
      "metric": "webhook.success",
      "target": 98,
      "window": "7d",
      "threshold": 95,
      "severity": "high",
      "channels": ["slack", "email"]
    },
    {
      "name": "Incident MTTR",
      "metric": "incident.mttr",
      "target": 7200,
      "window": "30d",
      "threshold": 10800,
      "severity": "warning",
      "channels": ["slack"]
    }
  ]
}
```

### Alert Rules Function

```typescript
// functions/src/ops/alertRules.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import sloConfig from '../../config/slo.json';

interface SLO {
  name: string;
  metric: string;
  target: number;
  window: string;
  threshold: number;
  severity: 'critical' | 'high' | 'warning' | 'info';
  channels: ('slack' | 'email' | 'pagerduty')[];
}

export const alertRules = functions.pubsub
  .schedule('*/5 * * * *') // Every 5 minutes
  .onRun(async (context) => {
    console.log('Evaluating alert rules...');

    for (const slo of sloConfig.slos as SLO[]) {
      await evaluateSLO(slo);
    }

    return null;
  });

async function evaluateSLO(slo: SLO) {
  const metricValue = await getMetricValue(slo.metric, slo.window);

  if (metricValue === null) {
    console.warn(`No data for metric: ${slo.metric}`);
    return;
  }

  // Check if threshold exceeded
  const violated = slo.metric.includes('latency') || slo.metric.includes('mttr')
    ? metricValue > slo.threshold
    : metricValue < slo.threshold;

  if (violated) {
    console.log(`SLO violation: ${slo.name} - ${metricValue} (threshold: ${slo.threshold})`);
    await sendAlerts(slo, metricValue);
  }
}

async function getMetricValue(metric: string, window: string): Promise<number | null> {
  // Query ops_metrics for the specified metric and window
  const windowMs = parseWindow(window);
  const cutoff = Date.now() - windowMs;

  const snapshot = await admin.firestore()
    .collectionGroup('metrics')
    .where('name', '==', metric)
    .where('timestamp', '>=', cutoff)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const values = snapshot.docs.map((doc) => doc.data().value);

  // Calculate p95 for latency metrics
  if (metric.includes('latency') || metric.includes('p95')) {
    return calculateP95(values);
  }

  // Calculate average for other metrics
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateP95(values: number[]): number {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95);
  return sorted[index] || 0;
}

function parseWindow(window: string): number {
  const match = window.match(/(\d+)([smhd])/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 0);
}

async function sendAlerts(slo: SLO, value: number) {
  const message = `🚨 SLO Violation: ${slo.name}\nCurrent: ${value}\nThreshold: ${slo.threshold}\nSeverity: ${slo.severity}`;

  for (const channel of slo.channels) {
    switch (channel) {
      case 'slack':
        await sendSlackAlert(message, slo.severity);
        break;
      case 'email':
        await sendEmailAlert(message, slo);
        break;
      case 'pagerduty':
        await sendPagerDutyAlert(message, slo);
        break;
    }
  }

  // Log to Firestore
  await admin.firestore().collection('alerts').add({
    slo: slo.name,
    metric: slo.metric,
    value,
    threshold: slo.threshold,
    severity: slo.severity,
    message,
    timestamp: Date.now()
  });
}

async function sendSlackAlert(message: string, severity: string) {
  const webhookUrl = functions.config().slack.webhook_url;

  const color = {
    critical: '#ff0000',
    high: '#ff6600',
    warning: '#ffcc00',
    info: '#0099ff'
  }[severity] || '#666666';

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        text: message,
        footer: 'F0 Ops',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  });
}

async function sendEmailAlert(message: string, slo: SLO) {
  // Use existing txEmail function or SendGrid directly
  const emails = functions.config().alerts.emails.split(',');

  for (const email of emails) {
    // Send email (implementation depends on your email provider)
    console.log(`Sending email to ${email}: ${message}`);
  }
}

async function sendPagerDutyAlert(message: string, slo: SLO) {
  const integrationKey = functions.config().pagerduty.integration_key;

  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: integrationKey,
      event_action: 'trigger',
      payload: {
        summary: slo.name,
        severity: slo.severity,
        source: 'F0 Ops',
        custom_details: { message }
      }
    })
  });
}
```

### Environment Variables

```bash
# Set Slack webhook
firebase functions:config:set slack.webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Set alert emails
firebase functions:config:set alerts.emails="ops@f0.com,admin@f0.com"

# Set PagerDuty (optional)
firebase functions:config:set pagerduty.integration_key="YOUR_KEY"

# Redeploy
firebase deploy --only functions:alertRules
```

### Deployment

```bash
firebase deploy --only functions:alertRules

# Verify scheduler
firebase functions:log --only alertRules --lines 20
```

---

## 3️⃣ Public Status Page

### Goal
Display system health for users and admins.

### File Structure

```
src/app/status/
  └── page.tsx                 # Public status page

src/app/api/status/healthz/
  └── route.ts                 # Health check aggregator

src/components/
  └── StatusBadge.tsx          # Navbar badge

Firestore:
  status/components/{id}
```

### Status Page Implementation

```typescript
// src/app/status/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface ComponentStatus {
  name: string;
  state: 'operational' | 'degraded' | 'outage';
  lastCheck: number;
  metadata?: {
    latency?: number;
    uptime?: number;
    provider?: string;
    message?: string;
  };
}

export default function StatusPage() {
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status/healthz');
      const data = await res.json();
      setComponents(data.components);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }

  const overallStatus = components.some((c) => c.state === 'outage')
    ? 'outage'
    : components.some((c) => c.state === 'degraded')
    ? 'degraded'
    : 'operational';

  const statusConfig = {
    operational: { color: 'green', icon: '🟢', text: 'All Systems Operational' },
    degraded: { color: 'yellow', icon: '🟠', text: 'Partial Service Degradation' },
    outage: { color: 'red', icon: '🔴', text: 'Service Outage' }
  };

  const status = statusConfig[overallStatus];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">F0 System Status</h1>
      <p className="text-gray-600 mb-8">Real-time status of all F0 services</p>

      {/* Overall Status */}
      <div
        className={`p-6 rounded-lg mb-8 bg-${status.color}-50 border border-${status.color}-200`}
      >
        <div className="flex items-center">
          <span className="text-3xl mr-4">{status.icon}</span>
          <div>
            <h2 className="text-xl font-semibold">{status.text}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Component Status */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          components.map((component) => (
            <ComponentCard key={component.name} component={component} />
          ))
        )}
      </div>

      {/* Historical Uptime */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">90-Day Uptime</h2>
        <div className="grid grid-cols-3 gap-4">
          <UptimeCard component="API" uptime={99.8} />
          <UptimeCard component="Auth" uptime={99.9} />
          <UptimeCard component="Billing" uptime={99.7} />
        </div>
      </div>
    </div>
  );
}

function ComponentCard({ component }: { component: ComponentStatus }) {
  const stateConfig = {
    operational: { color: 'green', icon: '🟢', text: 'Operational' },
    degraded: { color: 'yellow', icon: '🟠', text: 'Degraded' },
    outage: { color: 'red', icon: '🔴', text: 'Outage' }
  };

  const config = stateConfig[component.state];

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{component.name}</h3>
          {component.metadata?.message && (
            <p className="text-sm text-gray-600 mt-1">{component.metadata.message}</p>
          )}
          {component.metadata?.latency && (
            <p className="text-xs text-gray-500 mt-1">
              Latency: {component.metadata.latency}ms
            </p>
          )}
        </div>
        <div className={`flex items-center text-${config.color}-600`}>
          <span className="mr-2">{config.icon}</span>
          <span className="font-medium">{config.text}</span>
        </div>
      </div>
    </div>
  );
}

function UptimeCard({ component, uptime }: { component: string; uptime: number }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-2">{component}</h3>
      <div className="text-3xl font-bold text-green-600">{uptime}%</div>
      <p className="text-xs text-gray-500 mt-1">Last 90 days</p>
    </div>
  );
}
```

### Health Check API

```typescript
// src/app/api/status/healthz/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const components = await Promise.all([
      checkAPI(),
      checkAuth(),
      checkBilling(),
      checkAIProviders(),
      checkDatabase(),
      checkStorage()
    ]);

    // Save to Firestore
    for (const component of components) {
      await adminDb.collection('status').doc('components').collection('current').doc(component.name).set({
        ...component,
        updatedAt: Date.now()
      });
    }

    return NextResponse.json({ components });
  } catch (error) {
    console.error('[GET /api/status/healthz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

async function checkAPI() {
  const start = Date.now();
  try {
    // Test API endpoint
    const res = await fetch('https://yourapp.web.app/api/health');
    const latency = Date.now() - start;

    return {
      name: 'API',
      state: latency < 500 ? 'operational' : 'degraded',
      lastCheck: Date.now(),
      metadata: { latency }
    };
  } catch (error) {
    return {
      name: 'API',
      state: 'outage',
      lastCheck: Date.now(),
      metadata: { message: 'API unreachable' }
    };
  }
}

async function checkAuth() {
  // Test Firebase Auth
  try {
    // Simple check - can extend with actual test
    return {
      name: 'Auth',
      state: 'operational',
      lastCheck: Date.now(),
      metadata: { provider: 'Firebase Auth' }
    };
  } catch (error) {
    return {
      name: 'Auth',
      state: 'outage',
      lastCheck: Date.now()
    };
  }
}

async function checkBilling() {
  // Test Stripe API
  try {
    // Ping Stripe status or test endpoint
    return {
      name: 'Billing',
      state: 'operational',
      lastCheck: Date.now(),
      metadata: { provider: 'Stripe' }
    };
  } catch (error) {
    return {
      name: 'Billing',
      state: 'degraded',
      lastCheck: Date.now(),
      metadata: { message: 'Stripe connectivity issues' }
    };
  }
}

async function checkAIProviders() {
  // Could check Claude/OpenAI status pages
  return {
    name: 'AI Providers',
    state: 'operational',
    lastCheck: Date.now(),
    metadata: { provider: 'Claude, OpenAI' }
  };
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await adminDb.collection('_health').doc('test').set({ ping: Date.now() });
    const latency = Date.now() - start;

    return {
      name: 'Database',
      state: latency < 200 ? 'operational' : 'degraded',
      lastCheck: Date.now(),
      metadata: { provider: 'Firestore', latency }
    };
  } catch (error) {
    return {
      name: 'Database',
      state: 'outage',
      lastCheck: Date.now()
    };
  }
}

async function checkStorage() {
  return {
    name: 'Storage',
    state: 'operational',
    lastCheck: Date.now(),
    metadata: { provider: 'Cloud Storage' }
  };
}
```

### Status Badge Component

```typescript
// src/components/StatusBadge.tsx
'use client';

import { useEffect, useState } from 'react';

export function StatusBadge() {
  const [status, setStatus] = useState<'operational' | 'degraded' | 'outage'>('operational');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status/healthz');
      const data = await res.json();

      const hasOutage = data.components.some((c: any) => c.state === 'outage');
      const hasDegraded = data.components.some((c: any) => c.state === 'degraded');

      setStatus(hasOutage ? 'outage' : hasDegraded ? 'degraded' : 'operational');
    } catch (error) {
      setStatus('outage');
    }
  }

  const config = {
    operational: { color: 'green', label: 'All systems operational' },
    degraded: { color: 'yellow', label: 'Some systems degraded' },
    outage: { color: 'red', label: 'Service outage' }
  };

  const { color, label } = config[status];

  return (
    <a
      href="/status"
      className="flex items-center space-x-2 px-3 py-1 rounded-full hover:bg-gray-100"
      title={label}
    >
      <span className={`w-2 h-2 rounded-full bg-${color}-500`} />
      <span className="text-xs text-gray-600">Status</span>
    </a>
  );
}
```

### Firestore Rules

```javascript
// firestore.rules (add)
match /status/components/{id} {
  allow read: if true; // Public read
  allow write: if false; // Functions only
}
```

---

## 4️⃣ Incident Management & Runbooks

### Goal
Manage incidents and track resolution with documented playbooks.

### File Structure

```
src/app/(admin)/incidents/
  └── page.tsx                 # Incident dashboard

src/app/api/incidents/
  └── route.ts                 # CRUD endpoints

runbooks/
  ├── billing-outage.md
  ├── provider-degradation.md
  ├── firestore-hotspot.md
  ├── auth-issues.md
  ├── webhook-failures.md
  └── rate-limit-anomaly.md

Firestore:
  incidents/{id}
```

### Incident Dashboard

```typescript
// src/app/(admin)/incidents/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  async function fetchIncidents() {
    const res = await fetch(`/api/incidents?status=${filter}`);
    const data = await res.json();
    setIncidents(data.incidents);
  }

  async function createIncident() {
    const title = prompt('Incident title:');
    if (!title) return;

    await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        impact: 'medium',
        status: 'investigating'
      })
    });

    fetchIncidents();
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Incidents</h1>
        <button
          onClick={createIncident}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Create Incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex space-x-2 mb-6">
        {['open', 'mitigating', 'resolved'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {incidents.map((incident: any) => (
          <IncidentCard key={incident.id} incident={incident} onUpdate={fetchIncidents} />
        ))}
      </div>
    </div>
  );
}

function IncidentCard({ incident, onUpdate }: any) {
  const impactColors = {
    low: 'blue',
    medium: 'yellow',
    high: 'orange',
    critical: 'red'
  };

  const color = impactColors[incident.impact] || 'gray';

  async function addUpdate() {
    const message = prompt('Update message:');
    if (!message) return;

    await fetch(`/api/incidents/${incident.id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    onUpdate();
  }

  async function resolve() {
    await fetch(`/api/incidents/${incident.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' })
    });

    onUpdate();
  }

  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">{incident.title}</h3>
          <div className="flex items-center space-x-4 mt-2">
            <span className={`px-2 py-1 rounded text-sm bg-${color}-100 text-${color}-800`}>
              {incident.impact.toUpperCase()}
            </span>
            <span className="text-sm text-gray-600">
              Started {formatDistanceToNow(incident.startedAt)} ago
            </span>
          </div>
        </div>
        <div className="space-x-2">
          <button
            onClick={addUpdate}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            Add Update
          </button>
          {incident.status !== 'resolved' && (
            <button
              onClick={resolve}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Mark Resolved
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {incident.updates && incident.updates.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h4 className="font-semibold mb-2">Timeline:</h4>
          <div className="space-y-2">
            {incident.updates.map((update: any, i: number) => (
              <div key={i} className="text-sm">
                <span className="text-gray-500">
                  {new Date(update.timestamp).toLocaleString()}
                </span>
                {' - '}
                <span>{update.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Sample Runbook

````markdown
# Billing Outage Runbook

## Severity: Critical

## Symptoms
- Spike in `payment_failed` webhook events (>10%)
- Users reporting failed payments or subscription issues
- Stripe webhook delivery failures

## Detection
- Alert: "Webhook failure rate > 10%"
- Monitoring dashboard shows red for billing component
- Check `/admin/analytics/usage` for payment drops

## Initial Response (5 minutes)

1. **Verify Stripe Status**
   - Visit https://status.stripe.com
   - Check for ongoing incidents

2. **Check Webhook Logs**
   ```bash
   firebase functions:log --only stripeWebhook --lines 100
   ```

3. **Create Incident**
   - Navigate to `/admin/incidents`
   - Create: "Billing Outage - Stripe Webhook Failures"
   - Set impact: Critical

4. **Alert Team**
   - Post to `#ops-alerts` Slack channel
   - Notify on-call engineer

## Diagnosis (15 minutes)

### If Stripe is down:
- Check Stripe Dashboard for service status
- Review recent Stripe API changes
- Verify webhook endpoint is accessible

### If webhook function is failing:
- Check Cloud Functions quota
- Review recent deployments
- Inspect function error logs

### If quota exceeded:
- Check Cloud Functions dashboard
- Verify billing account active
- Review usage patterns

## Mitigation

### Scenario 1: Stripe Service Outage
```bash
# Enable feature flag to disable subscription enforcement
# Via /admin/config/feature-flags
{
  "subscriptions.enforced": false
}
```
- Display banner: "Payment processing delayed. Access not affected."
- Queue failed payments for retry
- Monitor Stripe status for recovery

### Scenario 2: Webhook Function Failure
```bash
# Manually process failed webhooks from Stripe Dashboard
# Redeploy webhook function
firebase deploy --only functions:stripeWebhook

# Verify function health
firebase functions:log --only stripeWebhook
```

### Scenario 3: Quota Exceeded
- Increase Cloud Functions quota in GCP Console
- Scale up instances: `firebase functions:config:set instance.count=10`
- Monitor billing

## Resolution

1. **Verify Normal Operation**
   - Check webhook success rate >98%
   - Verify new payments processing
   - Monitor error logs

2. **Process Queued Payments**
   - Run retry script for failed payments
   - Verify user subscriptions updated

3. **Update Incident**
   - Status: "Resolved"
   - Add resolution timestamp
   - Document root cause

4. **Post-Mortem** (within 48 hours)
   - Schedule post-mortem meeting
   - Document timeline and actions
   - Identify preventive measures

## Prevention

- **Webhook Retry Logic**: Implement exponential backoff
- **Circuit Breaker**: Auto-disable failing endpoints
- **Rate Limit Monitoring**: Alert before quota reached
- **Stripe Status Webhook**: Subscribe to Stripe status updates

## Related Runbooks
- [webhook-failures.md](./webhook-failures.md)
- [rate-limit-anomaly.md](./rate-limit-anomaly.md)

---

**Last Updated:** 2025-01-30
**Maintainer:** ops@f0.com
````

---

## 5️⃣ Cost & Quota Tracking

### Goal
Analyze cost and resource consumption.

### Cost Dashboard

```typescript
// src/app/(admin)/costs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

export default function CostsPage() {
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCosts();
  }, []);

  async function fetchCosts() {
    const res = await fetch('/api/admin/costs');
    const data = await res.json();
    setCosts(data);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-8">Loading costs...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Cost & Quota Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <CostCard
          title="Today's Cost"
          value={`$${costs.today.toFixed(2)}`}
          change="+12%"
        />
        <CostCard
          title="This Month"
          value={`$${costs.month.toFixed(2)}`}
          change="+8%"
        />
        <CostCard
          title="Quota Usage"
          value={`${costs.quotaPercent}%`}
          change="78% of limit"
        />
        <CostCard
          title="Avg Per User"
          value={`$${costs.avgPerUser.toFixed(2)}`}
          change="-3%"
        />
      </div>

      {/* Cost by Model */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Cost by Model</h2>
        <div className="space-y-2">
          {costs.byModel.map((model: any) => (
            <div key={model.name} className="flex items-center justify-between">
              <span>{model.name}</span>
              <span className="font-semibold">${model.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Trend Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">7-Day Cost Trend</h2>
        <Line data={costs.chartData} />
      </div>
    </div>
  );
}

function CostCard({ title, value, change }: any) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{change}</div>
    </div>
  );
}
```

### Enhanced Usage Summary

```javascript
// Firestore: usage_summary/{uid}/daily/{dayId}
{
  calls: number,
  tokens: {
    input: number,
    output: number
  },
  duration: number,
  cost: number,                    // in cents
  estimated_cost_usd: number,      // NEW: calculated cost
  quota_pct: number,               // NEW: % of plan limit
  breakdown_by_model: {
    claude_sonnet_4_5: {
      calls: number,
      tokens: { input: number, output: number },
      cost: number
    },
    // ... other models
  },
  timestamp: number
}
```

---

## ⚙️ Feature Flags

```json
{
  "alerts": {
    "slack": true,
    "email": true,
    "pagerduty": false
  },
  "ops": {
    "slo_enforced": true,
    "public_status_page": true,
    "metrics_collection": true
  },
  "quotas": {
    "enabled": true,
    "soft_limit_warning": 0.8,
    "hard_limit_block": 1.0
  },
  "costs": {
    "dashboard": true,
    "realtime_tracking": true
  }
}
```

---

## ✅ Pre-Flight Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Slack webhook enabled in `.env` | ⬜ |
| 2 | `slo.json` populated with correct values | ⬜ |
| 3 | `metricsIngest` and `alertRules` deployed successfully | ⬜ |
| 4 | `/status` page functional and updating | ⬜ |
| 5 | Firestore rules allow public read for `status` | ⬜ |
| 6 | Runbooks exist and linked to incidents | ⬜ |
| 7 | `/admin/costs` dashboard shows daily cost | ⬜ |
| 8 | Alert emails configured | ⬜ |
| 9 | Status badge visible in navbar | ⬜ |
| 10 | Health checks running every 30 seconds | ⬜ |

---

## 🧪 Smoke & Chaos Tests (7 Tests)

### Test 1: Simulated API Outage

```bash
# Temporarily disable API endpoint (local test)
# Or block port 3000 with firewall

# Expected:
# - Status page shows "Degraded" or "Outage"
# - Alert sent to Slack within 5 minutes
# - Incident auto-created (if configured)
```

**✅ Pass Criteria:**
- Status updates within 1 minute
- Alert received
- Badge turns red

---

### Test 2: High Latency Alert

```bash
# Artificially increase response time
# Add sleep(500) to API route

# Wait for alert evaluation (5 minutes)

# Expected:
# - Slack alert: "API Latency p95 > 400ms"
# - Severity: Warning
```

**✅ Pass Criteria:**
- Alert triggers within 10 minutes
- Correct severity and metric value

---

### Test 3: Quota Exceed Warning

```bash
# Make requests until quota at 80%

# Expected:
# - Dashboard shows warning badge
# - Notification sent to user
# - Admin alert (if configured)
```

**✅ Pass Criteria:**
- Warning appears at 80%
- Hard block at 100%

---

### Test 4: Incident Creation & Timeline

```bash
# Create incident via UI
POST /api/incidents
{
  "title": "Test Incident",
  "impact": "medium",
  "status": "investigating"
}

# Add updates
# Resolve incident

# Expected:
# - Incident appears in dashboard
# - Timeline shows all updates
# - Timestamps accurate
```

**✅ Pass Criteria:**
- CRUD operations work
- Timeline preserved
- Status transitions correct

---

### Test 5: Service Recovery

```bash
# After fixing issue from Test 1

# Expected:
# - Status returns to "Operational"
# - Green badge in navbar
# - Incident can be marked resolved
```

**✅ Pass Criteria:**
- Auto-recovery detected
- Status updated within 2 minutes

---

### Test 6: Webhook Failure Alert

```bash
# Trigger webhook failure in Stripe test mode
stripe trigger invoice.payment_failed

# Simulate webhook endpoint down

# Expected:
# - Incident created: "webhook-failures"
# - Email alert sent
# - Slack notification
```

**✅ Pass Criteria:**
- All alert channels triggered
- Runbook linked

---

### Test 7: Cost Aggregation

```bash
# Make 100 agent requests with different models

# Check /admin/costs

# Expected:
# - Today's cost updated
# - Breakdown by model accurate
# - Chart shows trend
```

**✅ Pass Criteria:**
- Cost calculation correct (±2%)
- All models tracked

---

## 🚀 Deployment Commands

```bash
# Deploy metrics and alert functions
firebase deploy --only functions:metricsIngest,functions:alertRules

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy hosting (status page, dashboards)
npm run build && firebase deploy --only hosting

# Verify deployment
curl https://yourapp.web.app/status
curl https://yourapp.web.app/api/status/healthz
```

---

## 🧯 Kill-Switch Controls

| Issue | Flag | Effect |
|-------|------|--------|
| Slack alerts duplicating | `alerts.slack = false` | Disable Slack notifications |
| SLO misconfiguration | `ops.slo_enforced = false` | Stop alert evaluation |
| Public status page outdated | `status.public = false` | Hide status page |
| Dashboard causing load | `costs.dashboard = false` | Disable cost dashboard |
| Quota miscounting | `quotas.enabled = false` | Disable quota checks |

**Access:** `/admin/config/feature-flags`

---

## 📊 Success Metrics

### Week 1 Post-Launch

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API Uptime | ≥ 99.5% | ___ | ⬜ |
| p95 Latency | ≤ 400 ms | ___ | ⬜ |
| MTTR | ≤ 2 hours | ___ | ⬜ |
| False Alerts | ≤ 1% | ___ | ⬜ |
| Incident Resolution | ≥ 90% in 24h | ___ | ⬜ |
| Cost Tracking Accuracy | ±5% variance | ___ | ⬜ |
| Status Page Load Time | < 2 seconds | ___ | ⬜ |

---

## 📚 Documentation to Create

1. **RUNBOOKS_GUIDE.md** - How to write and use runbooks
2. **F0_STATUS_PAGE_SETUP.md** - Status page configuration
3. **ALERT_RULES_REFERENCE.md** - All alert rules and thresholds
4. **COSTS_DASHBOARD_SETUP.md** - Cost tracking setup guide

---

**Guide Version:** 1.0
**Last Updated:** 2025-01-30
**Next Review:** After Sprint 22 completion

🛡️ **Ready to Operate F0!**
