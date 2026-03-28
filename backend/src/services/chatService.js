import { saveChat } from "../models/Chat.js";
import {
  getDatasetForAnalysis,
  getDatasetForAnalysisById,
} from "./datasetService.js";
import {
  aggregateRecords,
  applyFilters,
  buildChartFromAggregation,
  buildDatasetFeatures,
  buildQueryTable,
  detectFilters,
  detectMentionedColumns,
} from "../utils/dataAnalyzer.js";
import { buildSafeFallback, callGeminiWithAnalysis } from "../utils/geminiHelper.js";

const normalizeText = (value) => String(value ?? "").trim();

const normalizeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toSqlIdentifier = (value) => `"${String(value).replace(/"/g, "\"\"")}"`;

const detectIntent = (message) => {
  const normalized = normalizeText(message).toLowerCase();

  if (/\b(scatter|correlation|relationship)\b/.test(normalized)) return "correlation";
  if (/\b(trend|timeline|over time|monthly|daily|yearly|by month|by year)\b/.test(normalized)) return "trend";
  if (/\b(compare|comparison|versus|vs)\b/.test(normalized)) return "comparison";
  if (/\b(distribution|breakdown|share|split|pie)\b/.test(normalized)) return "distribution";
  if (/\b(sum|total|revenue|sales|amount)\b/.test(normalized)) return "aggregation";
  if (/\b(avg|average|mean)\b/.test(normalized)) return "aggregation";
  if (/\b(count|how many|number of)\b/.test(normalized)) return "count";
  return "overview";
};

const detectMetric = (message) => {
  const normalized = normalizeText(message).toLowerCase();

  if (/\b(avg|average|mean)\b/.test(normalized)) return "average";
  if (/\b(min|lowest|smallest|least)\b/.test(normalized)) return "min";
  if (/\b(max|highest|largest|top|most)\b/.test(normalized)) return "max";
  if (/\b(sum|total|revenue|sales|amount)\b/.test(normalized)) return "sum";
  return "count";
};

const chooseMeasure = (message, features) => {
  const normalized = normalizeKey(message);

  return (
    features.measures.find((column) => normalized.includes(normalizeKey(column.name))) ||
    features.measures[0] ||
    null
  );
};

const chooseDimension = (message, features) => {
  const normalized = normalizeKey(message);

  return (
    features.dimensions.find((column) => normalized.includes(normalizeKey(column.name))) ||
    features.temporalColumns.find((column) => normalized.includes(normalizeKey(column.name))) ||
    features.dimensions[0] ||
    features.temporalColumns[0] ||
    null
  );
};

const chooseChartType = (intent, requestedType, dataLength) => {
  if (requestedType) return requestedType;
  if (intent === "trend") return "line";
  if (intent === "correlation") return "scatter";
  if (intent === "distribution" && dataLength <= 6) return "pie";
  return "bar";
};

const inferRequestedChart = (message) => {
  const normalized = normalizeText(message).toLowerCase();
  if (normalized.includes("pie")) return "pie";
  if (normalized.includes("line")) return "line";
  if (normalized.includes("scatter")) return "scatter";
  if (normalized.includes("area")) return "area";
  return null;
};

const buildOverviewAnalysis = ({ dataset, features, records }) => ({
  intent: "overview",
  metric: "count",
  summary: `The dataset ${dataset.fileName} has ${features.rowCount} rows, ${features.columnCount} columns, ${features.measures.length} measures, and ${features.dimensions.length} dimensions.`,
  highlights: features.patterns.slice(0, 4).map((pattern) => pattern.message),
  confidence: 0.72,
  sql: `SELECT * FROM dataset LIMIT ${Math.min(records.length, 10)};`,
  filters: [],
  table: features.previewTable,
  chart: features.chartSuggestions[0] ?? null,
  suggestedCharts: features.chartSuggestions.slice(0, 3),
  resultCount: records.length,
});

const buildAnalyticalResponse = ({ message, dataset, features, records }) => {
  if (!records.length) {
    return {
      intent: "overview",
      metric: "count",
      summary: "No rows matched the current query filters.",
      highlights: ["Try removing filters or asking about another column."],
      confidence: 0.35,
      sql: "SELECT * FROM dataset WHERE 1 = 0;",
      filters: [],
      table: { columns: [], rows: [] },
      chart: null,
      suggestedCharts: features.chartSuggestions.slice(0, 3),
      resultCount: 0,
    };
  }

  const intent = detectIntent(message);
  const metric = detectMetric(message);
  const requestedChart = inferRequestedChart(message);
  const mentionedColumns = detectMentionedColumns(message, features.columns);
  const dimension = chooseDimension(message, {
    ...features,
    dimensions: mentionedColumns.filter((column) => column.role === "dimension").length
      ? mentionedColumns.filter((column) => column.role === "dimension")
      : features.dimensions,
    temporalColumns: mentionedColumns.filter((column) => column.role === "time").length
      ? mentionedColumns.filter((column) => column.role === "time")
      : features.temporalColumns,
  });
  const measure = chooseMeasure(message, {
    ...features,
    measures: mentionedColumns.filter((column) => column.role === "measure").length
      ? mentionedColumns.filter((column) => column.role === "measure")
      : features.measures,
  });

  if (intent === "overview") {
    return buildOverviewAnalysis({ dataset, features, records });
  }

  if (intent === "trend" && features.temporalColumns[0] && measure) {
    const timeDimension = features.temporalColumns.find((column) => column.name === dimension?.name)
      || features.temporalColumns[0];
    const grouped = aggregateRecords({
      records,
      dimension: timeDimension.name,
      measure: measure.name,
      metric: metric === "count" ? "sum" : metric,
      limit: 12,
      sortDirection: "asc",
    });

    const chart = buildChartFromAggregation({
      title: `${measure.name} over ${timeDimension.name}`,
      chartType: chooseChartType("trend", requestedChart, grouped.length),
      dimension: timeDimension.name,
      measureLabel: measure.name,
      rows: grouped,
    });

    return {
      intent,
      metric,
      groupBy: timeDimension.name,
      measure: measure.name,
      filters: [],
      confidence: 0.81,
      sql: `SELECT ${toSqlIdentifier(timeDimension.name)} AS bucket, SUM(${toSqlIdentifier(measure.name)}) AS value FROM dataset GROUP BY ${toSqlIdentifier(timeDimension.name)} ORDER BY ${toSqlIdentifier(timeDimension.name)} ASC LIMIT 12;`,
      summary: `${measure.name} was aggregated across ${grouped.length} ${timeDimension.name} buckets.`,
      highlights: grouped.slice(0, 3).map((row) => `${row.label}: ${row.value}`),
      table: buildQueryTable(timeDimension.name, grouped),
      chart,
      suggestedCharts: [chart, ...features.chartSuggestions].filter(Boolean).slice(0, 3),
      resultCount: grouped.length,
    };
  }

  if (intent === "correlation" && features.measures.length >= 2) {
    const firstMeasure = measure || features.measures[0];
    const secondMeasure = features.measures.find((column) => column.name !== firstMeasure?.name) || features.measures[1];
    const rows = records
      .slice(0, 20)
      .map((record, index) => ({
        label: `Row ${index + 1}`,
        value: Number(record?.[secondMeasure.name] ?? 0),
        x: Number(record?.[firstMeasure.name] ?? 0),
      }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.value));

    const chart = {
      title: `${firstMeasure.name} vs ${secondMeasure.name}`,
      type: "scatter",
      xKey: "x",
      dataKey: "value",
      data: rows.map((row) => ({
        name: row.label,
        value: row.value,
        x: row.x,
        label: row.label,
        y: row.value,
      })),
      config: {
        xLabel: firstMeasure.name,
        yLabel: secondMeasure.name,
        showGrid: true,
        showLegend: false,
        palette: "amber",
      },
    };

    return {
      intent,
      metric: "correlation",
      measure: `${firstMeasure.name}, ${secondMeasure.name}`,
      filters: [],
      confidence: 0.76,
      sql: `SELECT ${toSqlIdentifier(firstMeasure.name)}, ${toSqlIdentifier(secondMeasure.name)} FROM dataset WHERE ${toSqlIdentifier(firstMeasure.name)} IS NOT NULL AND ${toSqlIdentifier(secondMeasure.name)} IS NOT NULL LIMIT 20;`,
      summary: `I found ${rows.length} paired records to compare ${firstMeasure.name} and ${secondMeasure.name}.`,
      highlights: [
        `${firstMeasure.name} is plotted on the x-axis.`,
        `${secondMeasure.name} is plotted on the y-axis.`,
      ],
      table: {
        columns: [firstMeasure.name, secondMeasure.name],
        rows: rows.map((row) => ({
          [firstMeasure.name]: row.x,
          [secondMeasure.name]: row.value,
        })),
      },
      chart,
      suggestedCharts: [chart, ...features.chartSuggestions].filter(Boolean).slice(0, 3),
      resultCount: rows.length,
    };
  }

  const chartDimension = dimension?.role === "time" ? features.temporalColumns[0] : dimension;
  const aggregationMetric = metric === "max" || metric === "min"
    ? metric
    : intent === "aggregation"
      ? metric
      : "count";
  const grouped = aggregateRecords({
    records,
    dimension: chartDimension?.name ?? null,
    measure: measure?.name ?? null,
    metric: aggregationMetric,
    limit: 10,
    sortDirection: metric === "min" ? "asc" : "desc",
  });
  const chart = buildChartFromAggregation({
    title: chartDimension?.name
      ? `${aggregationMetric} by ${chartDimension.name}`
      : "Query result",
    chartType: chooseChartType(intent, requestedChart, grouped.length),
    dimension: chartDimension?.name,
    measureLabel: measure?.name ?? "Count",
    rows: grouped,
  });
  const sqlMeasure = aggregationMetric === "count"
    ? "COUNT(*)"
    : `${aggregationMetric.toUpperCase()}(${toSqlIdentifier(measure?.name ?? "value")})`;
  const sql = chartDimension?.name
    ? `SELECT ${toSqlIdentifier(chartDimension.name)} AS label, ${sqlMeasure} AS value FROM dataset GROUP BY ${toSqlIdentifier(chartDimension.name)} ORDER BY value ${metric === "min" ? "ASC" : "DESC"} LIMIT 10;`
    : `SELECT ${sqlMeasure} AS value FROM dataset;`;

  return {
    intent,
    metric: aggregationMetric,
    groupBy: chartDimension?.name ?? null,
    measure: measure?.name ?? null,
    filters: [],
    confidence: 0.78,
    sql,
    summary: chartDimension?.name
      ? `Computed ${aggregationMetric} results grouped by ${chartDimension.name}.`
      : `Computed a dataset-level ${aggregationMetric} summary.`,
    highlights: grouped.slice(0, 3).map((row) => `${row.label}: ${row.value}`),
    table: buildQueryTable(chartDimension?.name ?? null, grouped),
    chart,
    suggestedCharts: [chart, ...features.chartSuggestions].filter(Boolean).slice(0, 3),
    resultCount: grouped.length,
  };
};

const mergeSuggestedCharts = (analysis, aiResult, features) => {
  const unique = new Map();

  [...(analysis.suggestedCharts || []), ...(aiResult.suggestedCharts || []), ...(features.chartSuggestions || [])]
    .filter((chart) => chart && typeof chart === "object")
    .forEach((chart) => {
      const key = `${chart.title || "chart"}:${chart.type || "bar"}`;
      if (!unique.has(key)) {
        unique.set(key, chart);
      }
    });

  return [...unique.values()].slice(0, 4);
};

const buildResponsePayload = ({ dataset, features, analysis, aiResult, suggestedCharts }) => {
  const fallback = buildSafeFallback({
    message: analysis.summary,
    analysis,
    features,
  });

  return {
    answer: aiResult.answer || fallback.answer,
    sql: analysis.sql || "",
    insights: Array.isArray(aiResult.insights) && aiResult.insights.length
      ? aiResult.insights
      : fallback.insights,
    responseType: analysis.chart ? "text+chart+table" : "text+table",
    chart: analysis.chart || suggestedCharts[0] || null,
    table: analysis.table || null,
    meta: {
      queryIntent: analysis.intent,
      confidence: analysis.confidence,
      rows_returned: analysis.resultCount,
      sql_source: "rule_engine",
      detectedColumns: features.columns.map((column) => column.name),
    },
    source: aiResult.source || "fallback",
    dataset: {
      fileName: dataset.fileName,
      totalRows: dataset.totalRows,
      headers: dataset.headers,
      schema: features.schema,
      columns: features.columns.map((column) => column.name),
    },
    suggestedCharts,
    analysis,
    features,
  };
};

export const processChatMessage = async ({
  datasetId,
  message,
  history = [],
}) => {
  const dataset = datasetId
    ? await getDatasetForAnalysisById(datasetId)
    : await getDatasetForAnalysis();

  if (!dataset) {
    throw new Error("Dataset not found. Upload a CSV file before starting chat.");
  }

  const features = buildDatasetFeatures(dataset);
  const records = Array.isArray(dataset.records) && dataset.records.length
    ? dataset.records
    : dataset.rows.map((row) =>
        Object.fromEntries(dataset.headers.map((header, index) => [header, row?.[index] ?? ""])),
      );
  const filters = detectFilters(message, features, records);
  const filteredRecords = filters.length ? applyFilters(records, filters) : records;
  const analysis = {
    ...buildAnalyticalResponse({
      message,
      dataset,
      features,
      records: filteredRecords,
    }),
    filters,
  };
  const aiResult = await callGeminiWithAnalysis({
    message,
    history,
    features,
    analysis,
  });
  const suggestedCharts = mergeSuggestedCharts(analysis, aiResult, features);
  const response = buildResponsePayload({
    dataset,
    features,
    analysis,
    aiResult,
    suggestedCharts,
  });

  await saveChat({
    datasetId: String(dataset.id ?? datasetId ?? "current"),
    message,
    response,
    suggestions: suggestedCharts,
    analysis,
    features,
  });

  return {
    response,
    suggestedCharts,
    analysis,
    features,
  };
};
