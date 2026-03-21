import { TrendingUp, Users, DollarSign, Activity, Lightbulb } from "lucide-react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import KpiCard from "@/features/dashboard/components/kpi/KpiCard";
import { motion } from "framer-motion";
import { useDataset } from "@/shared/data/DataContext";

export default function Dashboard() {
  const { dataset, parsed, fileName } = useDataset();
  const summary = dataset?.summary;

  const activeKpis = summary?.kpis ?? [];
  const activeCharts = summary?.chartSuggestions ?? [];
  const primaryCharts = activeCharts.slice(0, 4);
  const secondaryCharts = activeCharts.slice(4);
  const activeInsights = summary?.insights ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {dataset ? `Analyzing ${dataset.fileName}` : "Upload a dataset to generate real analytics."}
        </p>
      </div>
      {parsed && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">Analysis Data</h2>
            <p className="text-xs text-gray-500 mt-1">
              {fileName || "Uploaded dataset"} | {parsed.headers.length} columns | {parsed.totalRows.toLocaleString()} rows
            </p>
          </div>
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full data-grid">
              <thead>
                <tr className="bg-gray-50">
                  {parsed.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 25).map((row, i) => (
                  <tr key={i} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">
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
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-gray-900">AI Insights</h3>
            </div>
            <div className="space-y-3">
              {activeInsights.map((insight, i) => (
                <div key={i} className="flex gap-2">
                  <div className={`w-1 rounded-full shrink-0 ${
                    i === 0 ? "bg-chart-cyan" :
                    i === 1 ? "bg-chart-amber" : "bg-chart-emerald"
                  }`} />
                  <p className="text-xs text-gray-700 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
