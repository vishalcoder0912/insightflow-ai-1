import { runLocalDatasetQuery } from "@/ai-engine/analystEngine";
import { analyticsTracker } from "@/analytics/tracker";
import type {
  ChatAnalysis,
  ChatFeatures,
  ChatResponse,
  ChatTablePayload,
  DatasetChart,
  DatasetRecord,
} from "@/shared/types/dataset";

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

const normalizeTable = (table: unknown): ChatTablePayload | null => {
  if (!table || typeof table !== "object") {
    return null;
  }

  const candidate = asRecord(table);
  const columns = asStringArray(getField(candidate, "columns"));
  const rows = asRecordArray(getField(candidate, "rows")).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "number" ? value : String(value ?? ""),
      ]),
    ),
  );

  if (!columns.length || !rows.length) {
    return null;
  }

  return { columns, rows };
};

const normalizeFeatures = (value: unknown): ChatFeatures | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const features = asRecord(value);

  return {
    datasetId: asString(getField(features, "datasetId", "dataset_id")) || undefined,
    fileName: asString(getField(features, "fileName", "file_name")) || undefined,
    rowCount: asOptionalNumber(getField(features, "rowCount", "row_count")),
    columnCount: asOptionalNumber(getField(features, "columnCount", "column_count")),
    schema: asString(getField(features, "schema")) || undefined,
    headers: asStringArray(getField(features, "headers")),
    columns: asArray(getField(features, "columns")).map((columnRaw) => {
      const column = asRecord(columnRaw);
      return {
        name: asString(getField(column, "name")),
        key: asString(getField(column, "key")) || undefined,
        role: asString(getField(column, "role")) || undefined,
        detectedType: asString(getField(column, "detectedType", "detected_type")) || undefined,
        filled: asOptionalNumber(getField(column, "filled")),
        empty: asOptionalNumber(getField(column, "empty")),
        unique: asOptionalNumber(getField(column, "unique")),
        sampleValues: asStringArray(getField(column, "sampleValues", "sample_values")),
        numeric: typeof getField(column, "numeric") === "boolean" ? Boolean(getField(column, "numeric")) : undefined,
        min: asOptionalNumber(getField(column, "min")),
        max: asOptionalNumber(getField(column, "max")),
        average: asOptionalNumber(getField(column, "average")),
        sum: asOptionalNumber(getField(column, "sum")),
        topValues: asArray(getField(column, "topValues", "top_values")).map((entryRaw) => {
          const entry = asRecord(entryRaw);
          return {
            value: asString(getField(entry, "value")),
            count: asNumber(getField(entry, "count")),
          };
        }),
      };
    }),
    dimensions: asArray(getField(features, "dimensions")).map((columnRaw) => {
      const column = asRecord(columnRaw);
      return {
        name: asString(getField(column, "name")),
        role: asString(getField(column, "role")) || undefined,
        detectedType: asString(getField(column, "detectedType", "detected_type")) || undefined,
      };
    }),
    measures: asArray(getField(features, "measures")).map((columnRaw) => {
      const column = asRecord(columnRaw);
      return {
        name: asString(getField(column, "name")),
        role: asString(getField(column, "role")) || undefined,
        detectedType: asString(getField(column, "detectedType", "detected_type")) || undefined,
      };
    }),
    temporalColumns: asArray(getField(features, "temporalColumns", "temporal_columns")).map((columnRaw) => {
      const column = asRecord(columnRaw);
      return {
        name: asString(getField(column, "name")),
        role: asString(getField(column, "role")) || undefined,
        detectedType: asString(getField(column, "detectedType", "detected_type")) || undefined,
      };
    }),
    chartSuggestions: asArray(getField(features, "chartSuggestions", "chart_suggestions"))
      .map((chart) => normalizeChart(chart))
      .filter((chart): chart is DatasetChart => Boolean(chart)),
    availableChartTypes: asArray(getField(features, "availableChartTypes", "available_chart_types"))
      .map((type) => asChartType(type)),
    patterns: asArray(getField(features, "patterns")).map((patternRaw) => {
      const pattern = asRecord(patternRaw);
      return {
        type: asString(getField(pattern, "type"), "pattern"),
        message: asString(getField(pattern, "message")),
        confidence: asOptionalNumber(getField(pattern, "confidence")),
      };
    }),
    previewTable: normalizeTable(getField(features, "previewTable", "preview_table")),
  };
};

const normalizeAnalysis = (value: unknown): ChatAnalysis | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const analysis = asRecord(value);

  return {
    intent: asString(getField(analysis, "intent")) || undefined,
    metric: asString(getField(analysis, "metric")) || undefined,
    groupBy: asString(getField(analysis, "groupBy", "group_by")) || undefined,
    measure: asString(getField(analysis, "measure")) || undefined,
    filters: asArray(getField(analysis, "filters")).map((filterRaw) => {
      const filter = asRecord(filterRaw);
      return {
        column: asString(getField(filter, "column")),
        operator: asString(getField(filter, "operator")) || undefined,
        value: typeof getField(filter, "value") === "number"
          ? asNumber(getField(filter, "value"))
          : asString(getField(filter, "value")),
      };
    }),
    confidence: asOptionalNumber(getField(analysis, "confidence")),
    sql: asString(getField(analysis, "sql")) || undefined,
    summary: asString(getField(analysis, "summary")) || undefined,
    highlights: asStringArray(getField(analysis, "highlights")),
    resultCount: asOptionalNumber(getField(analysis, "resultCount", "result_count")),
    table: normalizeTable(getField(analysis, "table")),
    chart: normalizeChart(getField(analysis, "chart")),
    suggestedCharts: asArray(getField(analysis, "suggestedCharts", "suggested_charts"))
      .map((chart) => normalizeChart(chart))
      .filter((chart): chart is DatasetChart => Boolean(chart)),
  };
};

const normalizeChatResponse = (
  payload: unknown,
  fallbackDataset: DatasetRecord,
): ChatResponse => {
  const envelope = asRecord(payload);
  const responseRecord = getField(envelope, "response") !== undefined
    ? asRecord(getField(envelope, "response"))
    : envelope;
  const analysis = normalizeAnalysis(getField(envelope, "analysis"))
    || normalizeAnalysis(getField(responseRecord, "analysis"));
  const features = normalizeFeatures(getField(envelope, "features"))
    || normalizeFeatures(getField(responseRecord, "features"));
  const responseType = asString(getField(responseRecord, "responseType", "response_type")) || undefined;
  const meta = asRecord(getField(responseRecord, "meta"));
  const responseDataset = asRecord(getField(responseRecord, "dataset"));
  const datasetSchema = asString(getField(responseDataset, "schema")) || undefined;
  const datasetColumns = asStringArray(getField(responseDataset, "columns"));
  const suggestedCharts = asArray(getField(envelope, "suggestedCharts", "suggested_charts"))
    .map((chart) => normalizeChart(chart))
    .filter((chart): chart is DatasetChart => Boolean(chart));
  const chart = normalizeChart(getField(responseRecord, "chart"))
    || analysis?.chart
    || suggestedCharts[0]
    || null;
  const table = normalizeTable(getField(responseRecord, "table")) || analysis?.table || null;
  const normalized: ChatResponse = {
    answer: asString(getField(responseRecord, "answer"), "No answer available."),
    sql: asString(getField(responseRecord, "sql")),
    insights: asStringArray(getField(responseRecord, "insights")),
    chart,
    source: asString(getField(responseRecord, "source"), "fallback"),
    dataset: {
      fileName: asString(getField(responseDataset, "fileName", "file_name"), fallbackDataset.fileName),
      totalRows: asNumber(getField(responseDataset, "totalRows", "total_rows"), fallbackDataset.totalRows),
      headers: asStringArray(getField(responseDataset, "headers")).length
        ? asStringArray(getField(responseDataset, "headers"))
        : fallbackDataset.headers,
    },
  };

  if (responseType) {
    normalized.responseType = responseType;
  }

  if (Object.keys(meta).length) {
    normalized.meta = meta;
  }

  if (datasetSchema) {
    normalized.dataset.schema = datasetSchema;
  }

  if (datasetColumns.length) {
    normalized.dataset.columns = datasetColumns;
  }

  if (table) {
    normalized.table = table;
  }

  if (suggestedCharts.length) {
    normalized.suggestedCharts = suggestedCharts;
  }

  if (analysis) {
    normalized.analysis = analysis;
  }

  if (features) {
    normalized.features = features;
  }

  return normalized;
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
      const payload = await request<unknown>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          datasetId: dataset.id,
          history,
        }),
      });
      const response = normalizeChatResponse(payload, dataset);

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
