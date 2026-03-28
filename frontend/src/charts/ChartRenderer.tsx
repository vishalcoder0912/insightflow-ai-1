import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PRESET_PALETTES, resolvePaletteName, type ChartType } from "@/features/dashboard/components/charts/chartOptions";
import type { NormalizedChartRow } from "@/charts/chartDataUtils";

export interface RendererChartConfig {
  xLabel?: string;
  yLabel?: string;
  palette?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  curved?: boolean;
  seriesKeys?: string[];
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(222 40% 10%)",
    border: "1px solid hsl(217 30% 15%)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "hsl(210 20% 92%)",
  },
};

interface ChartRendererProps {
  chartType: ChartType;
  data: NormalizedChartRow[];
  dataKey: string;
  xKey: string;
  config: RendererChartConfig;
  gradId: string;
}

const truncateTick = (value: string | number) => {
  const label = String(value ?? "");
  return label.length > 14 ? `${label.slice(0, 14)}...` : label;
};

const isNumericAxis = (data: NormalizedChartRow[], key: string) =>
  data.length > 0 && data.every((item) => Number.isFinite(Number(item[key])));

const shouldUseHorizontalBars = (data: NormalizedChartRow[], xKey: string) =>
  data.length > 6 || data.some((item) => String(item[xKey] ?? "").length > 10);

export function ChartRenderer({ chartType, data, dataKey, xKey, config, gradId }: ChartRendererProps) {
  const colors = PRESET_PALETTES[resolvePaletteName(config.palette)];
  const curveType = config.curved ? "monotone" : "linear";
  const numericXAxis = isNumericAxis(data, xKey);
  const horizontalBars = chartType === "bar" && !numericXAxis && shouldUseHorizontalBars(data, xKey);
  const seriesKeys = config.seriesKeys?.length ? config.seriesKeys : [dataKey];

  const axisProps = {
    tick: { fontSize: 11, fill: "hsl(215 16% 65%)" },
    axisLine: false as const,
    tickLine: false as const,
  };

  switch (chartType) {
    case "bar":
      return (
        <BarChart
          data={data}
          layout={horizontalBars ? "vertical" : "horizontal"}
          margin={horizontalBars ? { top: 8, right: 12, left: 28, bottom: 8 } : { top: 8, right: 8, left: 0, bottom: 8 }}
        >
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
          {horizontalBars ? (
            <>
              <XAxis
                type="number"
                {...axisProps}
                label={config.yLabel ? { value: config.yLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                width={110}
                {...axisProps}
                tickFormatter={truncateTick}
                label={config.xLabel ? { value: config.xLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} tickFormatter={truncateTick} minTickGap={16} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
              <YAxis {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
            </>
          )}
          <Tooltip {...tooltipStyle} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    case "line":
      return (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={truncateTick} minTickGap={16} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
          <YAxis {...axisProps} label={config.yLabel ? { value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
          <Tooltip {...tooltipStyle} />
          {(config.showLegend || seriesKeys.length > 1) && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((seriesKey, index) => (
            <Line
              key={seriesKey}
              type={curveType}
              dataKey={seriesKey}
              name={seriesKey.charAt(0).toUpperCase() + seriesKey.slice(1)}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={seriesKeys.length > 1 ? false : { r: 3, fill: colors[index % colors.length] }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      );
    case "area":
      return (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={truncateTick} minTickGap={16} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
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
            {data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
          </Pie>
        </PieChart>
      );
    case "scatter":
      return (
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />}
          <XAxis dataKey={xKey} type={numericXAxis ? "number" : "category"} {...axisProps} tickFormatter={numericXAxis ? undefined : truncateTick} label={config.xLabel ? { value: config.xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 16% 65%)" } : undefined} />
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
}
