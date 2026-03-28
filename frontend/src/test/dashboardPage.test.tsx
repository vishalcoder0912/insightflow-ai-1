import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";

vi.mock("@/shared/data/DataContext", () => ({
  useDataset: () => ({
    dataset: {
      fileName: "sales.csv",
      headers: ["Region", "Sales"],
      totalRows: 1200,
      previewRows: [
        ["North", "120"],
        ["South", "240"],
        ["West", "180"],
      ],
      summary: {
        rowCount: 1200,
        columnCount: 2,
        columns: [
          { name: "Region", detectedType: "categorical", numeric: false },
          { name: "Sales", detectedType: "numeric", numeric: true },
        ],
        kpis: [{ label: "Total Rows", value: "1,200", helperText: "Rows in dataset" }],
        insights: ["Sales data detected."],
        chartSuggestions: [],
      },
    },
    loading: false,
  }),
}));

describe("DashboardPage", () => {
  it("renders the shared five-chart dashboard for analyzed datasets", async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardPage />
      </Suspense>,
    );

    expect(screen.getByText("sales.csv")).toBeInTheDocument();
    expect(screen.getByText("Bar Chart")).toBeInTheDocument();
    expect(screen.getByText("Line Chart")).toBeInTheDocument();
    expect(screen.getByText("Pie Chart")).toBeInTheDocument();
    expect(screen.getByText("Area Chart")).toBeInTheDocument();
    expect(await screen.findByText("Scatter Chart")).toBeInTheDocument();
  });
});
