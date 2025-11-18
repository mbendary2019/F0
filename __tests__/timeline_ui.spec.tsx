/**
 * Timeline UI Tests (Phase 62 Day 2)
 *
 * Tests for timeline UI components
 */

import { render, screen } from "@testing-library/react";
import { SeverityBadge } from "@/components/timeline/SeverityBadge";
import { TimelineItem } from "@/components/timeline/TimelineItem";

describe("Timeline UI Components", () => {
  describe("SeverityBadge", () => {
    it("should render info badge", () => {
      const { getByText } = render(<SeverityBadge level="info" />);
      expect(getByText(/info/i)).toBeTruthy();
    });

    it("should render warn badge", () => {
      const { getByText } = render(<SeverityBadge level="warn" />);
      expect(getByText(/warn/i)).toBeTruthy();
    });

    it("should render error badge", () => {
      const { getByText } = render(<SeverityBadge level="error" />);
      expect(getByText(/error/i)).toBeTruthy();
    });

    it("should default to info when no level provided", () => {
      const { getByText } = render(<SeverityBadge />);
      expect(getByText(/info/i)).toBeTruthy();
    });
  });

  describe("TimelineItem", () => {
    const mockItem = {
      id: "test-1",
      sessionId: "sess_123",
      ts: Date.now(),
      label: "Test Event",
      type: "test.event",
      severity: "info" as const,
      meta: {
        model: "test-model",
        score: 0.85,
      },
    };

    it("should render timeline item with label", () => {
      const { getByText } = render(<TimelineItem item={mockItem} />);
      expect(getByText("Test Event")).toBeTruthy();
    });

    it("should render event type", () => {
      const { getByText } = render(<TimelineItem item={mockItem} />);
      expect(getByText(/test.event/i)).toBeTruthy();
    });

    it("should render session ID", () => {
      const { getByText } = render(<TimelineItem item={mockItem} />);
      expect(getByText(/sess_123/i)).toBeTruthy();
    });

    it("should render model from meta", () => {
      const { getByText } = render(<TimelineItem item={mockItem} />);
      expect(getByText("test-model")).toBeTruthy();
    });

    it("should render score from meta", () => {
      const { getByText } = render(<TimelineItem item={mockItem} />);
      expect(getByText("0.85")).toBeTruthy();
    });

    it("should render Open button when onOpenSession provided", () => {
      const { getByText } = render(
        <TimelineItem item={mockItem} onOpenSession={() => {}} />
      );
      expect(getByText("Open")).toBeTruthy();
    });

    it("should not render Open button when onOpenSession not provided", () => {
      const { queryByText } = render(<TimelineItem item={mockItem} />);
      expect(queryByText("Open")).toBeFalsy();
    });

    it("should call onOpenSession when Open clicked", () => {
      const mockOpen = jest.fn();
      const { getByText } = render(
        <TimelineItem item={mockItem} onOpenSession={mockOpen} />
      );

      const button = getByText("Open");
      button.click();

      expect(mockOpen).toHaveBeenCalledWith("sess_123");
    });
  });
});
