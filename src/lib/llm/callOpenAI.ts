/**
 * Phase 87.2: Simple OpenAI API wrapper for Code Agent
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callOpenAI(messages: LLMMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Fast and cheap for code generation
      messages,
      temperature: 0.2, // Low temperature for more predictable code
      max_tokens: 4000,
      response_format: { type: 'json_object' }, // Force JSON mode
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API failed: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
