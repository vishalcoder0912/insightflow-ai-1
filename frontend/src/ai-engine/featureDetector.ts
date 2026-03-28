import type { ChatFeatures, ChatFeatureColumn, DatasetRecord } from "@/shared/types/dataset";

export interface VisualFeatureSuggestion {
  title: string;
  prompt: string;
  chartType: "bar" | "line" | "pie" | "scatter" | "area";
}

export interface FeatureDetectorResult extends ChatFeatures {
  promptSuggestions: string[];
  visualFeatures: VisualFeatureSuggestion[];
}

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const inferRole = (column: ChatFeatureColumn) => {
  if (column.role) return column.role;
  if (column.numeric) return "measure";
  if (/(date|time|year|month)/i.test(column.name)) return "time";
  return "dimension";
};

export const detectDatasetFeatures = (dataset: DatasetRecord | null): FeatureDetectorResult | null => {
  if (!dataset) return null;

  const baseColumns = dataset.summary.columns.map((column) => ({
    ...column,
    role: inferRole(column),
    key: normalizeKey(column.name),
  }));
  const dimensions = baseColumns.filter((column) => column.role === "dimension");
  const measures = baseColumns.filter((column) => column.role === "measure");
  const temporalColumns = baseColumns.filter((column) => column.role === "time");
  const visualFeatures: VisualFeatureSuggestion[] = [];

  if (measures[0] && dimensions[0]) {
    visualFeatures.push({
      title: `${measures[0].name} by ${dimensions[0].name}`,
      prompt: `Show ${measures[0].name} by ${dimensions[0].name}`,
      chartType: "bar",
    });
  }

  if (measures[0] && temporalColumns[0]) {
    visualFeatures.push({
      title: `${measures[0].name} over ${temporalColumns[0].name}`,
      prompt: `Show ${measures[0].name} over ${temporalColumns[0].name}`,
      chartType: "line",
    });
  }

  if (measures[0] && measures[1]) {
    visualFeatures.push({
      title: `${measures[0].name} vs ${measures[1].name}`,
      prompt: `Compare ${measures[0].name} versus ${measures[1].name}`,
      chartType: "scatter",
    });
  }

  return {
    datasetId: dataset.id,
    fileName: dataset.fileName,
    rowCount: dataset.totalRows,
    columnCount: dataset.headers.length,
    schema: dataset.headers.join(", "),
    headers: dataset.headers,
    columns: baseColumns,
    dimensions,
    measures,
    temporalColumns,
    chartSuggestions: dataset.summary.chartSuggestions,
    availableChartTypes: ["bar", "line", "pie", "scatter", "area"],
    patterns: dataset.summary.insights.map((insight) => ({
      type: "summary",
      message: insight,
      confidence: 0.6,
    })),
    previewTable: {
      columns: dataset.headers,
      rows: dataset.previewRows.slice(0, 8).map((row) =>
        Object.fromEntries(dataset.headers.map((header, index) => [header, row[index] ?? ""])),
      ),
    },
    promptSuggestions: visualFeatures.map((feature) => feature.prompt),
    visualFeatures,
  };
};
