import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipFormatter = (value) => [`${Number(value).toLocaleString()}`, "Value"];

const BarChartComponent = memo(({ data = [], color = "#0ea5e9", showGrid = true, showTooltip = true, showLegend = true, animate = true, layout = "vertical" }) => {
  const chartData = Array.isArray(data) ? data : [];
  const horizontal = layout === "horizontal";

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null}
          <XAxis
            type={horizontal ? "number" : "category"}
            dataKey={horizontal ? "value" : "category"}
            stroke="#64748b"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type={horizontal ? "category" : "number"}
            dataKey={horizontal ? "category" : "value"}
            stroke="#64748b"
            tickLine={false}
            axisLine={false}
            width={80}
          />
          {showTooltip ? <Tooltip formatter={tooltipFormatter} cursor={{ fill: "rgba(14,165,233,0.08)" }} /> : null}
          {showLegend ? <Legend /> : null}
          <Bar dataKey="value" radius={horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]} isAnimationActive={animate}>
            {chartData.map((entry, index) => (
              <Cell key={`${entry.category}-${index}`} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default BarChartComponent;
