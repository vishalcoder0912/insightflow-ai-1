import { memo, useEffect, useId, useMemo, useState } from "react";
import { ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Palette, Type, ChevronDown } from "lucide-react";
import { CHART_TYPE_OPTIONS, PRESET_PALETTES, resolvePaletteName, type ChartType } from "@/features/dashboard/components/charts/chartOptions";
import { ChartRenderer } from "@/charts/ChartRenderer";
import { normalizeRechartsRows, type LabelDatasetChartInput, type NormalizedChartRow } from "@/charts/chartDataUtils";

export interface ChartConfig {
  xLabel?: string;
  yLabel?: string;
  palette?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  curved?: boolean;
  seriesKeys?: string[];
}

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  data: Array<Record<string, unknown>> | LabelDatasetChartInput;
  dataKey: string;
  xKey?: string;
  config?: ChartConfig;
  editable?: boolean;
  hideHeader?: boolean;
  chartHeightClass?: string;
}

function ChartPanel({
  title,
  subtitle,
  type: initialType,
  data,
  dataKey,
  xKey = "name",
  config: initialConfig,
  editable = true,
  hideHeader = false,
  chartHeightClass,
}: ChartPanelProps) {
  const gradId = useId();
  const [showSettings, setShowSettings] = useState(false);
  const [chartType, setChartType] = useState<ChartType>(initialType);
  const [config, setConfig] = useState<ChartConfig>({
    xLabel: "",
    yLabel: "",
    showGrid: true,
    showLegend: false,
    curved: true,
    ...initialConfig,
    palette: resolvePaletteName(initialConfig?.palette),
  });

  useEffect(() => {
    setChartType(initialType);
  }, [initialType]);

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      ...initialConfig,
      palette: resolvePaletteName(initialConfig?.palette ?? prev.palette),
    }));
  }, [initialConfig]);

  const normalizedData = useMemo(
    () => normalizeRechartsRows(data, xKey, dataKey, chartType, config.seriesKeys),
    [chartType, config.seriesKeys, data, dataKey, xKey],
  );
  
  const hasData = !("error" in normalizedData) && normalizedData.length > 0;
  const shouldRenderChart = hasData;

  const chartRows = useMemo<NormalizedChartRow[]>(
    () => (hasData ? normalizedData : []),
    [hasData, normalizedData],
  );

  const renderedChart = useMemo(
    () =>
      shouldRenderChart ? <ChartRenderer chartType={chartType} data={chartRows} dataKey={dataKey} xKey={xKey} config={config} gradId={gradId} /> : null,
    [chartRows, chartType, config, dataKey, gradId, shouldRenderChart, xKey],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-4 shadow-sm transition-all hover:scale-[1.01] hover:border-primary/40 hover:shadow-[0_0_30px_hsl(217_91%_60%_/_0.2)]"
    >
      {!hideHeader && (
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {editable && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-md transition-colors ${
                showSettings
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-3 bg-muted/40 rounded-lg space-y-3 text-xs border border-border">
              {/* Chart type */}
              <div>
                <label className="text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3" /> Chart Type
                </label>
                <div className="flex flex-wrap gap-1">
                  {CHART_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setChartType(opt.value)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        chartType === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Axis labels */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Type className="w-3 h-3" /> X Label
                  </label>
                  <input
                    value={config.xLabel}
                    onChange={(e) => setConfig((c) => ({ ...c, xLabel: e.target.value }))}
                    placeholder="e.g. Month"
                    className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Type className="w-3 h-3" /> Y Label
                  </label>
                  <input
                    value={config.yLabel}
                    onChange={(e) => setConfig((c) => ({ ...c, yLabel: e.target.value }))}
                    placeholder="e.g. Revenue ($)"
                    className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Color palette */}
              <div>
                <label className="text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Color Palette
                </label>
                <div className="flex gap-2">
                  {Object.entries(PRESET_PALETTES).map(([name, pal]) => (
                    <button
                      key={name}
                      onClick={() => setConfig((c) => ({ ...c, palette: name }))}
                      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        config.palette === name
                          ? "bg-primary/15 ring-1 ring-primary"
                          : "bg-card border border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex -space-x-0.5">
                        {pal.slice(0, 3).map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-full border border-background" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                  <input type="checkbox" checked={config.showGrid} onChange={(e) => setConfig((c) => ({ ...c, showGrid: e.target.checked }))} className="rounded border-border bg-card" />
                  <span>Grid</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                  <input type="checkbox" checked={config.showLegend} onChange={(e) => setConfig((c) => ({ ...c, showLegend: e.target.checked }))} className="rounded border-border bg-card" />
                  <span>Legend</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                  <input type="checkbox" checked={config.curved} onChange={(e) => setConfig((c) => ({ ...c, curved: e.target.checked }))} className="rounded border-border bg-card" />
                  <span>Curved</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={chartHeightClass || "h-52"}>
        {shouldRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderedChart}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            No data available
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(ChartPanel);
