/**
 * Ops Copilot Page
 * AI-powered operations assistant for troubleshooting and insights
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export default function OpsCopilotPage() {
  const [query, setQuery] = useState('Why did latency spike in the last hour?');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    // Load initial context
    loadContext();
  }, []);

  async function loadContext() {
    try {
      const res = await fetch('/api/admin/metrics/summary', { cache: 'no-store' });
      const data = await res.json();
      setContext(data);
    } catch (err) {
      console.error('[OpsCopilot] Failed to load context:', err);
    }
  }

  async function ask() {
    if (!query.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Placeholder: Mock AI response based on available data
      // TODO: Connect to LLM API (OpenAI, Claude, etc.) for real responses
      
      const response = await generateMockResponse(query, context);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setQuery('');
    } catch (err) {
      console.error('[OpsCopilot] Error:', err);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ops Copilot</h1>
          <p className="text-sm opacity-70 mt-1">
            AI-powered operations assistant
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/dashboard" className="underline">
            Dashboard
          </Link>
          <Link href="/admin/insights" className="underline">
            Insights
          </Link>
        </nav>
      </header>

      {/* Context Summary */}
      {context && (
        <div className="rounded-2xl border p-4 bg-gray-50">
          <h3 className="font-medium mb-2 text-sm">Current System State</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="opacity-60">API Calls (24h)</span>
              <div className="font-semibold">{context.totals?.calls24h ?? 0}</div>
            </div>
            <div>
              <span className="opacity-60">Errors (24h)</span>
              <div className="font-semibold">{context.totals?.errors24h ?? 0}</div>
            </div>
            <div>
              <span className="opacity-60">p95 Latency</span>
              <div className="font-semibold">{context.totals?.p95 ?? 0}ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="rounded-2xl border p-4 min-h-96 max-h-96 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 opacity-60">
            <div className="text-4xl mb-2">🤖</div>
            <p>Ask me anything about your system operations</p>
            <div className="mt-4 text-sm">
              <p>Example questions:</p>
              <ul className="mt-2 space-y-1">
                <li>• Why did latency spike in the last hour?</li>
                <li>• What's causing the error rate increase?</li>
                <li>• Which endpoints are performing poorly?</li>
                <li>• Show me recent anomalies</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-blue-50 ml-12'
                  : 'bg-gray-50 mr-12'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {msg.role === 'user' ? '👤 You' : '🤖 Copilot'}
                </span>
                <span className="text-xs opacity-60">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}

        {loading && (
          <div className="p-3 rounded-xl bg-gray-50 mr-12">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">🤖 Copilot</span>
              <span className="text-xs opacity-60">Thinking...</span>
            </div>
            <div className="flex gap-1 mt-2">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="rounded-2xl border p-4 space-y-3">
        <textarea
          className="w-full border rounded-lg p-3 min-h-24 resize-none"
          placeholder="Ask a question about your system..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs opacity-60">
            Press Enter to send, Shift+Enter for new line
          </span>
          <button
            onClick={ask}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !query.trim()}
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border p-4">
        <h3 className="font-medium mb-3 text-sm">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setQuery('Show me recent anomalies')}
            className="text-left p-2 rounded-lg border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            📊 Recent Anomalies
          </button>
          <button
            onClick={() => setQuery('What are the top 5 slowest endpoints?')}
            className="text-left p-2 rounded-lg border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            🐌 Slow Endpoints
          </button>
          <button
            onClick={() => setQuery('Show me error trends')}
            className="text-left p-2 rounded-lg border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            🚨 Error Trends
          </button>
          <button
            onClick={() => setQuery('Predict traffic for next hour')}
            className="text-left p-2 rounded-lg border hover:bg-gray-50 text-sm"
            disabled={loading}
          >
            🔮 Traffic Forecast
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * Generate mock AI response based on query and context
 * TODO: Replace with actual LLM API call
 */
async function generateMockResponse(query: string, context: any): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const lowerQuery = query.toLowerCase();

  // Pattern matching for common questions
  if (lowerQuery.includes('latency') && lowerQuery.includes('spike')) {
    return `Based on recent metrics:

📊 p95 Latency: ${context?.totals?.p95 ?? 0}ms

Possible causes:
• Database query performance degradation
• Increased traffic load (${context?.totals?.calls24h ?? 0} calls in 24h)
• External API slowdowns
• Resource contention

Suggested actions:
1. Review slow query logs
2. Check database connection pool
3. Monitor external service health
4. Consider scaling resources

Would you like me to check specific endpoints?`;
  }

  if (lowerQuery.includes('error')) {
    return `Error Analysis:

🚨 Errors (24h): ${context?.totals?.errors24h ?? 0}
📈 Error Rate: ${context?.totals?.calls24h > 0 
  ? ((context.totals.errors24h / context.totals.calls24h) * 100).toFixed(2) 
  : 0}%

Common causes:
• Authentication failures
• Rate limiting
• Invalid requests
• Service dependencies down

Next steps:
1. Check /admin/audit for error logs
2. Review recent deployments
3. Verify external service status
4. Check rate limit configs`;
  }

  if (lowerQuery.includes('anomal')) {
    return `Recent Anomaly Detection:

I'll check the anomaly_events collection...

Visit /admin/insights to see:
• AI-detected anomalies
• Severity classification
• Root cause analysis
• Suggested remediation

Would you like me to pull specific anomaly details?`;
  }

  if (lowerQuery.includes('forecast') || lowerQuery.includes('predict')) {
    return `Traffic Prediction:

🔮 Next 15 minutes: ~${Math.round((context?.totals?.calls24h ?? 0) / 96)} calls
📊 Confidence: 95%

Based on 24-hour moving average.

For detailed forecasts:
• Check predictions_daily collection
• View trend analysis in dashboard
• Set up remediation rules for thresholds

Would you like to see hourly predictions?`;
  }

  // Generic response
  return `I understand you're asking about: "${query}"

Current system metrics:
• API Calls: ${context?.totals?.calls24h ?? 0} (24h)
• Errors: ${context?.totals?.errors24h ?? 0} (24h)
• p95 Latency: ${context?.totals?.p95 ?? 0}ms

To help better, I can:
• Analyze specific metrics or endpoints
• Explain recent anomalies
• Suggest remediation actions
• Forecast future trends

Please provide more details or try asking:
• "What's causing [specific issue]?"
• "Show me [specific metric] trends"
• "Predict [specific metric] for next hour"`;
}

