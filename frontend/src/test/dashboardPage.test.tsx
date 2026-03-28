import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

vi.mock("@/shared/data/DataContext", () => ({
  useDataset: () => ({
    dataset: {
      fileName: "sales.csv",
      summary: {
        rowCount: 1200,
        columnCount: 6,
        domain: {
          key: "sales",
          label: "Sales",
          confidence: 0.92,
          matchedColumns: ["Order Date", "Region", "Sales"],
          description: "This dataset looks like commercial transaction data.",
        },
        columns: [
          { name: "Order Date", detectedType: "date" },
          { name: "Region", detectedType: "categorical" },
          { name: "Sales", detectedType: "numeric" },
        ],
        kpis: [
          { label: "Total Rows", value: "1,200", helperText: "Rows in dataset" },
        ],
        insights: ["Sales data detected."],
        chartSuggestions: [
          {
            title: "Sales Over Time",
            type: "area",
            dataKey: "value",
            data: [{ name: "2024-01", value: 120 }],
          },
          {
            title: "Sales by Region",
            type: "bar",
            dataKey: "value",
            data: [{ name: "North", value: 85 }],
          },
        ],
      },
    },
    parsed: {
      headers: ["Order Date", "Region", "Sales"],
      rows: [["2024-01-01", "North", "120"]],
      totalRows: 1200,
    },
    patterns: [],
    predictionChart: null,
    predictionData: [],
    fileName: "sales.csv",
  }),
}));

vi.mock("@/features/dashboard/components/charts/ChartPanel", () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/dashboard/components/DashboardChatPanel", () => ({
  default: () => <div>Chat Panel</div>,
}));

describe("DashboardPage", () => {
  it("renders generated chart titles for analyzed datasets", async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardPage />
      </Suspense>,
    );

    expect(screen.getByText("Detected Dataset Type")).toBeInTheDocument();
    expect(screen.getByText("Sales Data")).toBeInTheDocument();
    expect(screen.getByText("Generated Charts")).toBeInTheDocument();
    expect(await screen.findByText("Sales Over Time")).toBeInTheDocument();
    expect(await screen.findByText("Sales by Region")).toBeInTheDocument();
  });
});
