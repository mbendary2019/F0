/**
 * Timeline Day 4 Tests
 *
 * Tests for Phase 62 Day 4 enhancements:
 * - Session export utilities
 * - Trend visualization
 * - Copy JSON functionality
 * - Keyboard shortcuts
 */

import { render, fireEvent, waitFor } from "@testing-library/react";
import { buildSessionExport, exportSessionAsJson, exportSessionAsCsv } from "@/utils/exportSession";
import { bindHotkeys, formatHotkey } from "@/lib/hotkeys";
import TrendMini from "@/components/timeline/TrendMini";
import { CopyJson } from "@/components/timeline/CopyJson";

describe("Timeline Day 4 - Export Utilities", () => {
  describe("buildSessionExport", () => {
    it("should pack session fields correctly", () => {
      const session = {
        sessionId: "sess_123",
        events: [{ id: "evt_1", type: "test" }],
        stats: { count: 3 },
        userId: "user_456",
      };

      const result = buildSessionExport(session);

      expect(result.sessionId).toBe("sess_123");
      expect(result.exportedAt).toBeTruthy();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBe(1);
      expect(result.stats).toEqual({ count: 3 });
      expect(result.metadata?.userId).toBe("user_456");
    });

    it("should handle empty events array", () => {
      const session = {
        sessionId: "sess_empty",
        events: [],
      };

      const result = buildSessionExport(session);

      expect(result.events).toEqual([]);
      expect(result.stats).toEqual({});
    });

    it("should include timestamp in ISO format", () => {
      const session = {
        sessionId: "sess_time",
        events: [],
      };

      const result = buildSessionExport(session);

      expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

describe("Timeline Day 4 - Keyboard Shortcuts", () => {
  describe("bindHotkeys", () => {
    it("should bind a simple key", () => {
      const handler = jest.fn();
      const unbind = bindHotkeys({
        escape: handler,
      });

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      unbind();
    });

    it("should bind modifier + key", () => {
      const handler = jest.fn();
      const unbind = bindHotkeys({
        "mod+k": handler,
      });

      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
      });
      window.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
      unbind();
    });

    it("should cleanup handlers on unbind", () => {
      const handler = jest.fn();
      const unbind = bindHotkeys({
        escape: handler,
      });

      unbind();

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("formatHotkey", () => {
    it("should format mod key", () => {
      const formatted = formatHotkey("mod+k");
      expect(formatted).toMatch(/[⌘Ctrl]/);
    });

    it("should format escape key", () => {
      const formatted = formatHotkey("escape");
      expect(formatted).toBe("Esc");
    });

    it("should format simple key", () => {
      const formatted = formatHotkey("k");
      expect(formatted).toBe("K");
    });
  });
});

describe("Timeline Day 4 - Components", () => {
  describe("TrendMini", () => {
    it("should render chart with data", () => {
      const items = [
        { ts: Date.now(), type: "rag.validate" },
        { ts: Date.now() - 1000, type: "rag.retrieve" },
      ];

      const { container } = render(<TrendMini items={items} />);

      // Should render SVG chart (recharts)
      expect(container.querySelector("svg")).toBeTruthy();
    });

    it("should show 'No data' when empty", () => {
      const { getByText } = render(<TrendMini items={[]} />);
      expect(getByText(/No data/i)).toBeTruthy();
    });

    it("should display total count", () => {
      const items = [
        { ts: Date.now(), type: "test" },
        { ts: Date.now(), type: "test" },
      ];

      const { getByText } = render(<TrendMini items={items} />);
      expect(getByText(/2 total/i)).toBeTruthy();
    });
  });

  describe("CopyJson", () => {
    // Mock clipboard API
    beforeAll(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(() => Promise.resolve()),
        },
      });
    });

    it("should render copy button", () => {
      const { getByText } = render(<CopyJson value={{ test: "data" }} />);
      expect(getByText(/Copy JSON/i)).toBeTruthy();
    });

    it("should copy JSON to clipboard on click", async () => {
      const value = { test: "data", nested: { key: "value" } };
      const { getByText } = render(<CopyJson value={value} />);

      const button = getByText(/Copy JSON/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          JSON.stringify(value, null, 2)
        );
      });
    });

    it("should show 'Copied!' feedback", async () => {
      const { getByText } = render(<CopyJson value={{ test: true }} />);

      const button = getByText(/Copy JSON/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(getByText(/Copied!/i)).toBeTruthy();
      });
    });
  });
});

describe("Timeline Day 4 - Integration", () => {
  it("should handle trend data with different bucket sizes", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      ts: Date.now() - i * 60 * 1000, // 1 minute apart
      type: "test",
    }));

    const { container: container60 } = render(
      <TrendMini items={items} bucketMinutes={60} />
    );
    const { container: container5 } = render(
      <TrendMini items={items} bucketMinutes={5} />
    );

    expect(container60.querySelector("svg")).toBeTruthy();
    expect(container5.querySelector("svg")).toBeTruthy();
  });

  it("should export empty session without errors", () => {
    const session = {
      sessionId: "empty",
      events: [],
    };

    expect(() => buildSessionExport(session)).not.toThrow();
  });
});
