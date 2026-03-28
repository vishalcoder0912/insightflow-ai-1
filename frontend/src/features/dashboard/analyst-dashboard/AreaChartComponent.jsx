import { memo, useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipFormatter = (value) => [`${Number(value).toLocaleString()}`, "Cumulative value"];

const AreaChartComponent = memo(({ data = [], color = "#0ea5e9", showGrid = true, showTooltip = true, showLegend = true, animate = true, style = "gradient" }) => {
  const chartData = Array.isArray(data) ? data : [];
  const gradientId = useId();

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={style === "solid" ? 0.7 : 0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={style === "solid" ? 0.45 : 0.03} />
            </linearGradient>
          </defs>
          {showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null}
          <XAxis dataKey="category" stroke="#64748b" tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
          {showTooltip ? <Tooltip formatter={tooltipFormatter} /> : null}
          {showLegend ? <Legend /> : null}
          <Area
            type="monotone"
            dataKey="cumulativeValue"
            name="Cumulative value"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={3}
            isAnimationActive={animate}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default AreaChartComponent;
