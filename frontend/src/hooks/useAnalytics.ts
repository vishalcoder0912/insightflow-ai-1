import { useMemo } from "react";
import { detectDatasetPatterns } from "@/ai-engine/patternEngine";
import type { DatasetRecord } from "@/shared/types/dataset";

export const useAnalytics = (dataset: DatasetRecord | null, columnHints: string[] = []) =>
  useMemo(() => {
    if (!dataset) return [];
    const result = detectDatasetPatterns(dataset, columnHints);
    return "error" in result ? [] : result;
  }, [dataset, columnHints]);
