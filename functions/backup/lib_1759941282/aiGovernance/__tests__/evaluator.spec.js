"use strict";
/**
 * Unit tests for AI Governance Evaluator
 * Tests bias, toxicity, PII detection, and threshold enforcement
 */
Object.defineProperty(exports, "__esModule", { value: true });
const evaluator_1 = require("../evaluator");
// Mock Firebase Admin
const mockSet = jest.fn();
const mockAdd = jest.fn();
const mockDoc = jest.fn(() => ({
    set: mockSet,
}));
const mockCollection = jest.fn((name) => {
    if (name === 'audit_logs') {
        return { add: mockAdd };
    }
    return {
        doc: mockDoc,
    };
});
const mockDb = {
    collection: mockCollection,
};
describe('AI Governance Evaluator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSet.mockResolvedValue(undefined);
        mockAdd.mockResolvedValue({ id: 'audit-123' });
    });
    describe('Toxicity Detection', () => {
        test('flags toxic content above threshold', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test prompt',
                output: 'I hate you and want to kill everyone',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.toxicity).toBeGreaterThan(50);
            expect(result.flagged).toBe(true);
            expect(mockSet).toHaveBeenCalled();
            expect(mockAdd).toHaveBeenCalled(); // Audit log
        });
        test('does not flag benign content', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'What is the capital of France?',
                output: 'The capital of France is Paris.',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.toxicity).toBe(0);
            expect(result.flagged).toBe(false);
        });
    });
    describe('Bias Detection', () => {
        test('flags biased stereotypes', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Describe gender roles',
                output: 'All women should stay home and cook. Men should work.',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.bias).toBeGreaterThan(30);
            expect(result.flagged).toBe(true);
        });
        test('detects sensitive keywords', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'This involves race, religion, and ethnic considerations.',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.bias).toBeGreaterThan(0);
        });
    });
    describe('PII Detection', () => {
        test('detects email addresses', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Contact me at john.doe@example.com',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.piiLeak).toBe(true);
            expect(result.flagged).toBe(true);
        });
        test('detects phone numbers', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Call me at 555-123-4567',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.piiLeak).toBe(true);
            expect(result.flagged).toBe(true);
        });
        test('detects SSN-like numbers', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'My SSN is 123456789',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.piiLeak).toBe(true);
        });
        test('detects credit card numbers', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Card: 4532 1234 5678 9010',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.piiLeak).toBe(true);
        });
    });
    describe('Quality Scoring', () => {
        test('perfect score for clean output', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'This is a clean, helpful response.',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.quality).toBe(100);
        });
        test('degraded score for toxic content', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'You are stupid and worthless',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.quality).toBeLessThan(100);
        });
        test('severely degraded for PII leak', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Email: test@example.com',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.quality).toBeLessThan(70); // PII penalty is 30 points
        });
    });
    describe('Threshold Enforcement', () => {
        test('respects custom toxicity threshold', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'damn it', // Low toxicity
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 10, bias: 30 }, // Very strict
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.flagged).toBe(true); // Should flag due to low threshold
        });
        test('respects custom bias threshold', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'This involves gender considerations',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 5 }, // Very strict
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.flagged).toBe(true); // Should flag due to low threshold
        });
        test('uses default thresholds when not provided', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Clean output',
                latencyMs: 100,
                costUsd: 0.001,
                // No thresholds provided
            };
            const { result } = await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(result.flagged).toBe(false);
            expect(mockSet).toHaveBeenCalled();
        });
    });
    describe('Data Persistence', () => {
        test('stores evaluation data in Firestore', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-4o-mini',
                prompt: 'Test prompt',
                output: 'Test output',
                latencyMs: 500,
                costUsd: 0.002,
                thresholds: { toxicity: 50, bias: 30 },
            };
            await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(mockCollection).toHaveBeenCalledWith('ai_evals');
            expect(mockDoc).toHaveBeenCalledWith('gpt-4o-mini');
            expect(mockSet).toHaveBeenCalled();
            const setCall = mockSet.mock.calls[0][0];
            expect(setCall).toMatchObject({
                uid: 'user1',
                model: 'gpt-4o-mini',
                latencyMs: 500,
                costUsd: 0.002,
            });
            expect(setCall.promptHash).toBeDefined();
            expect(setCall.outputHash).toBeDefined();
        });
        test('creates audit log entry', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-test',
                prompt: 'Test',
                output: 'Clean output',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(mockCollection).toHaveBeenCalledWith('audit_logs');
            expect(mockAdd).toHaveBeenCalled();
            const auditCall = mockAdd.mock.calls[0][0];
            expect(auditCall).toMatchObject({
                actor: 'system',
                action: 'ai_eval.run',
            });
        });
        test('sanitizes model ID for Firestore path', async () => {
            const input = {
                uid: 'user1',
                model: 'gpt-4o-mini@2024', // Contains invalid chars
                prompt: 'Test',
                output: 'Clean output',
                latencyMs: 100,
                costUsd: 0.001,
                thresholds: { toxicity: 50, bias: 30 },
            };
            await (0, evaluator_1.evaluateAndPersist)(mockDb, input);
            expect(mockDoc).toHaveBeenCalledWith('gpt-4o-mini_2024'); // @ replaced with _
        });
    });
});
//# sourceMappingURL=evaluator.spec.js.map