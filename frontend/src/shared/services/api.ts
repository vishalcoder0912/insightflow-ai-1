import { runLocalDatasetQuery } from "@/ai-engine/analystEngine";
import { analyticsTracker } from "@/analytics/tracker";
import type { ChatResponse, DatasetChart, DatasetRecord } from "@/shared/types/dataset";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  asArray(value).map((item) => asRecord(item));

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asStringArray = (value: unknown): string[] => asArray(value).map((item) => String(item));

const asStringMatrix = (value: unknown): string[][] =>
  asArray(value).map((row) => asArray(row).map((cell) => String(cell)));

const getField = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
};

const asChartType = (value: unknown): DatasetChart["type"] => {
  if (value === "bar" || value === "line" || value === "pie" || value === "area" || value === "scatter") {
    return value;
  }

  return "bar";
};

const readJson = async <T>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("API returned invalid JSON.");
  }
};

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

  return readJson<T>(response);
};

const normalizeChart = (chart: unknown): DatasetChart | null => {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  const candidate = asRecord(chart);
  const xKey = asString(getField(candidate, "xKey", "x_key"), "name");
  const dataKey = asString(getField(candidate, "dataKey", "data_key", "yKey", "y_key"), "value");

  const data = asRecordArray(getField(candidate, "data"))
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
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const rowsData = asRecordArray(getField(candidate, "rows"))
    .map((row, index) => {
      const rawLabel = row[xKey] ?? row.name ?? row.label ?? `Item ${index + 1}`;
      const rawValue = asOptionalNumber(row[dataKey] ?? row.value ?? row.y);

      if (rawValue === undefined) {
        return null;
      }

      return {
        ...row,
        name: String(rawLabel),
        value: rawValue,
        x: String(row[xKey] ?? rawLabel),
        label: String(row.label ?? rawLabel),
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const labels = asArray(getField(candidate, "labels")).map((item) =>
    item === null ? null : typeof item === "number" || typeof item === "string" ? item : String(item),
  );
  const datasets = asRecordArray(getField(candidate, "datasets")).map((dataset) => ({
    label: asString(dataset.label) || undefined,
    data: asArray(dataset.data).map((value) => {
      if (value === null) return null;
      if (typeof value === "number" || typeof value === "string") return value;
      return String(value);
    }),
  }));
  const config = asRecord(getField(candidate, "config"));

  if (!data.length && !rowsData.length && !labels.length && !datasets.length) {
    return null;
  }

  return {
    title: asString(getField(candidate, "title"), "Chart"),
    type: asChartType(getField(candidate, "type", "chartType", "chart_type")),
    xKey,
    dataKey,
    data: data.length ? data : rowsData,
    labels: labels.length ? labels : undefined,
    datasets: datasets.length ? datasets : undefined,
    config: Object.keys(config).length
      ? {
          xLabel: asString(getField(config, "xLabel", "x_label")) || undefined,
          yLabel: asString(getField(config, "yLabel", "y_label")) || undefined,
          palette: asString(getField(config, "palette")) || undefined,
          showGrid: typeof getField(config, "showGrid", "show_grid") === "boolean"
            ? Boolean(getField(config, "showGrid", "show_grid"))
            : undefined,
          showLegend: typeof getField(config, "showLegend", "show_legend") === "boolean"
            ? Boolean(getField(config, "showLegend", "show_legend"))
            : undefined,
          curved: typeof getField(config, "curved") === "boolean" ? Boolean(getField(config, "curved")) : undefined,
        }
      : undefined,
  };
};

const normalizeDatasetRecord = (value: unknown): DatasetRecord | null => {
  if (!value) {
    return null;
  }

  const record = asRecord(value);
  const summary = asRecord(getField(record, "summary"));
  const headers = asStringArray(getField(record, "headers"));
  const previewRows = asStringMatrix(getField(record, "previewRows", "preview_rows"));
  const totalRows = asNumber(getField(record, "totalRows", "total_rows"), previewRows.length);

  return {
    id: asString(getField(record, "id"), "current"),
    fileName: asString(getField(record, "fileName", "file_name"), "dataset.csv"),
    uploadedAt: asString(getField(record, "uploadedAt", "uploaded_at"), new Date().toISOString()),
    headers,
    totalRows,
    previewRows,
    summary: {
      rowCount: asNumber(getField(summary, "rowCount", "row_count"), totalRows),
      columnCount: asNumber(getField(summary, "columnCount", "column_count"), headers.length),
      columns: asArray(getField(summary, "columns")).map((columnRaw) => {
        const column = asRecord(columnRaw);
        return {
          name: asString(getField(column, "name")),
          filled: asNumber(getField(column, "filled")),
          unique: asNumber(getField(column, "unique")),
          sampleValues: asStringArray(getField(column, "sampleValues", "sample_values")),
          numeric: Boolean(getField(column, "numeric")),
          detectedType: asString(getField(column, "detectedType", "detected_type")) || undefined,
          min: asOptionalNumber(getField(column, "min")),
          max: asOptionalNumber(getField(column, "max")),
          average: asOptionalNumber(getField(column, "average")),
          sum: asOptionalNumber(getField(column, "sum")),
        };
      }),
      kpis: asArray(getField(summary, "kpis")).map((kpiRaw) => {
        const kpi = asRecord(kpiRaw);
        return {
          label: asString(getField(kpi, "label")),
          value: asString(getField(kpi, "value"), String(getField(kpi, "value") ?? "")),
          helperText: asString(getField(kpi, "helperText", "helper_text")),
        };
      }),
      insights: asStringArray(getField(summary, "insights")),
      advancedInsights: undefined,
      chartSuggestions: asArray(getField(summary, "chartSuggestions", "chart_suggestions"))
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
    try {
      const response = await request<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          datasetId: dataset.id,
          history,
        }),
      });

      analyticsTracker.trackFeature("chat_query", {
        source: response.source,
        hasChart: Boolean(response.chart),
      });

      return {
        ...response,
        chart: normalizeChart(response.chart) ?? response.chart ?? null,
      };
    } catch (error) {
      if (error instanceof TypeError) {
        return runLocalDatasetQuery(message, dataset);
      }

      throw error;
    }
  },
};
