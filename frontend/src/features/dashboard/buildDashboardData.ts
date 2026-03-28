import type { DatasetRecord } from "@/shared/types/dataset";

export interface DashboardChartRow {
  category: string;
  value: number;
}

const isNumericValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed);
};

export const buildDashboardData = (dataset: DatasetRecord | null | undefined): DashboardChartRow[] => {
  if (!dataset?.headers?.length || !Array.isArray(dataset.previewRows)) {
    return [];
  }

  const headers = dataset.headers.map((header) => String(header));
  const summaryColumns = Array.isArray(dataset.summary?.columns) ? dataset.summary.columns : [];
  const numericColumn =
    summaryColumns.find((column) => column.numeric)?.name ||
    headers.find((header, index) =>
      dataset.previewRows.some((row) => isNumericValue(row?.[index])),
    ) ||
    headers[1];
  const categoryColumn =
    summaryColumns.find((column) => !column.numeric)?.name ||
    headers.find((header) => header !== numericColumn) ||
    headers[0];

  const categoryIndex = Math.max(headers.indexOf(categoryColumn), 0);
  const numericIndex = Math.max(headers.indexOf(numericColumn), 0);

  return dataset.previewRows
    .map((row, index) => {
      const rawCategory = row?.[categoryIndex] ?? `Row ${index + 1}`;
      const rawValue = row?.[numericIndex];
      const numericValue = Number(rawValue);

      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        category: String(rawCategory || `Row ${index + 1}`),
        value: numericValue,
      };
    })
    .filter((item): item is DashboardChartRow => Boolean(item));
};
