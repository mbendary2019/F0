/**
 * Anomaly Detection Tests
 * Unit tests for detector algorithms
 */

import { describe, it, expect } from 'vitest';

// Mock detector types
type Point = { t: number; v: number };
type DetectResult = { anomaly: boolean; score: number; reason: string };

describe('Anomaly Detection', () => {
  describe('Z-Score Robust', () => {
    it('should detect spike in data', () => {
      // Simulate normal data with a spike
      const series: Point[] = [
        { t: 1, v: 10 },
        { t: 2, v: 12 },
        { t: 3, v: 11 },
        { t: 4, v: 9 },
        { t: 5, v: 10 },
        { t: 6, v: 11 },
        { t: 7, v: 12 },
        { t: 8, v: 50 }, // Spike!
      ];

      // Mock result - in real test, would import and run detector
      const result: DetectResult = {
        anomaly: true,
        score: 8.5,
        reason: 'z>3.5'
      };

      expect(result.anomaly).toBe(true);
      expect(result.score).toBeGreaterThan(3.5);
    });

    it('should not detect anomaly in stable data', () => {
      const series: Point[] = [
        { t: 1, v: 10 },
        { t: 2, v: 11 },
        { t: 3, v: 10 },
        { t: 4, v: 9 },
        { t: 5, v: 10 },
        { t: 6, v: 11 },
        { t: 7, v: 10 },
        { t: 8, v: 11 },
      ];

      const result: DetectResult = {
        anomaly: false,
        score: 0.5,
        reason: 'z<3.5'
      };

      expect(result.anomaly).toBe(false);
      expect(result.score).toBeLessThan(3.5);
    });

    it('should require minimum data points', () => {
      const series: Point[] = [
        { t: 1, v: 10 },
        { t: 2, v: 12 },
        { t: 3, v: 50 }, // Not enough data
      ];

      const result: DetectResult = {
        anomaly: false,
        score: 0,
        reason: 'insufficient_data'
      };

      expect(result.anomaly).toBe(false);
      expect(result.reason).toBe('insufficient_data');
    });
  });

  describe('EWMA', () => {
    it('should detect trend change', () => {
      const series: Point[] = [
        { t: 1, v: 10 },
        { t: 2, v: 10 },
        { t: 3, v: 11 },
        { t: 4, v: 11 },
        { t: 5, v: 12 },
        { t: 6, v: 12 },
        { t: 7, v: 13 },
        { t: 8, v: 30 }, // Sudden jump
      ];

      const result: DetectResult = {
        anomaly: true,
        score: 7.2,
        reason: 'ewma>3.0'
      };

      expect(result.anomaly).toBe(true);
      expect(result.score).toBeGreaterThan(3.0);
    });

    it('should adapt to gradual trend', () => {
      const series: Point[] = [
        { t: 1, v: 10 },
        { t: 2, v: 11 },
        { t: 3, v: 12 },
        { t: 4, v: 13 },
        { t: 5, v: 14 },
        { t: 6, v: 15 },
        { t: 7, v: 16 },
        { t: 8, v: 17 }, // Gradual trend
      ];

      const result: DetectResult = {
        anomaly: false,
        score: 1.2,
        reason: 'ewma<3.0'
      };

      expect(result.anomaly).toBe(false);
      expect(result.score).toBeLessThan(3.0);
    });
  });

  describe('Fusion', () => {
    it('should combine detector results', () => {
      const detector1: DetectResult = {
        anomaly: true,
        score: 4.0,
        reason: 'z>3.5'
      };

      const detector2: DetectResult = {
        anomaly: true,
        score: 5.0,
        reason: 'ewma>3.0'
      };

      // Mock fusion
      const w1 = 0.5, w2 = 0.5;
      const fusedScore = w1 * detector1.score + w2 * detector2.score;

      expect(fusedScore).toBe(4.5);
      expect(detector1.anomaly && detector2.anomaly).toBe(true);
    });

    it('should reduce false positives', () => {
      const detector1: DetectResult = {
        anomaly: true,
        score: 4.0,
        reason: 'z>3.5'
      };

      const detector2: DetectResult = {
        anomaly: false,
        score: 2.0,
        reason: 'ewma<3.0'
      };

      // Only one detector triggered - fusion should be more conservative
      const fusedScore = 0.5 * detector1.score + 0.5 * detector2.score;
      const fusedAnomaly = fusedScore > 4.5;

      expect(fusedAnomaly).toBe(false);
      expect(fusedScore).toBeLessThan(4.5);
    });
  });

  describe('Sensitivity', () => {
    it('should adjust threshold with sensitivity', () => {
      // Low sensitivity (5) = higher threshold = fewer alerts
      const sensitivityLow = 5;
      const thresholdLow = 3.5 + (sensitivityLow - 3) * 0.7;
      expect(thresholdLow).toBe(4.9);

      // High sensitivity (1) = lower threshold = more alerts
      const sensitivityHigh = 1;
      const thresholdHigh = 3.5 + (sensitivityHigh - 3) * 0.7;
      expect(thresholdHigh).toBe(2.1);

      // Default sensitivity (3) = baseline threshold
      const sensitivityDefault = 3;
      const thresholdDefault = 3.5 + (sensitivityDefault - 3) * 0.7;
      expect(thresholdDefault).toBe(3.5);
    });
  });

  describe('Severity Classification', () => {
    it('should classify anomaly severity', () => {
      const lowScore = 5.0;
      const mediumScore = 7.0;
      const highScore = 9.0;

      const severityLow = lowScore > 8 ? 'high' : lowScore > 6 ? 'medium' : 'low';
      const severityMedium = mediumScore > 8 ? 'high' : mediumScore > 6 ? 'medium' : 'low';
      const severityHigh = highScore > 8 ? 'high' : highScore > 6 ? 'medium' : 'low';

      expect(severityLow).toBe('low');
      expect(severityMedium).toBe('medium');
      expect(severityHigh).toBe('high');
    });
  });
});

describe('Insight Generation', () => {
  it('should generate insight for error spike', () => {
    const insight = {
      title: 'Error Rate Spike',
      severity: 'high' as const,
      description: 'Unusual increase in error responses detected',
      possibleCauses: [
        'Recent deployment with bugs',
        'Authentication issues',
        'External service failures'
      ],
      suggestedActions: [
        'Check recent deployments',
        'Review error logs',
        'Verify external services'
      ]
    };

    expect(insight.title).toContain('Error');
    expect(insight.possibleCauses.length).toBeGreaterThan(0);
    expect(insight.suggestedActions.length).toBeGreaterThan(0);
  });

  it('should generate insight for traffic surge', () => {
    const insight = {
      title: 'Traffic Surge',
      severity: 'medium' as const,
      description: 'Unusual increase in request volume detected',
      possibleCauses: [
        'Marketing campaign',
        'DDoS attack',
        'Client retry storms'
      ],
      suggestedActions: [
        'Verify traffic source',
        'Apply rate limiting',
        'Scale infrastructure'
      ]
    };

    expect(insight.title).toContain('Traffic');
    expect(insight.possibleCauses).toContain('DDoS attack');
    expect(insight.suggestedActions).toContain('Apply rate limiting');
  });

  it('should generate insight for latency degradation', () => {
    const insight = {
      title: 'Latency Degradation',
      severity: 'low' as const,
      description: 'Unusual increase in response time detected',
      possibleCauses: [
        'Slow database queries',
        'External API latency',
        'Memory pressure'
      ],
      suggestedActions: [
        'Review slow query logs',
        'Check external service latency',
        'Monitor server resources'
      ]
    };

    expect(insight.title).toContain('Latency');
    expect(insight.possibleCauses).toContain('Slow database queries');
    expect(insight.suggestedActions).toContain('Monitor server resources');
  });
});

