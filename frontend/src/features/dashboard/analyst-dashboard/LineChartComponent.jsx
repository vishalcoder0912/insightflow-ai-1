import { memo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipFormatter = (value) => [`${Number(value).toLocaleString()}`, "Value"];

const LineChartComponent = memo(({ data = [], color = "#0ea5e9", showGrid = true, showTooltip = true, showLegend = true, animate = true, curve = "monotone" }) => {
  const chartData = Array.isArray(data) ? data : [];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null}
          <XAxis dataKey="category" stroke="#64748b" tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
          {showTooltip ? <Tooltip formatter={tooltipFormatter} /> : null}
          {showLegend ? <Legend /> : null}
          <Line
            type={curve}
            dataKey="value"
            name="Value trend"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 6 }}
            isAnimationActive={animate}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default LineChartComponent;
