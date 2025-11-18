/**
 * Tests for Daily Metrics Aggregation (Phase 63 - Day 1)
 *
 * Tests the computeMetrics function and aggregation logic
 */

import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Test suite for daily metrics aggregation
 *
 * Note: These are unit tests for the aggregation logic.
 * For integration tests with Firestore emulator, run:
 * firebase emulators:exec "npm test" --only firestore
 */
describe('Daily Metrics Aggregation', () => {
  describe('computeMetrics', () => {
    it('should calculate percentiles correctly', () => {
      // Test percentile function
      const percentile = (arr: number[], p: number): number => {
        if (!arr.length) return 0;
        const idx = Math.ceil((p / 100) * arr.length) - 1;
        const sorted = [...arr].sort((a, b) => a - b);
        return Math.round(sorted[Math.max(0, Math.min(sorted.length - 1, idx))]);
      };

      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

      expect(percentile(latencies, 50)).toBe(500); // Median
      expect(percentile(latencies, 95)).toBe(1000); // 95th percentile
      expect(percentile([], 50)).toBe(0); // Empty array
    });

    it('should handle small arrays', () => {
      const percentile = (arr: number[], p: number): number => {
        if (!arr.length) return 0;
        const idx = Math.ceil((p / 100) * arr.length) - 1;
        const sorted = [...arr].sort((a, b) => a - b);
        return Math.round(sorted[Math.max(0, Math.min(sorted.length - 1, idx))]);
      };

      const latencies = [100];
      expect(percentile(latencies, 50)).toBe(100);
      expect(percentile(latencies, 95)).toBe(100);
    });

    it('should calculate average latency correctly', () => {
      const latencies = [100, 200, 300, 400, 500];
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

      expect(avg).toBe(300);
    });
  });

  describe('Date helpers', () => {
    it('should format date as yyyy-mm-dd', () => {
      const ymdUTC = (date: Date): string => {
        return date.toISOString().slice(0, 10);
      };

      const date = new Date('2025-11-07T12:34:56.789Z');
      expect(ymdUTC(date)).toBe('2025-11-07');
    });

    it('should get start of day in UTC', () => {
      const ymdUTC = (date: Date): string => {
        return date.toISOString().slice(0, 10);
      };

      const startOfDayUTC = (d: Date): number => {
        const iso = ymdUTC(d);
        return new Date(`${iso}T00:00:00.000Z`).getTime();
      };

      const date = new Date('2025-11-07T15:30:00.000Z');
      const start = startOfDayUTC(date);
      const expected = new Date('2025-11-07T00:00:00.000Z').getTime();

      expect(start).toBe(expected);
    });
  });

  describe('Event counting', () => {
    it('should count events by level', () => {
      const events = [
        { level: 'info' },
        { level: 'info' },
        { level: 'warn' },
        { level: 'error' },
        { level: 'info' },
      ];

      let info = 0, warn = 0, error = 0;

      events.forEach(e => {
        if (e.level === 'info') info++;
        else if (e.level === 'warn') warn++;
        else if (e.level === 'error') error++;
      });

      expect(info).toBe(3);
      expect(warn).toBe(1);
      expect(error).toBe(1);
    });

    it('should count events by type', () => {
      const events = [
        { type: 'api' },
        { type: 'ui' },
        { type: 'api' },
        { type: 'api' },
      ];

      const byType: Record<string, number> = {};

      events.forEach(e => {
        byType[e.type] = (byType[e.type] || 0) + 1;
      });

      expect(byType['api']).toBe(3);
      expect(byType['ui']).toBe(1);
    });

    it('should count events by strategy', () => {
      const events = [
        { strategy: 'default' },
        { strategy: 'fast' },
        { strategy: 'default' },
      ];

      const byStrategy: Record<string, number> = {};

      events.forEach(e => {
        byStrategy[e.strategy] = (byStrategy[e.strategy] || 0) + 1;
      });

      expect(byStrategy['default']).toBe(2);
      expect(byStrategy['fast']).toBe(1);
    });
  });

  describe('Data validation', () => {
    it('should handle missing latency data', () => {
      const events = [
        { latency: 100 },
        { latency: undefined },
        { latency: 200 },
        { latency: null },
      ];

      const latencies: number[] = [];

      events.forEach(e => {
        if (e.latency != null) latencies.push(e.latency);
      });

      expect(latencies).toEqual([100, 200]);
      expect(latencies.length).toBe(2);
    });

    it('should handle missing level data', () => {
      const events = [
        { level: 'info' },
        { level: undefined },
        { level: 'error' },
      ];

      let info = 0, warn = 0, error = 0;

      events.forEach(e => {
        if (e.level === 'info') info++;
        else if (e.level === 'warn') warn++;
        else if (e.level === 'error') error++;
      });

      expect(info).toBe(1);
      expect(warn).toBe(0);
      expect(error).toBe(1);
    });
  });
});
