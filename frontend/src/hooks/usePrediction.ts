import { useMemo } from "react";
import { buildPredictionChart } from "@/ai-engine/predictionEngine";
import { toPredictionRows } from "@/data-processing/datasetTransforms";
import type { DatasetRecord } from "@/shared/types/dataset";

export const usePrediction = (dataset: DatasetRecord | null, targetColumn?: string, futureYears = 5) =>
  useMemo(() => {
    if (!dataset) {
      return {
        predictionChart: null,
        predictionData: [],
      };
    }

    const result = buildPredictionChart(dataset, targetColumn, futureYears);
    const predictionChart = "error" in result ? null : result;

    return {
      predictionChart,
      predictionData: toPredictionRows(predictionChart),
    };
  }, [dataset, futureYears, targetColumn]);
