import { TrendingUp, Users, DollarSign, Activity, Lightbulb, ChevronDown } from "lucide-react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import KpiCard from "@/features/dashboard/components/kpi/KpiCard";
import { motion } from "framer-motion";
import { useDataset } from "@/shared/data/DataContext";
import { useState } from "react";
import DashboardChatPanel from "@/features/dashboard/components/DashboardChatPanel";

export default function Dashboard() {
  const { dataset, parsed, fileName } = useDataset();
  const summary = dataset?.summary;
  const [summaryOpen, setSummaryOpen] = useState(true);

  const activeKpis = summary?.kpis ?? [];
  const activeCharts = summary?.chartSuggestions ?? [];
  const primaryCharts = activeCharts.slice(0, 4);
  const secondaryCharts = activeCharts.slice(4);
  const activeInsights = summary?.insights ?? [];
  const columns = summary?.columns ?? [];

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6 dashboard-ambient">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {dataset ? `Analyzing ${dataset.fileName}` : "Upload a dataset to generate real analytics."}
            </p>
          </div>

          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-4"
            >
              <button
                onClick={() => setSummaryOpen((prev) => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">Dataset Summary</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.rowCount.toLocaleString()} rows · {summary.columnCount} columns
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
              </button>

              {summaryOpen && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Columns</p>
                    <div className="flex flex-wrap gap-2">
                      {columns.map((col) => (
                        <span key={col.name} className="text-xs px-2 py-1 rounded-full bg-muted/40 text-muted-foreground border border-border">
                          {col.name}
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

          {parsed && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/70 overflow-hidden">
              <div className="p-4 border-b border-border/70">
                <h2 className="text-sm font-medium text-foreground">Analysis Data</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {fileName || "Uploaded dataset"} | {parsed.headers.length} columns | {parsed.totalRows.toLocaleString()} rows
                </p>
              </div>
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full data-grid">
                  <thead>
                    <tr className="bg-muted/30">
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

          {activeKpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

          {primaryCharts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {primaryCharts.map((chart) => (
                <ChartPanel
                  key={chart.title}
                  title={chart.title}
                  type={chart.type}
                  data={chart.data}
                  dataKey={chart.dataKey}
                  config={{ xLabel: "Category", yLabel: "Value" }}
                />
              ))}
            </div>
          )}

          {secondaryCharts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {secondaryCharts.map((chart) => (
                <ChartPanel
                  key={chart.title}
                  title={chart.title}
                  type={chart.type}
                  data={chart.data}
                  dataKey={chart.dataKey}
                  config={{ xLabel: "Category", yLabel: "Value" }}
                />
              ))}
            </div>
          )}

          {activeInsights.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-4"
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
        </div>
      </div>

      <DashboardChatPanel />
    </div>
  );
}
