import type { DatasetPattern, DatasetRecord } from "@/shared/types/dataset";
import { filterMeaningfulRows, groupCounts, toDatasetRows, type CountPoint } from "@/data-processing/datasetTransforms";
import { mean, std } from "@/utils/mathHelpers";
import { capitalize, normalizeValue } from "@/utils/formatters";

interface PreparedDataset {
  rows: Record<string, string>[];
  numericColumns: string[];
  categoricalColumns: string[];
}

const preprocessDataset = (dataset: DatasetRecord, hints: string[] = []): PreparedDataset => {
  const rows = filterMeaningfulRows(toDatasetRows(dataset, normalizeValue));
  const hinted = new Set(hints.map((hint) => normalizeValue(hint)));

  const numericColumns = dataset.summary.columns
    .filter(
      (column) =>
        column.numeric ||
        hinted.has(normalizeValue(column.name)) ||
        /(year|amount|revenue|salary|price|score|value|count)/.test(normalizeValue(column.name)),
    )
    .map((column) => column.name);

  const categoricalColumns = dataset.summary.columns
    .filter((column) => !column.numeric && column.unique > 1 && column.unique <= Math.max(25, dataset.totalRows))
    .map((column) => column.name);

  return { rows, numericColumns, categoricalColumns };
};

const detectTrend = (yearlyData: CountPoint[]): DatasetPattern | null => {
  if (yearlyData.length < 3) return null;

  const sorted = [...yearlyData].sort((a, b) => Number(a.label) - Number(b.label));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = Math.max(Number(last.label) - Number(first.label), sorted.length - 1, 1);
  const averageValue = mean(sorted.map((point) => point.value));
  if (!averageValue) return null;

  const slope = (last.value - first.value) / years;
  const threshold = averageValue * 0.1;
  if (Math.abs(slope) <= threshold) return null;

  return {
    type: "trend",
    message: `Content ${slope > 0 ? "increased" : "decreased"} steadily over time.`,
    confidence: Math.min(1, Math.abs(slope) / averageValue),
  };
};

const detectAnomalies = (yearlyData: CountPoint[]): DatasetPattern[] => {
  if (yearlyData.length < 4) return [];

  const values = yearlyData.map((point) => point.value);
  const average = mean(values);
  const deviation = std(values);
  if (!deviation) return [];

  return yearlyData.flatMap((point) => {
    const distance = Math.abs(point.value - average);
    if (distance <= 2 * deviation) return [];

    return [
      {
        type: "anomaly" as const,
        message: `Sharp ${point.value > average ? "spike" : "drop"} detected around ${point.label}.`,
        confidence: Math.min(1, distance / (2 * deviation)),
      },
    ];
  });
};

const detectDominance = (counts: CountPoint[], column: string): DatasetPattern | null => {
  if (counts.length < 2) return null;

  const sorted = [...counts].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, point) => sum + point.value, 0);
  if (!total) return null;

  const top = sorted[0];
  const ratio = top.value / total;
  if (ratio <= 0.3) return null;

  return {
    type: "dominance",
    message: `${capitalize(top.label)} dominates the dataset in ${column}.`,
    confidence: ratio,
  };
};

const findYearColumn = (prepared: PreparedDataset, dataset: DatasetRecord, hints: string[] = []) => {
  const hinted = hints.find((hint) => /(year|date|month|time)/.test(normalizeValue(hint)));
  if (hinted && dataset.headers.includes(hinted)) return hinted;

  return (
    dataset.headers.find((header) => /(release_year|year|date|month|time)/.test(normalizeValue(header))) ||
    prepared.numericColumns.find((column) => /(year|date)/.test(normalizeValue(column))) ||
    null
  );
};

const findDominanceColumn = (prepared: PreparedDataset, hints: string[] = []) => {
  const hinted = hints.find((hint) => /(type|country|rating|category)/.test(normalizeValue(hint)));
  if (hinted && prepared.categoricalColumns.includes(hinted)) return hinted;

  return (
    prepared.categoricalColumns.find((column) => /(type|country|rating|category)/.test(normalizeValue(column))) ||
    prepared.categoricalColumns[0] ||
    null
  );
};

export const detectDatasetPatterns = (
  dataset: DatasetRecord,
  columnHints: string[] = [],
): DatasetPattern[] | { error: "Not enough data for pattern detection" } => {
  const prepared = preprocessDataset(dataset, columnHints);
  if (prepared.rows.length < 3) {
    return { error: "Not enough data for pattern detection" };
  }

  const patterns: DatasetPattern[] = [];
  const yearColumn = findYearColumn(prepared, dataset, columnHints);

  if (yearColumn) {
    const yearlyData = groupCounts(prepared.rows, yearColumn)
      .filter((point) => /^\d{4}$/.test(point.label))
      .sort((a, b) => Number(a.label) - Number(b.label));

    const trend = detectTrend(yearlyData);
    if (trend) patterns.push(trend);
    patterns.push(...detectAnomalies(yearlyData));
  }

  const dominanceColumn = findDominanceColumn(prepared, columnHints);
  if (dominanceColumn) {
    const dominance = detectDominance(groupCounts(prepared.rows, dominanceColumn), dominanceColumn);
    if (dominance) patterns.push(dominance);
  }

  return patterns.length ? patterns : { error: "Not enough data for pattern detection" };
};
