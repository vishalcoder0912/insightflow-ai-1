import { useState, useId } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Area, AreaChart, ScatterChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Palette, Type, ChevronDown } from "lucide-react";

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "composed";

const PRESET_PALETTES: Record<string, string[]> = {
  Cyan: ["hsl(187,85%,53%)", "hsl(200,80%,55%)", "hsl(170,70%,50%)", "hsl(210,75%,60%)", "hsl(195,80%,45%)"],
  Amber: ["hsl(38,92%,60%)", "hsl(25,90%,55%)", "hsl(45,88%,52%)", "hsl(15,85%,58%)", "hsl(50,80%,48%)"],
  Emerald: ["hsl(160,70%,45%)", "hsl(145,65%,50%)", "hsl(170,60%,40%)", "hsl(135,55%,55%)", "hsl(180,65%,42%)"],
  Rose: ["hsl(350,80%,60%)", "hsl(340,75%,55%)", "hsl(0,70%,58%)", "hsl(330,72%,52%)", "hsl(10,78%,56%)"],
  Mixed: ["hsl(187,85%,53%)", "hsl(38,92%,60%)", "hsl(160,70%,45%)", "hsl(350,80%,60%)", "hsl(270,70%,60%)"],
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(222 40% 10%)",
    border: "1px solid hsl(217 30% 15%)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "hsl(210 20% 92%)",
  },
};

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "scatter", label: "Scatter" },
  { value: "radar", label: "Radar" },
  { value: "composed", label: "Composed" },
];

export interface ChartConfig {
  xLabel?: string;
  yLabel?: string;
  palette?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  curved?: boolean;
}

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  data: any[];
  dataKey: string;
  xKey?: string;
  config?: ChartConfig;
  editable?: boolean;
}

export default function ChartPanel({
  title,
  subtitle,
  type: initialType,
  data,
  dataKey,
  xKey = "name",
  config: initialConfig,
  editable = true,
}: ChartPanelProps) {
  const gradId = useId();
  const [showSettings, setShowSettings] = useState(false);
  const [chartType, setChartType] = useState<ChartType>(initialType);
  const [config, setConfig] = useState<ChartConfig>({
    xLabel: "",
    yLabel: "",
    palette: "Mixed",
    showGrid: true,
    showLegend: false,
    curved: true,
    ...initialConfig,
  });

  const colors = PRESET_PALETTES[config.palette || "Mixed"];
  const curveType = config.curved ? "monotone" : "linear";

  const axisProps = {
    tick: { fontSize: 11, fill: "hsl(215 16% 65%)" },
    axisLine: false as const,
    tickLine: false as const,
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
            <XAxis dataKey={xKey} {...axisProps} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <YAxis {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <Tooltip {...tooltipStyle} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
            <XAxis dataKey={xKey} {...axisProps} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <YAxis {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <Tooltip {...tooltipStyle} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Line type={curveType} dataKey={dataKey} stroke={colors[0]} strokeWidth={2} dot={{ r: 3, fill: colors[0] }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
            <XAxis dataKey={xKey} {...axisProps} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <YAxis {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <Tooltip {...tooltipStyle} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type={curveType} dataKey={dataKey} stroke={colors[0]} fill={`url(#${gradId})`} strokeWidth={2} />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Tooltip {...tooltipStyle} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Pie data={data} dataKey={dataKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
            <XAxis dataKey={xKey} type="category" {...axisProps} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <YAxis dataKey={dataKey} type="number" {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            <Tooltip {...tooltipStyle} />
            <Scatter data={data} fill={colors[0]} />
          </ScatterChart>
        );
      case "radar":
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="hsl(217 30% 18%)" />
            <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#4b5563" }} />
            <PolarRadiusAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
            <Tooltip {...tooltipStyle} />
            <Radar dataKey={dataKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} />
          </RadarChart>
        );
      case "composed":
        return (
          <ComposedChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Bar dataKey={dataKey} fill={colors[1]} radius={[4, 4, 0, 0]} opacity={0.5} />
            <Line type={curveType} dataKey={dataKey} stroke={colors[0]} strokeWidth={2} dot={false} />
          </ComposedChart>
        );
    }
  };

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-sm rounded-2xl border border-border/70 p-4 shadow-sm transition-all hover:scale-[1.01] hover:border-primary/40 hover:shadow-[0_0_30px_hsl(217_91%_60%_/_0.2)]"
    >
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

      <div className="h-52">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
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


