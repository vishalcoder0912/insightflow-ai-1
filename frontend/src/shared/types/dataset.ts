export interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface DatasetColumnSummary {
  name: string;
  filled: number;
  unique: number;
  sampleValues: string[];
  numeric: boolean;
  min?: number;
  max?: number;
  average?: number;
  sum?: number;
}

export interface DatasetKpi {
  label: string;
  value: string;
  helperText: string;
}

export interface DatasetChart {
  title: string;
  type: "bar" | "line" | "pie" | "area" | "scatter";
  dataKey: string;
  data: Array<{
    name?: string;
    value?: number;
    label?: string | number;
    x?: string | number;
    y?: number;
  }>;
}

export interface DatasetSummary {
  rowCount: number;
  columnCount: number;
  columns: DatasetColumnSummary[];
  kpis: DatasetKpi[];
  insights: string[];
  chartSuggestions: DatasetChart[];
}

export interface DatasetRecord {
  id: string;
  fileName: string;
  uploadedAt: string;
  headers: string[];
  totalRows: number;
  previewRows: string[][];
  summary: DatasetSummary;
}

export interface ChatResponse {
  answer: string;
  sql: string;
  insights: string[];
  responseType?: ChatResponseType;
  chart?: ChatChartPayload | DatasetChart | null;
  table?: ChatTablePayload | null;
  meta?: {
    queryIntent?: string;
    derivedFrom?: string;
    filterKeyword?: string;
  };
  source: "gemini" | "fallback";
  dataset: {
    fileName: string;
    totalRows: number;
    headers: string[];
  };
}

export type ChatResponseType =
  | "text"
  | "table"
  | "chart"
  | "text+chart"
  | "text+table"
  | "text+chart+table";

export interface ChatChartPayload {
  title: string;
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  xKey: string;
  yKey: string;
  rows: Array<Record<string, string | number>>;
  config?: {
    xLabel?: string;
    yLabel?: string;
    palette?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    curved?: boolean;
  };
}

export interface ChatTablePayload {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}
