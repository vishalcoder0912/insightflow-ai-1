import type { ChatResponse, DatasetChart, DatasetRecord } from "@/shared/types/dataset";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asStringArray = (value: unknown): string[] => asArray(value).map((item) => String(item));

const asStringMatrix = (value: unknown): string[][] =>
  asArray(value).map((row) => asArray(row).map((cell) => String(cell)));

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const normalizeChart = (chart: unknown): DatasetChart | null => {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  const candidate = chart as Partial<DatasetChart> & {
    data?: Array<Record<string, unknown>>;
    chartType?: DatasetChart["type"];
  };

  const data = Array.isArray(candidate.data)
    ? candidate.data
        .map((point, index) => {
          const rawLabel = point.name ?? point.label ?? point.x ?? `Item ${index + 1}`;
          const rawValue = typeof point.value === "number" ? point.value : Number(point.value);

          if (!Number.isFinite(rawValue)) {
            return null;
          }

          return {
            ...point,
            name: String(rawLabel),
            value: rawValue,
            x: String(point.x ?? rawLabel),
            label: String(point.label ?? rawLabel),
          };
        })
        .filter((point): point is NonNullable<typeof point> => Boolean(point))
    : [];

  if (!data.length) {
    return null;
  }

  return {
    title: candidate.title || "Chart",
    type: candidate.type || candidate.chartType || "bar",
    xKey: candidate.xKey || "name",
    dataKey: candidate.dataKey || "value",
    data,
  };
};

const normalizeDatasetRecord = (value: unknown): DatasetRecord | null => {
  if (!value) {
    return null;
  }

  const record = asRecord(value);
  const summary = asRecord(record.summary);
  const headers = asStringArray(record.headers);
  const previewRows = asStringMatrix(record.previewRows);
  const totalRows = asNumber(record.totalRows, previewRows.length);

  return {
    id: asString(record.id, "current"),
    fileName: asString(record.fileName, "dataset.csv"),
    uploadedAt: asString(record.uploadedAt, new Date().toISOString()),
    headers,
    totalRows,
    previewRows,
    summary: {
      rowCount: asNumber(summary.rowCount, totalRows),
      columnCount: asNumber(summary.columnCount, headers.length),
      columns: asArray(summary.columns).map((columnRaw) => {
        const column = asRecord(columnRaw);
        return {
          name: asString(column.name),
          filled: asNumber(column.filled),
          unique: asNumber(column.unique),
          sampleValues: asStringArray(column.sampleValues),
          numeric: Boolean(column.numeric),
          detectedType: asString(column.detectedType) || undefined,
          min: Number.isFinite(Number(column.min)) ? Number(column.min) : undefined,
          max: Number.isFinite(Number(column.max)) ? Number(column.max) : undefined,
          average: Number.isFinite(Number(column.average)) ? Number(column.average) : undefined,
          sum: Number.isFinite(Number(column.sum)) ? Number(column.sum) : undefined,
        };
      }),
      kpis: asArray(summary.kpis).map((kpiRaw) => {
        const kpi = asRecord(kpiRaw);
        return {
          label: asString(kpi.label),
          value: asString(kpi.value, String(kpi.value ?? "")),
          helperText: asString(kpi.helperText),
        };
      }),
      insights: asStringArray(summary.insights),
      advancedInsights: undefined,
      chartSuggestions: asArray(summary.chartSuggestions)
        .map((chart) => normalizeChart(chart))
        .filter((chart): chart is DatasetChart => Boolean(chart)),
    },
  };
};

export const datasetApi = {
  getCurrent: async () => {
    const response = await request<unknown | null>("/api/datasets/current");
    return normalizeDatasetRecord(response);
  },
  upload: async (payload: { fileName: string; csv: string }) => {
    const response = await request<unknown>("/api/datasets", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const dataset = normalizeDatasetRecord(response);
    if (!dataset) {
      throw new Error("Backend returned an invalid dataset payload");
    }

    return dataset;
  },
  clear: () =>
    request<{ success: boolean }>("/api/datasets/current", {
      method: "DELETE",
    }),
};

export const chatApi = {
  send: async (
    message: string,
    dataset: DatasetRecord,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<ChatResponse> => {
    const response = await request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        datasetId: dataset.id,
        history,
      }),
    });

    return {
      ...response,
      chart: normalizeChart(response.chart),
    };
  },
};
