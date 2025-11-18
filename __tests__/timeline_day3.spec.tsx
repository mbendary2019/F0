/**
 * Timeline Day 3 Tests
 *
 * Tests for Phase 62 Day 3 enhancements:
 * - CSV export utility
 * - Skeleton loading states
 * - Empty state components
 * - Error state components
 * - Stats calculations
 */

import { render } from "@testing-library/react";
import { toCSV } from "@/utils/csv";
import SkeletonRow from "@/components/timeline/SkeletonRow";
import { EmptyState } from "@/components/timeline/EmptyState";
import { ErrorState } from "@/components/timeline/ErrorState";
import { StatsStrip } from "@/components/timeline/StatsStrip";

describe("Timeline Day 3 - Utilities", () => {
  describe("CSV Export", () => {
    it("should export empty array as empty string", () => {
      const csv = toCSV([]);
      expect(csv).toBe("");
    });

    it("should build header row from object keys", () => {
      const csv = toCSV([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
      const lines = csv.split("\n");
      expect(lines[0]).toMatch(/a/);
      expect(lines[0]).toMatch(/b/);
      expect(lines[0]).toMatch(/c/);
    });

    it("should handle quoted values with commas", () => {
      const csv = toCSV([{ name: "Smith, John", age: 30 }]);
      expect(csv).toContain('"Smith, John"');
    });

    it("should escape quotes by doubling them", () => {
      const csv = toCSV([{ text: 'He said "hello"' }]);
      expect(csv).toContain('He said ""hello""');
    });

    it("should handle null/undefined values", () => {
      const csv = toCSV([{ a: null, b: undefined, c: "test" }]);
      const lines = csv.split("\n");
      expect(lines[1]).toMatch(/,,test/);
    });

    it("should use custom separator", () => {
      const csv = toCSV([{ a: 1, b: 2 }], { sep: ";" });
      expect(csv).toContain("a;b");
    });
  });
});

describe("Timeline Day 3 - Components", () => {
  describe("SkeletonRow", () => {
    it("should render with animate-pulse class", () => {
      const { container } = render(<SkeletonRow />);
      expect(container.querySelector(".animate-pulse")).toBeTruthy();
    });

    it("should have loading placeholder bars", () => {
      const { container } = render(<SkeletonRow />);
      const bars = container.querySelectorAll(".bg-white\\/20, .bg-white\\/10");
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe("EmptyState", () => {
    it("should render 'No events yet' message", () => {
      const { getByText } = render(<EmptyState />);
      expect(getByText(/No events yet/i)).toBeTruthy();
    });

    it("should show helpful hint about filters", () => {
      const { getByText } = render(<EmptyState />);
      expect(getByText(/filters/i)).toBeTruthy();
    });
  });

  describe("ErrorState", () => {
    it("should render default error message", () => {
      const { getByText } = render(<ErrorState />);
      expect(getByText(/Something went wrong/i)).toBeTruthy();
    });

    it("should render custom error message", () => {
      const { getByText } = render(<ErrorState message="Network timeout" />);
      expect(getByText(/Network timeout/i)).toBeTruthy();
    });

    it("should show retry button when callback provided", () => {
      const mockRetry = jest.fn();
      const { getByText } = render(<ErrorState onRetry={mockRetry} />);
      const retryButton = getByText(/Retry/i);
      expect(retryButton).toBeTruthy();
    });

    it("should not show retry button when no callback", () => {
      const { queryByText } = render(<ErrorState />);
      expect(queryByText(/Retry/i)).toBeNull();
    });
  });

  describe("StatsStrip", () => {
    it("should display total event count", () => {
      const items = [
        { id: "1", severity: "info" },
        { id: "2", severity: "warn" },
      ];
      const { getByText } = render(<StatsStrip items={items} />);
      expect(getByText("2")).toBeTruthy();
    });

    it("should count validation events", () => {
      const items = [
        { id: "1", type: "rag.validate", meta: { score: 0.8 } },
        { id: "2", type: "rag.retrieve" },
        { id: "3", type: "rag.validate", meta: { score: 0.9 } },
      ];
      const { getByText } = render(<StatsStrip items={items} />);
      // Should show 2 validations
      const statsText = getByText("2");
      expect(statsText).toBeTruthy();
    });

    it("should calculate average validation score", () => {
      const items = [
        { id: "1", type: "rag.validate", meta: { score: 0.6 } },
        { id: "2", type: "rag.validate", meta: { score: 0.8 } },
      ];
      const { getByText } = render(<StatsStrip items={items} />);
      // Average: (0.6 + 0.8) / 2 = 0.7
      expect(getByText("0.70")).toBeTruthy();
    });

    it("should show em dash for no validations", () => {
      const items = [{ id: "1", type: "rag.retrieve", severity: "info" }];
      const { getByText } = render(<StatsStrip items={items} />);
      expect(getByText("—")).toBeTruthy();
    });

    it("should count events by severity", () => {
      const items = [
        { id: "1", severity: "error" },
        { id: "2", severity: "error" },
        { id: "3", severity: "warn" },
        { id: "4", severity: "info" },
      ];
      const { container } = render(<StatsStrip items={items} />);
      // Check that severity breakdown section exists
      const severitySection = container.querySelector("div:has(.text-rose-400)");
      expect(severitySection).toBeTruthy();
    });
  });
});

describe("Timeline Day 3 - Integration", () => {
  it("should handle empty timeline gracefully", () => {
    const { container } = render(<StatsStrip items={[]} />);
    expect(container).toBeTruthy();
  });

  it("should work with minimal item data", () => {
    const items = [{ id: "1" } as any];
    const { container } = render(<StatsStrip items={items} />);
    expect(container).toBeTruthy();
  });
});
