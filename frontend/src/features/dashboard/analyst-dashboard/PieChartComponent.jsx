import { memo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const buildPalette = (baseColor, count) => {
  const palette = [baseColor, "#38bdf8", "#818cf8", "#34d399", "#f59e0b", "#f97316"];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
};

const tooltipFormatter = (value) => [`${Number(value).toLocaleString()}`, "Value"];

const PieChartComponent = memo(({ data = [], color = "#0ea5e9", showTooltip = true, showLegend = true, animate = true, style = "pie" }) => {
  const chartData = Array.isArray(data) ? data : [];
  const palette = buildPalette(color, chartData.length);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="category"
            innerRadius={style === "donut" ? 65 : 0}
            outerRadius={110}
            paddingAngle={2}
            labelLine={false}
            label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
            isAnimationActive={animate}
          >
            {chartData.map((entry, index) => (
              <Cell key={`${entry.category}-${index}`} fill={palette[index]} />
            ))}
          </Pie>
          {showTooltip ? <Tooltip formatter={tooltipFormatter} /> : null}
          {showLegend ? <Legend /> : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});

export default PieChartComponent;
