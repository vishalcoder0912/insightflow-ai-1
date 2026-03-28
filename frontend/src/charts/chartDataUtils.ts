import type { ChartType } from "@/features/dashboard/components/charts/chartOptions";

type Primitive = string | number | null | undefined;

export interface ChartDatasetInput {
  label?: string;
  data?: Primitive[];
}

export interface LabelDatasetChartInput {
  labels?: Primitive[];
  datasets?: ChartDatasetInput[];
}

export interface ChartValidationError {
  error: string;
}

export interface NormalizedChartRow {
  [key: string]: string | number | null;
}

const CHART_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_CHART_DEBUG === "true";

const debugChart = (payload: Record<string, unknown>) => {
  if (!CHART_DEBUG_ENABLED) return;
  console.log("Chart Debug:", payload);
};

const isFiniteNumber = (value: unknown) => Number.isFinite(Number(value));

const normalizeLabel = (value: Primitive, index: number) => {
  const resolved = value == null || value === "" ? `Item ${index + 1}` : String(value);
  return resolved;
};

const parseNumeric = (value: Primitive): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  const isAccountingNegative = raw.startsWith("(") && raw.endsWith(")");
  const core = isAccountingNegative ? raw.slice(1, -1) : raw;
  let cleaned = core.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  if (isAccountingNegative && cleaned && !cleaned.startsWith("-")) {
    cleaned = `-${cleaned}`;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeNumber = (value: Primitive) => parseNumeric(value) ?? 0;

const normalizeSeriesNumber = (value: Primitive) => parseNumeric(value);

export const validateDataset = (
  dataset: Array<Record<string, unknown>> | null | undefined,
  requiredFields: string[] = [],
): true | ChartValidationError => {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return { error: "Dataset invalid or empty" };
  }

  if (
    requiredFields.length > 0 &&
    !dataset.some((item) => requiredFields.every((field) => item && Object.prototype.hasOwnProperty.call(item, field)))
  ) {
    return { error: "Dataset invalid or empty" };
  }

  return true;
};

export const normalizeLabelDatasetChart = (
  chartData: LabelDatasetChartInput | null | undefined,
  xKey = "name",
  yKey = "value",
): NormalizedChartRow[] | ChartValidationError => {
  if (!chartData?.labels || !Array.isArray(chartData.labels) || !Array.isArray(chartData.datasets)) {
    return { error: "No data available for selected chart" };
  }

  const primaryDataset = chartData.datasets[0];
  if (!primaryDataset?.data || !Array.isArray(primaryDataset.data)) {
    return { error: "No data available for selected chart" };
  }

  const alignedLength = Math.min(chartData.labels.length, primaryDataset.data.length);
  if (alignedLength === 0) {
    return { error: "No data available for selected chart" };
  }

  const rows = Array.from({ length: alignedLength }, (_, index) => ({
    [xKey]: normalizeLabel(chartData.labels?.[index], index),
    [yKey]: normalizeNumber(primaryDataset.data?.[index]),
  })).filter((row) => row[xKey] !== "" && isFiniteNumber(row[yKey]));

  if (!rows.length) {
    return { error: "No data available for selected chart" };
  }

  debugChart({
    labels: chartData.labels.slice(0, alignedLength),
    datasets: chartData.datasets.map((dataset) => dataset.data?.slice(0, alignedLength) ?? []),
  });

  return rows;
};

export const normalizeRechartsRows = (
  data: Array<Record<string, unknown>> | LabelDatasetChartInput | null | undefined,
  xKey: string,
  yKey: string,
  chartType: ChartType,
  seriesKeys: string[] = [],
): NormalizedChartRow[] | ChartValidationError => {
  if (!data) {
    return { error: "No data available for selected chart" };
  }

  if (!Array.isArray(data)) {
    return normalizeLabelDatasetChart(data, xKey, yKey);
  }

  const validation = validateDataset(data);
  if (validation !== true) {
    return validation;
  }

  const normalized = data
    .map((item, index) => {
      const labelSource = (item[xKey] as Primitive) ?? (item.name as Primitive) ?? (item.label as Primitive) ?? index + 1;
      const valueSource = (item[yKey] as Primitive) ?? (item.value as Primitive) ?? (item.y as Primitive) ?? 0;
      const row: NormalizedChartRow = {
        ...item,
        [xKey]: normalizeLabel(labelSource, index),
      };

      if (seriesKeys.length > 0) {
        seriesKeys.forEach((seriesKey) => {
          row[seriesKey] = normalizeSeriesNumber(item[seriesKey] as Primitive);
        });
      } else {
        row[yKey] = normalizeNumber(valueSource);
      }

      return row;
    })
    .filter((item) => {
      if (item[xKey] === "") return false;
      if (seriesKeys.length > 0) {
        return seriesKeys.some((seriesKey) => Number.isFinite(Number(item[seriesKey])));
      }
      return Number.isFinite(Number(item[yKey]));
    });

  if (!normalized.length) {
    return { error: "No data available for selected chart" };
  }

  const result =
    chartType === "pie"
      ? normalized.filter((item) => Number(item[yKey]) > 0)
      : normalized;

  if (!result.length) {
    return { error: "No data available for selected chart" };
  }

  debugChart({
    datasetLength: data.length,
    labels: result.map((item) => item[xKey]),
    values: result.map((item) => item[yKey]),
  });

  return result as NormalizedChartRow[];
};

