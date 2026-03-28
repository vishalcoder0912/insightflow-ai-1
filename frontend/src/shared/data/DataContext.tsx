import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { datasetApi } from "@/shared/services/api";
import { analyticsTracker } from "@/analytics/tracker";
import { useAnalytics } from "@/hooks/useAnalytics";
import { usePrediction } from "@/hooks/usePrediction";
import type { DatasetPattern, DatasetRecord, ParsedData, PredictionChartData } from "@/shared/types/dataset";

interface DataContextValue {
  dataset: DatasetRecord | null;
  parsed: ParsedData | null;
  patterns: DatasetPattern[];
  predictionChart: PredictionChartData | null;
  predictionData: Array<{ name: string; actual: number | null; predicted: number | null }>;
  fileName: string;
  isLoading: boolean;
  uploadDataset: (payload: { fileName: string; csv: string }) => Promise<DatasetRecord>;
  clearData: () => Promise<void>;
  refreshDataset: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const isDatasetRecord = (value: unknown): value is DatasetRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const dataset = value as Partial<DatasetRecord>;

  return (
    typeof dataset.fileName === "string" &&
    typeof dataset.totalRows === "number" &&
    Array.isArray(dataset.headers) &&
    Array.isArray(dataset.previewRows) &&
    !!dataset.summary &&
    typeof dataset.summary === "object" &&
    Array.isArray(dataset.summary.kpis) &&
    Array.isArray(dataset.summary.insights) &&
    (!("advancedInsights" in dataset.summary) ||
      !dataset.summary.advancedInsights ||
      (Array.isArray(dataset.summary.advancedInsights.descriptive) &&
        Array.isArray(dataset.summary.advancedInsights.diagnostic) &&
        Array.isArray(dataset.summary.advancedInsights.prescriptive))) &&
    Array.isArray(dataset.summary.chartSuggestions)
  );
};

const getColumnHints = (dataset: DatasetRecord | null) => {
  if (!dataset) return [];

  const prioritized = dataset.summary.columns
    .filter(
      (column) =>
        /(year|date|time|month|quarter|country|region|type|category|rating|status|segment|department|product|campaign|channel|diagnosis|course|subject|amount|revenue|salary|price|score|value|count|cost|profit|expense)/i.test(
          column.name,
        ),
    )
    .map((column) => column.name);

  return [...new Set(prioritized)].slice(0, 6);
};

const getPredictionTarget = (dataset: DatasetRecord | null) => {
  if (!dataset) return null;

  const namedTemporal = dataset.summary.columns.find((column) =>
    /(year|date|time|month)/i.test(column.name),
  );
  if (namedTemporal) {
    return namedTemporal.name;
  }

  const sampledTemporal = dataset.summary.columns.find((column) =>
    column.sampleValues.some((value) => /^\d{4}$/.test(String(value ?? "").trim())),
  );

  return sampledTemporal?.name ?? null;
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const columnHints = useMemo(() => getColumnHints(dataset), [dataset]);
  const predictionTarget = useMemo(() => getPredictionTarget(dataset), [dataset]);

  const refreshDataset = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('DataContext: Fetching dataset...');
      const current = await datasetApi.getCurrent();
      console.log('DataContext: Received dataset:', current);
      setDataset(isDatasetRecord(current) ? current : null);
      if (current) {
        analyticsTracker.trackFeature("dataset_refresh", {
          fileName: current.fileName,
        });
        console.log('DataContext: Dataset set successfully');
      } else {
        console.log('DataContext: No valid dataset received');
      }
    } catch (error) {
      console.log('DataContext: Error fetching dataset:', error);
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDataset();
  }, [refreshDataset]);

  const uploadDataset = useCallback(async (payload: { fileName: string; csv: string }) => {
    setIsLoading(true);
    try {
      console.log('DataContext: Uploading dataset:', payload.fileName);
      const current = await datasetApi.upload(payload);
      console.log('DataContext: Upload response:', current);
      if (!isDatasetRecord(current)) {
        throw new Error("Backend returned an invalid dataset payload.");
      }

      setDataset(current);
      analyticsTracker.trackFeature("dataset_upload", {
        fileName: current.fileName,
        totalRows: current.totalRows,
      });
      console.log('DataContext: Dataset uploaded and set successfully');
      return current;
    } catch (error) {
      console.log('DataContext: Upload error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(async () => {
    setIsLoading(true);
    try {
      await datasetApi.clear();
      setDataset(null);
      analyticsTracker.trackFeature("dataset_clear");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const parsed: ParsedData | null = useMemo(
    () =>
      dataset
        ? {
            headers: dataset.headers,
            rows: dataset.previewRows.map(row => row.map(cell => String(cell))),
            totalRows: dataset.totalRows,
          }
        : null,
    [dataset],
  );
  const patterns = useAnalytics(dataset, columnHints);
  const { predictionChart, predictionData } = usePrediction(dataset, predictionTarget ?? undefined, 5);

  const fileName = dataset?.fileName || "";

  const value = useMemo(
    () => ({
      dataset,
      parsed,
      patterns,
      predictionChart,
      predictionData,
      fileName,
      isLoading,
      uploadDataset,
      clearData,
      refreshDataset,
    }),
    [dataset, parsed, patterns, predictionChart, predictionData, fileName, isLoading, uploadDataset, clearData, refreshDataset],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataset = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataset must be used within DataProvider");
  }
  return context;
};
