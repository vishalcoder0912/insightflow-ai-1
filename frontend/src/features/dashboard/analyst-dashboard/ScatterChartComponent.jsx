import { memo } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipFormatter = (value, name, payload) => {
  if (payload?.payload?.category) {
    return [`${Number(value).toLocaleString()}`, payload.payload.category];
  }

  return [`${Number(value).toLocaleString()}`, name];
};

const ScatterChartComponent = memo(({ data = [], color = "#0ea5e9", showGrid = true, showTooltip = true, showLegend = true, animate = true }) => {
  const chartData = Array.isArray(data)
    ? data.map((item, index) => ({
        ...item,
        index: index + 1,
      }))
    : [];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null}
          <XAxis
            type="number"
            dataKey="index"
            name="Row index"
            stroke="#64748b"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="value"
            name="Value"
            stroke="#64748b"
            tickLine={false}
            axisLine={false}
          />
          {showTooltip ? <Tooltip formatter={tooltipFormatter} /> : null}
          {showLegend ? <Legend /> : null}
          <Scatter name="Category correlation" data={chartData} fill={color} isAnimationActive={animate} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ScatterChartComponent;
