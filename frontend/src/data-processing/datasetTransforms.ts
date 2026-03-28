import type { DatasetRecord, PredictionChartData } from "@/shared/types/dataset";
import { linearRegression } from "@/utils/mathHelpers";
import { normalizeValue } from "@/utils/formatters";

export type DatasetRow = Record<string, string>;

export interface CountPoint {
  label: string;
  value: number;
}

export interface YearPoint {
  year: number;
  value: number;
}

export const toDatasetRows = (dataset: DatasetRecord, normalizer?: (value: unknown) => string): DatasetRow[] =>
  dataset.previewRows.map((row) =>
    dataset.headers.reduce<DatasetRow>((acc, header, index) => {
      const raw = row[index];
      acc[header] = normalizer ? normalizer(raw) : String(raw ?? "");
      return acc;
    }, {}),
  );

export const filterMeaningfulRows = (rows: DatasetRow[]) =>
  rows.filter((row) => Object.values(row).some((value) => value !== "" && value !== "null" && value !== "undefined"));

export const getUniqueValues = (rows: DatasetRow[], column: string) =>
  [...new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean))];

export const groupCounts = (rows: DatasetRow[], column: string): CountPoint[] => {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const key = String(row[column] ?? "").trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
};

export const groupByYear = (rows: DatasetRow[], yearColumn: string): YearPoint[] => {
  const counts = new Map<number, number>();

  rows.forEach((row) => {
    const raw = String(row[yearColumn] ?? "");
    if (!/^\d{4}$/.test(raw)) return;
    const year = Number(raw);
    counts.set(year, (counts.get(year) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
};

export const findTemporalColumn = (headers: string[], preferredColumn?: string) => {
  if (preferredColumn && headers.includes(preferredColumn)) return preferredColumn;

  return (
    headers.find((header) => normalizeValue(header) === normalizeValue(preferredColumn)) ||
    headers.find((header) => /(release_year|year|date|month|time)/.test(normalizeValue(header))) ||
    null
  );
};

export const buildPredictionSeries = (
  grouped: YearPoint[],
  futureYears: number,
): PredictionChartData | { error: "Not enough data for prediction" } => {
  if (grouped.length < 2) {
    return { error: "Not enough data for prediction" };
  }

  const regression = linearRegression(grouped.map((point) => ({ x: point.year, y: point.value })));
  if (!regression) {
    return { error: "Not enough data for prediction" };
  }

  const future = Array.from({ length: futureYears }, (_, index) => {
    const year = grouped[grouped.length - 1].year + index + 1;
    return {
      year,
      value: Math.max(0, Math.round(regression.slope * year + regression.intercept)),
    };
  });

  const labels = [...grouped.map((point) => String(point.year)), ...future.map((point) => String(point.year))];
  const actualData = [...grouped.map((point) => point.value), ...future.map(() => null)];
  const predictedData = [...grouped.map(() => null), ...future.map((point) => point.value)];

  return {
    chartType: "line",
    labels,
    datasets: [
      { label: "Actual", data: actualData },
      { label: "Predicted", data: predictedData },
    ],
    confidence: regression.rSquared,
  };
};

export const toPredictionRows = (predictionChart: PredictionChartData | null) =>
  predictionChart
    ? predictionChart.labels.map((label, index) => ({
        name: label,
        actual: predictionChart.datasets[0]?.data[index] ?? null,
        predicted: predictionChart.datasets[1]?.data[index] ?? null,
      }))
    : [];
