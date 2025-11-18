// __tests__/rag/policy.test.ts
// Phase 58: Tests for strategy selection policy

import { chooseStrategy, getStrategyConfidence, explainStrategy } from '../../src/lib/rag/policy';
import { RecallOpts } from '../../src/lib/rag/types';

describe('RAG Policy - Strategy Selection', () => {
  const mockOpts: RecallOpts = {
    workspaceId: 'test_workspace',
  };

  describe('chooseStrategy', () => {
    test('should choose sparse for quoted strings', () => {
      const query = 'find "exact match phrase" in docs';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('sparse');
    });

    test('should choose sparse for filter patterns', () => {
      const query = 'file:package.json npm install';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('sparse');
    });

    test('should choose hybrid for code blocks', () => {
      const query = '```typescript\nfunction hello() {}\n```';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('hybrid');
    });

    test('should choose hybrid for code keywords', () => {
      const query = 'async function getData from API';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('hybrid');
    });

    test('should choose hybrid for short queries', () => {
      const query = 'api error';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('hybrid');
    });

    test('should choose dense for long natural language queries', () => {
      const query = 'How do I implement authentication with social login providers in my Next.js application?';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('dense');
    });

    test('should choose dense for medium natural language queries', () => {
      const query = 'explain error handling in TypeScript';
      const strategy = chooseStrategy(query, mockOpts);
      expect(strategy).toBe('dense');
    });
  });

  describe('getStrategyConfidence', () => {
    test('should return high confidence for quoted sparse queries', () => {
      const query = '"exact phrase search"';
      const confidence = getStrategyConfidence(query, 'sparse');
      expect(confidence).toBeGreaterThan(0.9);
    });

    test('should return high confidence for long dense queries', () => {
      const query = 'This is a very long natural language query about deployment';
      const confidence = getStrategyConfidence(query, 'dense');
      expect(confidence).toBeGreaterThan(0.85);
    });

    test('should return medium confidence for ambiguous queries', () => {
      const query = 'login api';
      const confidence = getStrategyConfidence(query, 'hybrid');
      expect(confidence).toBeGreaterThanOrEqual(0.7);
      expect(confidence).toBeLessThan(0.9);
    });
  });

  describe('explainStrategy', () => {
    test('should explain sparse selection for quoted queries', () => {
      const query = '"exact match"';
      const explanation = explainStrategy(query, 'sparse');
      expect(explanation).toContain('Quoted string');
    });

    test('should explain hybrid selection for code', () => {
      const query = '```code```';
      const explanation = explainStrategy(query, 'hybrid');
      expect(explanation).toContain('Code block');
    });

    test('should explain dense selection for long queries', () => {
      const query = 'This is a very long natural language question about something';
      const explanation = explainStrategy(query, 'dense');
      expect(explanation).toContain('Long natural language');
    });
  });
});
