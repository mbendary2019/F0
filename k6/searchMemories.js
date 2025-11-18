/**
 * Phase 56 Day 2 - Load Test for searchMemories
 *
 * Prerequisites:
 * 1. Install k6: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation/
 * 2. Deploy searchMemories function
 * 3. Update FUNCTION_URL below with your deployed function URL
 * 4. Update AUTH_TOKEN with a valid Firebase ID token
 *
 * Run:
 * k6 run k6/searchMemories.js
 *
 * Options:
 * - Light load: k6 run --vus 5 --duration 30s k6/searchMemories.js
 * - Medium load: k6 run --vus 20 --duration 1m k6/searchMemories.js
 * - Stress test: k6 run --vus 50 --duration 2m k6/searchMemories.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Configuration
const FUNCTION_URL = __ENV.FUNCTION_URL || 'https://us-central1-from-zero-84253.cloudfunctions.net/searchMemories';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''; // Optional: Firebase ID token for authenticated requests

// Custom metrics
const errorRate = new Rate('errors');
const searchDuration = new Trend('search_duration');
const resultsCount = new Trend('results_count');

// Load test options
export const options = {
  vus: 10,              // Virtual users
  duration: '30s',      // Test duration
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be under 2s
    http_req_failed: ['rate<0.1'],      // Error rate should be less than 10%
    errors: ['rate<0.1'],
  },
};

// Test queries (varied to test different search patterns)
const TEST_QUERIES = [
  { query: 'user authentication', hybridBoost: 0.35, topK: 10 },
  { query: 'login error', hybridBoost: 0.35, topK: 8 },
  { query: 'firebase', hybridBoost: 0.5, topK: 5 },
  { query: 'database connection', hybridBoost: 0.3, topK: 12 },
  { query: 'API endpoint', hybridBoost: 0.4, topK: 10 },
  { query: 'memory timeline', hybridBoost: 0.25, topK: 8 },
  { query: 'collaborative editing', hybridBoost: 0.35, topK: 10 },
  { query: 'bug fix', hybridBoost: 0.45, topK: 6 },
];

// Room filters (optional)
const ROOM_IDS = [
  'ide-file-demo-page-tsx',
  'test-room-1',
  'test-room-2',
  null, // No filter
];

export default function () {
  // Select random query and room
  const testQuery = TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];
  const roomId = ROOM_IDS[Math.floor(Math.random() * ROOM_IDS.length)];

  // Build request payload
  const payload = JSON.stringify({
    query: testQuery.query,
    topK: testQuery.topK,
    hybridBoost: testQuery.hybridBoost,
    ...(roomId && { roomId }),
  });

  // Build request headers
  const headers = {
    'Content-Type': 'application/json',
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  // Make request
  const start = new Date().getTime();
  const res = http.post(FUNCTION_URL, payload, { headers });
  const duration = new Date().getTime() - start;

  // Record metrics
  searchDuration.add(duration);

  // Check response
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has data property': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('data') || body.hasOwnProperty('items');
      } catch (e) {
        return false;
      }
    },
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  // Parse and validate results
  if (success && res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const items = body.data?.items || body.items || [];

      resultsCount.add(items.length);

      // Additional checks
      check(items, {
        'has valid items': (items) => Array.isArray(items),
        'items have required fields': (items) => {
          if (items.length === 0) return true;
          const firstItem = items[0];
          return firstItem.hasOwnProperty('id') &&
                 firstItem.hasOwnProperty('score') &&
                 firstItem.hasOwnProperty('text');
        },
        'scores are valid': (items) => {
          if (items.length === 0) return true;
          return items.every(item =>
            typeof item.score === 'number' &&
            item.score >= 0 &&
            item.score <= 1
          );
        },
        'results are sorted by score': (items) => {
          if (items.length <= 1) return true;
          for (let i = 1; i < items.length; i++) {
            if (items[i].score > items[i-1].score) return false;
          }
          return true;
        },
      });
    } catch (e) {
      console.error('Failed to parse response:', e);
      errorRate.add(1);
    }
  } else {
    errorRate.add(1);
    console.error(`Request failed: ${res.status} - ${res.body.slice(0, 200)}`);
  }

  // Think time (simulate user behavior)
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once at the start)
export function setup() {
  console.log('🚀 Starting searchMemories load test...');
  console.log(`   Function URL: ${FUNCTION_URL}`);
  console.log(`   Test duration: ${options.duration}`);
  console.log(`   Virtual users: ${options.vus}`);
  console.log('');
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('');
  console.log('✅ Load test completed!');
  console.log('');
  console.log('💡 Tips:');
  console.log('   - Check Firebase Console for function logs');
  console.log('   - Monitor Cloud Functions metrics for latency and errors');
  console.log('   - Review searchMemories:success logs for performance insights');
  console.log('');
}
