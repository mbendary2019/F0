/**
 * Phase 63 Day 2: Analytics Dashboard Tests
 * Smoke tests for UI components and basic functionality
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AnalyticsPage from "@/features/ops/analytics/AnalyticsPage";
import KpiCards from "@/components/analytics/KpiCards";
import RangeSelector from "@/components/analytics/RangeSelector";

// Mock Firebase
vi.mock("@/lib/firebase", () => ({
  app: {},
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(() => Promise.resolve("mock-token")),
    },
  })),
}));

describe("Analytics Dashboard", () => {
  describe("AnalyticsPage", () => {
    it("renders title and subtitle", () => {
      render(<AnalyticsPage locale="en" />);
      expect(screen.getByText(/Ops Analytics Dashboard/i)).toBeTruthy();
      expect(screen.getByText(/Performance and error metrics/i)).toBeTruthy();
    });

    it("renders with Arabic locale", () => {
      render(<AnalyticsPage locale="ar" />);
      expect(screen.getByText(/لوحة تحليلات العمليات/)).toBeTruthy();
    });

    it("renders range selector", () => {
      render(<AnalyticsPage locale="en" />);
      expect(screen.getByText(/7 days/i)).toBeTruthy();
      expect(screen.getByText(/30 days/i)).toBeTruthy();
      expect(screen.getByText(/90 days/i)).toBeTruthy();
    });
  });

  describe("KpiCards", () => {
    it("renders all KPI cards", () => {
      render(
        <KpiCards
          locale="en"
          totals={1523}
          errorRate={4.8}
          avgLatency={156}
          loading={false}
        />
      );
      expect(screen.getByText(/Total Events/i)).toBeTruthy();
      expect(screen.getByText(/Error Rate/i)).toBeTruthy();
      expect(screen.getByText(/Avg Latency/i)).toBeTruthy();
    });

    it("displays values correctly", () => {
      render(
        <KpiCards
          locale="en"
          totals={1523}
          errorRate={4.8}
          avgLatency={156}
          loading={false}
        />
      );
      expect(screen.getByText("1,523")).toBeTruthy();
      expect(screen.getByText("4.8%")).toBeTruthy();
      expect(screen.getByText(/156/)).toBeTruthy();
    });

    it("shows loading state", () => {
      render(
        <KpiCards
          locale="en"
          totals={0}
          errorRate={0}
          avgLatency={0}
          loading={true}
        />
      );
      const loadingIndicators = screen.getAllByText("…");
      expect(loadingIndicators.length).toBeGreaterThan(0);
    });

    it("renders with Arabic locale", () => {
      render(
        <KpiCards
          locale="ar"
          totals={1523}
          errorRate={4.8}
          avgLatency={156}
          loading={false}
        />
      );
      expect(screen.getByText(/إجمالي الأحداث/)).toBeTruthy();
      expect(screen.getByText(/نسبة الأخطاء/)).toBeTruthy();
    });
  });

  describe("RangeSelector", () => {
    it("renders all range options", () => {
      const onChange = vi.fn();
      render(<RangeSelector locale="en" value={7} onChange={onChange} />);
      expect(screen.getByText(/7 days/i)).toBeTruthy();
      expect(screen.getByText(/30 days/i)).toBeTruthy();
      expect(screen.getByText(/90 days/i)).toBeTruthy();
    });

    it("highlights selected range", () => {
      const onChange = vi.fn();
      const { container } = render(
        <RangeSelector locale="en" value={30} onChange={onChange} />
      );
      const buttons = container.querySelectorAll("button");
      const button30 = Array.from(buttons).find((btn) =>
        btn.textContent?.includes("30 days")
      );
      expect(button30?.className).toContain("bg-gray-100");
    });

    it("calls onChange when clicked", async () => {
      const onChange = vi.fn();
      render(<RangeSelector locale="en" value={7} onChange={onChange} />);
      const button30 = screen.getByText(/30 days/i);
      button30.click();
      expect(onChange).toHaveBeenCalledWith(30);
    });

    it("renders with Arabic locale", () => {
      const onChange = vi.fn();
      render(<RangeSelector locale="ar" value={7} onChange={onChange} />);
      expect(screen.getByText(/7 أيام/)).toBeTruthy();
      expect(screen.getByText(/30 يوم/)).toBeTruthy();
      expect(screen.getByText(/90 يوم/)).toBeTruthy();
    });
  });
});
