import { TrendingUp, Users, DollarSign, Activity, Lightbulb, ChevronDown } from "lucide-react";
import KpiCard from "@/features/dashboard/components/kpi/KpiCard";
import { motion } from "framer-motion";
import { useDataset } from "@/shared/data/DataContext";
import { Suspense, lazy, useMemo, useState } from "react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import type { DatasetChart } from "@/shared/types/dataset";
import { resolvePaletteName } from "@/features/dashboard/components/charts/chartOptions";

// Mock analytics functions
const useAnalytics = () => [];
const usePrediction = () => ({ predictionChart: null, predictionData: [] });
const getPredictionTarget = () => null;
const getColumnHints = () => [];

const DashboardChatPanel = lazy(() => import("@/features/dashboard/components/DashboardChatPanel"));

const chartPanelFallback = (
  <div className="w-full rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
    <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      Loading chart...
    </div>
  </div>
);

const dashboardChatFallback = (
  <div className="rounded-2xl border border-border/70 bg-card/70 p-5 text-sm text-muted-foreground">
    Loading chat...
  </div>
);

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const isFiniteNumber = (value: string) => {
  if (!value || value === "") return false;
  const normalized = value.replace(/,/g, "");
  return Number.isFinite(Number(normalized));
};

const parseNumber = (value: string) => {
  if (!value || value === "") return null;
  const normalized = value.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const isDateLike = (value: string) => {
  if (!value || value === "") return false;
  if (/^\d{4}$/.test(value)) return true;
  return Number.isFinite(Date.parse(value));
};

const topEntries = (map: Map<string, number>, limit = 12) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

const hasRenderableChartData = (chart: DatasetChart) => {
  if (!chart) return false;

  if (Array.isArray(chart.data) && chart.data.length > 0) {
    return chart.data.some((point) => {
      const yCandidate =
        point[chart.dataKey as keyof typeof point] ??
        point.value ??
        point.y;
      return Number.isFinite(Number(yCandidate));
    });
  }

  if (Array.isArray(chart.labels) && Array.isArray(chart.datasets) && chart.labels.length > 0) {
    return chart.datasets.some((dataset) =>
      Array.isArray(dataset.data) &&
      dataset.data.some((value) => Number.isFinite(Number(value))),
    );
  }

  return false;
};

const getChartPayload = (chart: DatasetChart) =>
  Array.isArray(chart.data) && chart.data.length > 0
    ? chart.data
    : {
        labels: chart.labels ?? [],
        datasets: chart.datasets ?? [],
      };

const getChartConfig = (chart: DatasetChart) => ({
  xLabel: chart.config?.xLabel ?? chart.xKey ?? "Category",
  yLabel: chart.config?.yLabel ?? chart.dataKey ?? "Value",
  palette: resolvePaletteName(chart.config?.palette),
  showGrid: chart.config?.showGrid ?? true,
  showLegend: chart.config?.showLegend ?? chart.type === "pie",
  curved: chart.config?.curved ?? (chart.type === "line" || chart.type === "area"),
});

const buildClientCharts = (headers: string[], rows: string[][]): DatasetChart[] => {
  if (!headers.length || !rows.length) return [];

  const colStats = headers.map((header, index) => {
    const values = rows.map((row) => normalizeValue(row[index]));
    const filled = values.filter(Boolean);
    const unique = new Set(filled);
    const numericCount = filled.filter((value) => isFiniteNumber(value)).length;
    const dateCount = filled.filter((value) => isDateLike(value)).length;
    const numericRatio = filled.length ? numericCount / filled.length : 0;
    const dateRatio = filled.length ? dateCount / filled.length : 0;
    return {
      header,
      index,
      values,
      filledCount: filled.length,
      uniqueCount: unique.size,
      numericRatio,
      dateRatio,
      isNumeric: numericRatio >= 0.7,
      isDate: dateRatio >= 0.7 || /(date|year|month|time)/i.test(header),
      isCategorical:
        filled.length > 0 &&
        unique.size >= 2 &&
        unique.size <= Math.min(20, Math.max(6, Math.floor(filled.length * 0.5))),
    };
  });

  const numeric = colStats.filter((column) => column.isNumeric);
  const categorical = colStats.filter((column) => column.isCategorical && !column.isNumeric);
  const dates = colStats.filter((column) => column.isDate);

  const charts: DatasetChart[] = [];
  const pushChart = (chart: DatasetChart) => {
    if (!chart.data.length) return;
    if (charts.some((existing) => existing.title === chart.title)) return;
    charts.push(chart);
  };

  if (dates[0] && numeric[0]) {
    const dateCol = dates[0];
    const metricCol = numeric[0];
    const aggregated = new Map<string, number>();
    rows.forEach((row) => {
      const dateRaw = normalizeValue(row[dateCol.index]);
      const value = parseNumber(normalizeValue(row[metricCol.index]));
      if (!dateRaw || value == null) return;
      const key = /^\d{4}$/.test(dateRaw)
        ? dateRaw
        : new Date(dateRaw).toISOString().slice(0, 10);
      aggregated.set(key, (aggregated.get(key) || 0) + value);
    });
    const data = [...aggregated.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([name, value]) => ({ name, value }));
    pushChart({
      title: `${metricCol.header} Over Time`,
      type: "line",
      dataKey: "value",
      data,
    });
  }

  if (categorical[0]) {
    const catCol = categorical[0];
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = normalizeValue(row[catCol.index]);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const data = topEntries(counts, 10).map(([name, value]) => ({ name, value }));
    pushChart({
      title: `${catCol.header} Distribution`,
      type: data.length <= 6 ? "pie" : "bar",
      dataKey: "value",
      data,
    });
  }

  if (categorical[0] && numeric[0]) {
    const catCol = categorical[0];
    const metricCol = numeric[0];
    const totals = new Map<string, { sum: number; count: number }>();
    rows.forEach((row) => {
      const key = normalizeValue(row[catCol.index]);
      const value = parseNumber(normalizeValue(row[metricCol.index]));
      if (!key || value == null) return;
      const current = totals.get(key) || { sum: 0, count: 0 };
      totals.set(key, { sum: current.sum + value, count: current.count + 1 });
    });
    const data = [...totals.entries()]
      .map(([name, meta]) => ({ name, value: meta.sum / Math.max(meta.count, 1) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    pushChart({
      title: `Average ${metricCol.header} by ${catCol.header}`,
      type: "bar",
      dataKey: "value",
      data,
    });
  }

  if (numeric[0] && numeric[1]) {
    const xCol = numeric[0];
    const yCol = numeric[1];
    const data = rows
      .map((row) => {
        const x = parseNumber(normalizeValue(row[xCol.index]));
        const y = parseNumber(normalizeValue(row[yCol.index]));
        if (x == null || y == null) return null;
        return { name: String(x), value: y, x, y };
      })
      .filter((item): item is { name: string; value: number; x: number; y: number } => !!item)
      .slice(0, 150);
    pushChart({
      title: `${xCol.header} vs ${yCol.header}`,
      type: "scatter",
      dataKey: "value",
      data,
    });
  }

  if (numeric[0]) {
    const metricCol = numeric[0];
    const values = rows
      .map((row) => parseNumber(normalizeValue(row[metricCol.index])))
      .filter((value): value is number => value != null);
    if (values.length >= 3) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bucketCount = Math.min(8, Math.max(4, Math.floor(Math.sqrt(values.length))));
      const span = max - min || 1;
      const buckets = Array.from({ length: bucketCount }, (_, idx) => ({
        name: `${(min + (idx * span) / bucketCount).toFixed(1)}-${(min + ((idx + 1) * span) / bucketCount).toFixed(1)}`,
        value: 0,
      }));
      values.forEach((value) => {
        const ratio = (value - min) / span;
        const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)));
        buckets[index].value += 1;
      });
      pushChart({
        title: `${metricCol.header} Distribution`,
        type: "bar",
        dataKey: "value",
        data: buckets,
      });
    }
  }

  return charts.slice(0, 6);
};

export default function Dashboard() {
  const { dataset, parsed, isLoading } = useDataset();
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Mock analytics data
  const patterns = useAnalytics(dataset, getColumnHints(dataset));
  const { predictionChart, predictionData } = usePrediction(dataset, getPredictionTarget(dataset));

  // Debug: Log what data we're receiving
  console.log('Dashboard: Received data:', {
    dataset: dataset ? {
      fileName: dataset.fileName,
      totalRows: dataset.totalRows,
      chartSuggestionsCount: dataset.summary?.chartSuggestions?.length || 0
    } : null,
    parsed: parsed ? {
      headers: parsed.headers,
      rowCount: parsed.totalRows,
      columnCount: parsed.headers.length
    } : null,
    isLoading
  });

  // Use dataset.summary directly instead of local state
  const summary = dataset?.summary ?? null;
  const fileName = dataset?.fileName || "";

  const activeKpis = useMemo(() => summary?.kpis ?? [], [summary]);
  const activeCharts = useMemo(() => {
    const backendCharts = summary?.chartSuggestions ?? [];
    const validBackendCharts = backendCharts.filter(hasRenderableChartData);
    console.log('Dashboard: Chart calculation:', {
      backendChartsCount: backendCharts.length,
      validBackendChartsCount: validBackendCharts.length,
      hasDataset: !!dataset,
      hasParsed: !!parsed,
      summaryCharts: backendCharts.map(c => ({ title: c.title, dataCount: c.data?.length || 0 }))
    });
    
    if (validBackendCharts.length > 0) {
      return validBackendCharts;
    }
    if (!parsed) {
      return [];
    }
    return buildClientCharts(parsed.headers, parsed.rows);
  }, [parsed, summary, dataset]);
  const primaryCharts = useMemo(() => activeCharts.slice(0, 4), [activeCharts]);
  const secondaryCharts = useMemo(() => activeCharts.slice(4), [activeCharts]);
  const activeInsights = useMemo(() => summary?.insights ?? [], [summary]);
  const advancedInsights = summary?.advancedInsights;
  const columns = useMemo(() => summary?.columns ?? [], [summary]);
  const domain = summary?.domain; // Define domain at component level
  const generatedChartDescription = useMemo(() => {
    if (!activeCharts.length) {
      return "No chartable fields were detected yet for the current CSV.";
    }

    const domainLabel = domain?.label ? `${domain.label.toLowerCase()} ` : "";
    return `Showing ${activeCharts.length} auto-generated chart${activeCharts.length === 1 ? "" : "s"} based on the detected ${domainLabel}fields in your uploaded CSV.`;
  }, [activeCharts.length, domain?.label]);

  return (
    <div className="min-h-full">
      <div className="dashboard-ambient">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {dataset ? `Analyzing ${dataset.fileName}` : "Upload a dataset to generate real analytics."}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-6">
              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-5"
                >
                  <button
                    onClick={() => setSummaryOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">Dataset Summary</p>
                      <p className="text-xs text-muted-foreground">
                        {summary.rowCount.toLocaleString()} rows | {summary.columnCount} columns
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
                  </button>

                  {summaryOpen && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Detected Dataset Type
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {domain ? `${domain.label} Data` : "General Dataset"}
                            </span>
                            {domain && (
                              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                {Math.round(domain.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                            {domain?.description || "The analysis engine is using the detected numeric, categorical, and date fields from your uploaded CSV."}
                          </p>
                          {domain?.matchedColumns?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {domain.matchedColumns.map((column) => (
                                <span
                                  key={column}
                                  className="rounded-full border border-border bg-background/70 px-2 py-1 text-[11px] text-muted-foreground"
                                >
                                  {column}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Columns</p>
                        <div className="flex flex-wrap gap-2">
                          {columns.map((col) => (
                            <span key={col.name} className="text-xs px-2 py-1 rounded-full bg-muted/40 text-muted-foreground border border-border">
                              {col.name}
                              {col.detectedType ? ` • ${col.detectedType}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Insights</p>
                        <div className="space-y-2">
                          {activeInsights.slice(0, 3).map((insight, i) => (
                            <div key={i} className="flex gap-2">
                              <div className={`w-1 rounded-full shrink-0 ${
                                i === 0 ? "bg-chart-cyan" :
                                i === 1 ? "bg-chart-amber" : "bg-chart-emerald"
                              }`} />
                              <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                            </div>
                          ))}
                          {activeInsights.length === 0 && (
                            <p className="text-xs text-muted-foreground">No AI insights available yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeKpis.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
                  {activeKpis.slice(0, 4).map((kpi, index) => (
                    <KpiCard
                      key={kpi.label}
                      label={kpi.label}
                      value={kpi.value}
                      change={kpi.helperText}
                      changeType={index === 2 ? "negative" : index === 3 ? "neutral" : "positive"}
                      icon={[DollarSign, Activity, Users, TrendingUp][index] || TrendingUp}
                    />
                  ))}
                </div>
              )}

              {(activeCharts.length > 0 || parsed) && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-medium text-foreground">Generated Charts</h2>
                    <p className="text-xs text-muted-foreground">
                      {generatedChartDescription}
                    </p>
                  </div>
                </div>
              )}

              {primaryCharts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6" data-testid="generated-charts-primary">
                  {primaryCharts.map((chart) => (
                    <Suspense key={chart.title} fallback={chartPanelFallback}>
                      <ChartPanel
                        title={chart.title}
                        type={chart.type}
                        data={getChartPayload(chart)}
                        dataKey={chart.dataKey}
                        xKey={chart.xKey}
                        config={getChartConfig(chart)}
                      />
                    </Suspense>
                  ))}
                </div>
              )}

              {secondaryCharts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6" data-testid="generated-charts-secondary">
                  {secondaryCharts.map((chart) => (
                    <Suspense key={chart.title} fallback={chartPanelFallback}>
                      <ChartPanel
                        title={chart.title}
                        type={chart.type}
                        data={getChartPayload(chart)}
                        dataKey={chart.dataKey}
                        xKey={chart.xKey}
                        config={getChartConfig(chart)}
                      />
                    </Suspense>
                  ))}
                </div>
              )}

              {parsed && (
                <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/70 overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/70">
                    <h2 className="text-sm font-medium text-foreground">Analysis Data</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fileName || "Uploaded dataset"} | {parsed.headers.length} columns | {parsed.totalRows.toLocaleString()} rows
                    </p>
                  </div>
                  <div className="overflow-auto max-h-[260px] md:max-h-[300px] lg:max-h-[320px]">
                    <table className="w-full min-w-[640px] data-grid">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr>
                          {parsed.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 25).map((row, i) => (
                          <tr key={i} className="border-t border-border/70 hover:bg-muted/20 transition-colors">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 text-xs text-secondary-foreground whitespace-nowrap max-w-[200px] truncate">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeInsights.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-4 h-4 text-accent" />
                      <h3 className="text-sm font-medium text-foreground">AI Insights</h3>
                    </div>
                    <div className="space-y-3">
                      {activeInsights.map((insight, i) => (
                        <div key={i} className="flex gap-2">
                          <div className={`w-1 rounded-full shrink-0 ${
                            i === 0 ? "bg-chart-cyan" :
                            i === 1 ? "bg-chart-amber" : "bg-chart-emerald"
                          }`} />
                          <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}

              {summary && activeCharts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground">
                  The dataset loaded successfully, but no chartable columns were detected yet. Try a CSV with at least one categorical or numeric field with repeated values.
                </div>
              )}

              {advancedInsights && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {[
                    {
                      title: "Descriptive",
                      items: advancedInsights.descriptive,
                    },
                    {
                      title: "Diagnostic",
                      items: advancedInsights.diagnostic,
                    },
                    {
                      title: "Prescriptive",
                      items: advancedInsights.prescriptive,
                    },
                  ].map((section, sectionIndex) => (
                    <motion.div
                      key={section.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-5"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-4 h-4 text-accent" />
                        <div>
                          <h3 className="text-sm font-medium text-foreground">
                            {sectionIndex === 0 ? "Advanced Insights" : section.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">{section.title}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {section.items.map((insight, i) => (
                          <div key={`${section.title}-${i}`} className="flex gap-2">
                            <div
                              className={`w-1 rounded-full shrink-0 ${
                                i % 3 === 0 ? "bg-chart-cyan" : i % 3 === 1 ? "bg-chart-amber" : "bg-chart-emerald"
                              }`}
                            />
                            <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {patterns.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {patterns.map((pattern, index) => (
                    <motion.div
                      key={`${pattern.type}-${index}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-5"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-accent" />
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Detected Pattern</h3>
                          <p className="text-xs text-muted-foreground capitalize">{pattern.type}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{pattern.message}</p>
                      <p className="mt-3 text-xs font-medium text-foreground">
                        Confidence {(pattern.confidence * 100).toFixed(0)}%
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              {predictionChart && predictionData.length > 0 && (
                <Suspense fallback={chartPanelFallback}>
                  <ChartPanel
                    title="Prediction Chart"
                    subtitle={
                      predictionChart.confidence != null
                        ? `Regression confidence ${(predictionChart.confidence * 100).toFixed(0)}%`
                        : "Linear regression forecast"
                    }
                    type="line"
                    data={predictionData}
                    dataKey="actual"
                    xKey="name"
                    config={{
                      xLabel: "Year",
                      yLabel: "Count",
                      palette: "Mixed",
                      showGrid: true,
                      showLegend: true,
                      curved: true,
                      seriesKeys: ["actual", "predicted"],
                    }}
                  />
                </Suspense>
              )}
            </div>

            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start h-fit">
              <Suspense fallback={dashboardChatFallback}>
                <DashboardChatPanel className="lg:h-[calc(100vh-8.5rem)] rounded-2xl shadow-sm" />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
