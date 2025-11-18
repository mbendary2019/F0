#!/usr/bin/env node
/**
 * Cloudflare WAF Rules Automation
 * Phase 30 - Security Hardening
 * 
 * Apply WAF rules via Cloudflare API
 */

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID;

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   CLOUDFLARE_API_TOKEN (or CF_API_TOKEN)');
  console.error('   CLOUDFLARE_ZONE_ID (or CF_ZONE_ID)');
  process.exit(1);
}

const API_BASE = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}`;

// WAF Rule Definitions (Phase 30)
const WAF_RULES = [
  {
    id: 'f0-rate-limit-api',
    description: 'Rate limit API endpoints',
    expression: '(http.request.uri.path matches "^/api/.*")',
    action: 'challenge',
    enabled: true,
    priority: 1
  },
  {
    id: 'f0-block-sql-injection',
    description: 'Block common SQL injection patterns',
    expression: '(http.request.uri.query contains "union select" or http.request.uri.query contains "1=1" or http.request.uri.query contains "drop table")',
    action: 'block',
    enabled: true,
    priority: 2
  },
  {
    id: 'f0-block-xss',
    description: 'Block common XSS patterns',
    expression: '(http.request.uri.query contains "<script" or http.request.uri.query contains "javascript:" or http.request.uri.query contains "onerror=")',
    action: 'block',
    enabled: true,
    priority: 3
  },
  {
    id: 'f0-block-path-traversal',
    description: 'Block path traversal attempts',
    expression: '(http.request.uri.path contains "../" or http.request.uri.path contains "..%2f")',
    action: 'block',
    enabled: true,
    priority: 4
  },
  {
    id: 'f0-geographic-restrictions',
    description: 'Challenge non-allowed countries (optional)',
    expression: '(ip.geoip.country ne "US" and ip.geoip.country ne "CA" and ip.geoip.country ne "GB")',
    action: 'managed_challenge',
    enabled: false, // Disabled by default
    priority: 10
  }
];

async function applyWAFRules() {
  console.log('🛡️  Applying Cloudflare WAF Rules...\n');

  for (const rule of WAF_RULES) {
    try {
      console.log(`📋 Processing rule: ${rule.id}`);
      console.log(`   Description: ${rule.description}`);
      console.log(`   Action: ${rule.action}`);
      console.log(`   Enabled: ${rule.enabled}`);

      // Check if rule exists
      const listResponse = await fetch(`${API_BASE}/firewall/rules`, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list rules: ${listResponse.statusText}`);
      }

      const { result: existingRules } = await listResponse.json();
      const existingRule = existingRules?.find(r => r.description === rule.description);

      let endpoint, method;
      if (existingRule) {
        // Update existing rule
        endpoint = `${API_BASE}/firewall/rules/${existingRule.id}`;
        method = 'PUT';
        console.log(`   → Updating existing rule (${existingRule.id})`);
      } else {
        // Create new rule
        endpoint = `${API_BASE}/firewall/rules`;
        method = 'POST';
        console.log('   → Creating new rule');
      }

      // Create/update filter first
      const filterResponse = await fetch(`${API_BASE}/filters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          expression: rule.expression,
          description: `Filter for ${rule.description}`
        }])
      });

      if (!filterResponse.ok) {
        throw new Error(`Failed to create filter: ${filterResponse.statusText}`);
      }

      const { result: filters } = await filterResponse.json();
      const filterId = filters[0]?.id;

      if (!filterId) {
        throw new Error('Filter creation failed: No filter ID returned');
      }

      // Create/update rule
      const ruleResponse = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          filter: { id: filterId },
          action: rule.action,
          description: rule.description,
          priority: rule.priority,
          paused: !rule.enabled
        }])
      });

      if (!ruleResponse.ok) {
        const errorText = await ruleResponse.text();
        throw new Error(`Failed to ${method === 'PUT' ? 'update' : 'create'} rule: ${errorText}`);
      }

      console.log(`   ✅ Success\n`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
      // Continue with other rules even if one fails
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ WAF Rules Application Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run
applyWAFRules().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


