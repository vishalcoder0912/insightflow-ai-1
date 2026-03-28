import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatApi, datasetApi } from "@/shared/services/api";
import type { ChatResponse, DatasetRecord } from "@/shared/types/dataset";

const { trackFeatureMock, runLocalDatasetQueryMock } = vi.hoisted(() => ({
  trackFeatureMock: vi.fn(),
  runLocalDatasetQueryMock: vi.fn(),
}));

vi.mock("@/analytics/tracker", () => ({
  analyticsTracker: {
    trackFeature: trackFeatureMock,
  },
}));

vi.mock("@/ai-engine/analystEngine", () => ({
  runLocalDatasetQuery: (...args: unknown[]) => runLocalDatasetQueryMock(...args),
}));

const dataset: DatasetRecord = {
  id: "current",
  fileName: "sample.csv",
  uploadedAt: "2026-03-25T00:00:00.000Z",
  headers: ["Category", "Value"],
  totalRows: 2,
  previewRows: [
    ["A", "10"],
    ["B", "20"],
  ],
  summary: {
    rowCount: 2,
    columnCount: 2,
    columns: [
      {
        name: "Category",
        filled: 2,
        unique: 2,
        sampleValues: ["A", "B"],
        numeric: false,
      },
      {
        name: "Value",
        filled: 2,
        unique: 2,
        sampleValues: ["10", "20"],
        numeric: true,
        min: 10,
        max: 20,
        average: 15,
        sum: 30,
      },
    ],
    kpis: [],
    insights: [],
    chartSuggestions: [],
  },
};

const apiResponse: ChatResponse = {
  answer: "Server answer",
  sql: "",
  insights: [],
  chart: null,
  source: "gemini",
  dataset: {
    fileName: dataset.fileName,
    totalRows: dataset.totalRows,
    headers: dataset.headers,
  },
};

const fallbackResponse: ChatResponse = {
  answer: "Local fallback",
  sql: "",
  insights: [],
  chart: null,
  source: "fallback",
  dataset: {
    fileName: dataset.fileName,
    totalRows: dataset.totalRows,
    headers: dataset.headers,
  },
};

describe("chatApi.send", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn() as typeof fetch;
    runLocalDatasetQueryMock.mockReturnValue(fallbackResponse);
  });

  it("returns the API response when the backend succeeds", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(apiResponse),
    } as unknown as Response);

    const result = await chatApi.send("show top categories", dataset, []);

    expect(result).toEqual(apiResponse);
    expect(runLocalDatasetQueryMock).not.toHaveBeenCalled();
    expect(trackFeatureMock).toHaveBeenCalledTimes(1);
  });

  it("uses the local fallback when the API cannot be reached", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await chatApi.send("show top categories", dataset, []);

    expect(result).toEqual(fallbackResponse);
    expect(runLocalDatasetQueryMock).toHaveBeenCalledWith("show top categories", dataset);
  });

  it("surfaces backend HTTP errors instead of masking them", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: "Backend exploded" }),
    } as unknown as Response);

    await expect(chatApi.send("show top categories", dataset, [])).rejects.toThrow("Backend exploded");
    expect(runLocalDatasetQueryMock).not.toHaveBeenCalled();
  });

  it("surfaces invalid API JSON instead of masking it", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token <")),
    } as unknown as Response);

    await expect(chatApi.send("show top categories", dataset, [])).rejects.toThrow("API returned invalid JSON.");
    expect(runLocalDatasetQueryMock).not.toHaveBeenCalled();
  });
});

describe("datasetApi.getCurrent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn() as typeof fetch;
  });

  it("preserves chart suggestions that use labels and datasets", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        id: "current",
        file_name: "trend.csv",
        uploaded_at: "2026-03-25T00:00:00.000Z",
        headers: ["month", "revenue"],
        total_rows: 3,
        preview_rows: [["Jan", "100"], ["Feb", "120"], ["Mar", "140"]],
        summary: {
          row_count: 3,
          column_count: 2,
          columns: [],
          kpis: [],
          insights: [],
          chart_suggestions: [
            {
              title: "Revenue Trend",
              chart_type: "line",
              x_key: "month",
              y_key: "revenue",
              labels: ["Jan", "Feb", "Mar"],
              datasets: [
                {
                  label: "Revenue",
                  data: [100, 120, 140],
                },
              ],
              config: {
                palette: "cyan",
                curved: true,
              },
            },
          ],
        },
      }),
    } as unknown as Response);

    const result = await datasetApi.getCurrent();

    expect(result?.summary.chartSuggestions).toEqual([
      {
        title: "Revenue Trend",
        type: "line",
        xKey: "month",
        dataKey: "revenue",
        data: [],
        labels: ["Jan", "Feb", "Mar"],
        datasets: [
          {
            label: "Revenue",
            data: [100, 120, 140],
          },
        ],
        config: {
          palette: "cyan",
          curved: true,
        },
      },
    ]);
  });
});
