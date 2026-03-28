import { buildPredictionSeries, findTemporalColumn, groupByYear, toDatasetRows } from "@/data-processing/datasetTransforms";
import type { DatasetRecord, PredictionChartData } from "@/shared/types/dataset";
import { normalizeValue } from "@/utils/formatters";

export const buildPredictionChart = (
  dataset: DatasetRecord,
  targetColumn?: string,
  futureYears = 5,
): PredictionChartData | { error: "Not enough data for prediction" } => {
  const yearColumn = findTemporalColumn(dataset.headers, targetColumn);
  if (!yearColumn) {
    return { error: "Not enough data for prediction" };
  }

  const grouped = groupByYear(toDatasetRows(dataset, normalizeValue), yearColumn);
  return buildPredictionSeries(grouped, futureYears);
};
