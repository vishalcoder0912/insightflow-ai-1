import { getUniqueValues, toDatasetRows, type DatasetRow } from "@/data-processing/datasetTransforms";
import type { ChatChartPayload, ChatResponse, DatasetRecord } from "@/shared/types/dataset";
import { normalizeQueryText } from "@/utils/formatters";

type QueryIntent = "aggregation" | "comparison" | "trend" | "filter";
type AggregationMetric = "count" | "average" | "max" | "min";

interface QueryCondition {
  column: string;
  operator: "eq" | "gt" | "gte" | "lt" | "lte";
  value: string | number;
}

interface ExtractedEntities {
  columns: string[];
  conditions: QueryCondition[];
  metric: AggregationMetric;
  comparisonValues: string[];
}

interface QueryLogicPlan {
  intent: QueryIntent;
  groupBy?: string;
  metric: AggregationMetric;
  metricColumn?: string | null;
  sort?: "asc" | "desc";
  limit?: number;
}

export interface LocalChartJson {
  chartType: "bar" | "line" | "pie";
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

export interface LocalQueryResult extends LocalChartJson {
  meta: {
    intent: QueryIntent;
    entities: ExtractedEntities;
    logic: QueryLogicPlan;
  };
}

type LocalQueryFallback = {
  error: "Query not supported";
};

const COLUMN_ALIASES: Record<string, string[]> = {
  country: ["country", "countries", "nation", "region", "location"],
  type: ["type", "content type", "category", "format"],
  release_year: ["release year", "year", "release", "released"],
  rating: ["rating", "rated", "certificate"],
  date: ["date", "time", "month"],
};

const normalize = (value: string) => normalizeQueryText(value);

const findMatchingColumns = (query: string, headers: string[]) => {
  const normalizedQuery = normalize(query);

  return headers.filter((header) => {
    const normalizedHeader = normalize(header);
    if (normalizedQuery.includes(normalizedHeader)) return true;
    return Object.values(COLUMN_ALIASES).some((aliases) =>
      aliases.some(
        (alias) =>
          normalizedQuery.includes(alias) &&
          (normalizedHeader === alias || normalizedHeader.includes(alias) || alias.includes(normalizedHeader)),
      ),
    );
  });
};

const detectIntent = (query: string): QueryIntent => {
  const normalizedQuery = normalize(query);
  if (/\b(vs|versus|compare|comparison)\b/.test(normalizedQuery)) return "comparison";
  if (/\b(trend|over time|timeline|by year|by month)\b/.test(normalizedQuery)) return "trend";
  if (/\b(after|before|since|only|where|with|in )\b/.test(normalizedQuery)) return "filter";
  return "aggregation";
};

const detectMetric = (query: string): AggregationMetric => {
  const normalizedQuery = normalize(query);
  if (/\b(avg|average|mean)\b/.test(normalizedQuery)) return "average";
  if (/\b(max|highest|largest|top|most)\b/.test(normalizedQuery)) return "max";
  if (/\b(min|lowest|least|smallest)\b/.test(normalizedQuery)) return "min";
  return "count";
};

const findMetricColumn = (query: string, dataset: DatasetRecord) => {
  const normalizedQuery = normalize(query);
  const numericColumns = dataset.summary.columns.filter((column) => column.numeric).map((column) => column.name);
  return (
    numericColumns.find((column) => normalizedQuery.includes(normalize(column))) ||
    numericColumns.find((column) =>
      ["amount", "revenue", "salary", "price", "score", "value", "count"].some((keyword) =>
        normalize(column).includes(keyword),
      ),
    ) ||
    null
  );
};

const findTemporalColumn = (query: string, dataset: DatasetRecord) => {
  const normalizedQuery = normalize(query);
  return (
    dataset.headers.find((header) => {
      const normalizedHeader = normalize(header);
      return normalizedQuery.includes(normalizedHeader) && /(year|date|month|day|time)/.test(normalizedHeader);
    }) ||
    dataset.headers.find((header) => /(year|date|month|day|time)/.test(normalize(header))) ||
    null
  );
};

const findBestGroupByColumn = (
  query: string,
  dataset: DatasetRecord,
  entities: ExtractedEntities,
  rows: DatasetRow[],
) => {
  const normalizedQuery = normalize(query);
  const explicitMatch = entities.columns.find((column) => column !== entities.conditions[0]?.column);
  if (explicitMatch) return explicitMatch;

  const summaryCategory = dataset.summary.columns.find(
    (column) => !column.numeric && !/(id|index)/i.test(column.name),
  )?.name;

  if (/\bcountry\b/.test(normalizedQuery)) return dataset.headers.find((header) => /country/i.test(header)) || summaryCategory || null;
  if (/\btype\b/.test(normalizedQuery)) return dataset.headers.find((header) => /type/i.test(header)) || summaryCategory || null;
  if (/\brating\b/.test(normalizedQuery)) return dataset.headers.find((header) => /rating/i.test(header)) || summaryCategory || null;

  const candidate = dataset.summary.columns
    .filter((column) => !column.numeric && column.unique <= Math.max(12, Math.ceil(rows.length * 0.5)))
    .sort((a, b) => a.unique - b.unique)[0];

  return candidate?.name || null;
};

const extractConditions = (query: string, dataset: DatasetRecord, rows: DatasetRow[]) => {
  const conditions: QueryCondition[] = [];
  const normalizedQuery = normalize(query);
  const temporalColumn = findTemporalColumn(query, dataset);

  const afterMatch = normalizedQuery.match(/\b(after|since)\s+(\d{4})\b/);
  if (afterMatch && temporalColumn) {
    conditions.push({
      column: temporalColumn,
      operator: afterMatch[1] === "since" ? "gte" : "gt",
      value: Number(afterMatch[2]),
    });
  }

  const beforeMatch = normalizedQuery.match(/\bbefore\s+(\d{4})\b/);
  if (beforeMatch && temporalColumn) {
    conditions.push({
      column: temporalColumn,
      operator: "lt",
      value: Number(beforeMatch[1]),
    });
  }

  const comparisonMatch = normalizedQuery.match(/\b(.+?)\s+(?:vs|versus)\s+(.+)\b/);
  const comparisonValues = comparisonMatch
    ? [comparisonMatch[1], comparisonMatch[2]]
        .map((value) => value.replace(/\b(compare|show|between)\b/g, "").trim())
        .filter(Boolean)
    : [];

  const lowCardinalityColumns = dataset.summary.columns
    .filter((column) => !column.numeric && column.unique <= 20)
    .map((column) => column.name);

  lowCardinalityColumns.forEach((column) => {
    const values = getUniqueValues(rows, column).sort((a, b) => b.length - a.length);
    const matchedValue = values.find((value) => normalizedQuery.includes(normalize(value)));
    if (matchedValue && !comparisonValues.some((value) => normalize(value) === normalize(matchedValue))) {
      conditions.push({
        column,
        operator: "eq",
        value: matchedValue,
      });
    }
  });

  return { conditions, comparisonValues };
};

const extractEntities = (query: string, dataset: DatasetRecord, rows: DatasetRow[]): ExtractedEntities => {
  const columns = findMatchingColumns(query, dataset.headers);
  const { conditions, comparisonValues } = extractConditions(query, dataset, rows);

  return {
    columns,
    conditions,
    metric: detectMetric(query),
    comparisonValues,
  };
};

const applyConditions = (rows: DatasetRow[], conditions: QueryCondition[]) =>
  rows.filter((row) =>
    conditions.every((condition) => {
      const rawValue = row[condition.column];
      if (condition.operator === "eq") {
        return normalize(rawValue) === normalize(String(condition.value));
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) return false;

      if (condition.operator === "gt") return numericValue > Number(condition.value);
      if (condition.operator === "gte") return numericValue >= Number(condition.value);
      if (condition.operator === "lt") return numericValue < Number(condition.value);
      return numericValue <= Number(condition.value);
    }),
  );

const inferQueryLogic = (
  query: string,
  dataset: DatasetRecord,
  rows: DatasetRow[],
  intent: QueryIntent,
  entities: ExtractedEntities,
): QueryLogicPlan | null => {
  const metricColumn = findMetricColumn(query, dataset);

  if (intent === "trend") {
    const temporalColumn = findTemporalColumn(query, dataset);
    if (!temporalColumn) return null;
    return {
      intent,
      groupBy: temporalColumn,
      metric: "count",
      metricColumn,
      sort: "asc",
    };
  }

  if (intent === "comparison") {
    const comparisonColumn =
      dataset.headers.find((header) =>
        entities.comparisonValues.every((value) =>
          getUniqueValues(rows, header).some((candidate) => normalize(candidate) === normalize(value)),
        ),
      ) || findBestGroupByColumn(query, dataset, entities, rows);

    if (!comparisonColumn || entities.comparisonValues.length < 2) return null;

    return {
      intent,
      groupBy: comparisonColumn,
      metric: "count",
      metricColumn,
      sort: "desc",
      limit: 2,
    };
  }

  const groupBy = findBestGroupByColumn(query, dataset, entities, rows);
  if (!groupBy) {
    if (intent === "filter" && entities.conditions.length) {
      return { intent, metric: "count" };
    }
    return null;
  }

  return {
    intent,
    groupBy,
    metric: entities.metric === "max" || entities.metric === "min" ? "count" : entities.metric,
    metricColumn,
    sort: /\b(low|least|min|ascending)\b/.test(normalize(query)) ? "asc" : "desc",
    limit: 10,
  };
};

const aggregateRows = (rows: DatasetRow[], logic: QueryLogicPlan, comparisonValues: string[]) => {
  if (!logic.groupBy) {
    return [{ label: "Result", value: rows.length }];
  }

  const grouped = new Map<string, { total: number; count: number; max: number; min: number }>();

  rows.forEach((row) => {
    const group = String(row[logic.groupBy || ""] ?? "").trim();
    if (!group) return;
    if (comparisonValues.length && !comparisonValues.some((value) => normalize(value) === normalize(group))) return;

    const metricValue = logic.metricColumn ? Number(row[logic.metricColumn]) : NaN;
    const entry = grouped.get(group) || {
      total: 0,
      count: 0,
      max: Number.NEGATIVE_INFINITY,
      min: Number.POSITIVE_INFINITY,
    };

    entry.count += 1;
    if (Number.isFinite(metricValue)) {
      entry.total += metricValue;
      entry.max = Math.max(entry.max, metricValue);
      entry.min = Math.min(entry.min, metricValue);
    }
    grouped.set(group, entry);
  });

  const resolved = [...grouped.entries()].map(([label, stats]) => {
    if (logic.metric === "average") return { label, value: Number((stats.total / Math.max(stats.count, 1)).toFixed(2)) };
    if (logic.metric === "max") return { label, value: Number.isFinite(stats.max) ? stats.max : stats.count };
    if (logic.metric === "min") return { label, value: Number.isFinite(stats.min) ? stats.min : stats.count };
    return { label, value: stats.count };
  });

  resolved.sort((a, b) => (logic.sort === "asc" ? a.value - b.value : b.value - a.value));
  if (logic.intent === "trend") {
    resolved.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  }

  return logic.limit ? resolved.slice(0, logic.limit) : resolved;
};

const chooseChartType = (query: string, intent: QueryIntent): LocalChartJson["chartType"] => {
  const normalizedQuery = normalize(query);
  if (intent === "trend") return "line";
  if (normalizedQuery.includes("pie")) return "pie";
  return "bar";
};

export const runNaturalLanguageQuery = (
  userQuery: string,
  dataset: DatasetRow[],
  datasetRecord?: DatasetRecord,
): LocalQueryResult | LocalQueryFallback => {
  if (!userQuery.trim() || !dataset.length || !datasetRecord) {
    return { error: "Query not supported" };
  }

  const intent = detectIntent(userQuery);
  const entities = extractEntities(userQuery, datasetRecord, dataset);
  const logic = inferQueryLogic(userQuery, datasetRecord, dataset, intent, entities);
  if (!logic) return { error: "Query not supported" };

  const filteredRows = applyConditions(dataset, entities.conditions);
  if (!filteredRows.length) return { error: "Query not supported" };

  const series = aggregateRows(filteredRows, logic, entities.comparisonValues);
  if (!series.length) return { error: "Query not supported" };

  return {
    chartType: chooseChartType(userQuery, intent),
    labels: series.map((item) => item.label),
    datasets: [
      {
        label: logic.metricColumn ? `${logic.metric} ${logic.metricColumn}` : logic.metric === "count" ? "Count" : logic.metric,
        data: series.map((item) => item.value),
      },
    ],
    meta: { intent, entities, logic },
  };
};

export const toChartPayload = (result: LocalQueryResult): ChatChartPayload => ({
  title: result.meta.logic.groupBy
    ? `${result.meta.logic.groupBy} ${result.meta.logic.metric === "count" ? "distribution" : result.meta.logic.metric}`
    : "Query result",
  chartType: result.chartType,
  xKey: "label",
  yKey: "value",
  rows: result.labels.map((label, index) => ({
    label,
    value: result.datasets[0]?.data[index] ?? 0,
  })),
  config: {
    xLabel: result.meta.logic.groupBy || "Result",
    yLabel: result.datasets[0]?.label || "Value",
    palette: "cyan",
    showGrid: result.chartType !== "pie",
    showLegend: result.chartType === "pie",
    curved: result.chartType === "line",
  },
});

export const buildLocalChatResponse = (
  message: string,
  datasetRecord: DatasetRecord,
  result: LocalQueryResult | LocalQueryFallback,
): ChatResponse => {
  if ("error" in result) {
    return {
      answer: result.error,
      sql: "",
      insights: [],
      chart: null,
      source: "fallback",
      dataset: {
        fileName: datasetRecord.fileName,
        totalRows: datasetRecord.totalRows,
        headers: datasetRecord.headers,
      },
      meta: { queryIntent: "unsupported" },
    };
  }

  const topLabel = result.labels[0];
  const topValue = result.datasets[0]?.data[0];
  const answer =
    result.meta.intent === "trend"
      ? `Trend generated for ${result.meta.logic.groupBy}. ${result.labels.length} time points matched the query.`
      : topLabel != null && topValue != null
        ? `For "${message}", the top result is ${topLabel} with ${topValue}.`
        : "Query executed on the current dataset preview.";

  return {
    answer,
    sql: "",
    insights: [],
    chart: toChartPayload(result),
    source: "fallback",
    dataset: {
      fileName: datasetRecord.fileName,
      totalRows: datasetRecord.totalRows,
      headers: datasetRecord.headers,
    },
    meta: {
      queryIntent: result.meta.intent,
      derivedFrom: "client_side_rule_engine",
    },
  };
};

export const runLocalDatasetQuery = (message: string, datasetRecord: DatasetRecord): ChatResponse => {
  const datasetRows = toDatasetRows(datasetRecord);
  const result = runNaturalLanguageQuery(message, datasetRows, datasetRecord);
  return buildLocalChatResponse(message, datasetRecord, result);
};
