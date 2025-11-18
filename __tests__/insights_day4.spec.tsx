import { render, screen } from "@testing-library/react";
import InsightsPanel from "@/features/ops/analytics/InsightsPanel";

// Mock Firebase
jest.mock("@/lib/firebaseClient", () => ({
  app: {},
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
}));

describe("InsightsPanel", () => {
  it("renders title in EN", () => {
    render(<InsightsPanel locale="en" />);
    expect(screen.getByText(/AI Trend Insight/i)).toBeInTheDocument();
  });

  it("renders title in AR", () => {
    render(<InsightsPanel locale="ar" />);
    expect(screen.getByText(/ملخص ذكي/i)).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<InsightsPanel locale="en" />);
    expect(screen.getByText(/جاري التحميل/i)).toBeInTheDocument();
  });

  it("renders robot emoji", () => {
    render(<InsightsPanel locale="en" />);
    expect(screen.getByText("🤖")).toBeInTheDocument();
  });
});
