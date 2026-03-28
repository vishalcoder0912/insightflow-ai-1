import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter";

interface ChartPanelProps {
  title: string;
  type: ChartType;
  data: Array<Record<string, string | number | undefined>>;
  dataKey: string;
  xKey?: string;
  editable?: boolean;
}

const COLORS = [
  "hsl(187 85% 53%)",
  "hsl(38 92% 60%)",
  "hsl(160 70% 45%)",
  "hsl(350 80% 60%)",
  "hsl(270 70% 60%)",
];

export default function ChartPanel({
  title,
  type,
  data,
  dataKey,
  xKey = "name",
}: ChartPanelProps) {
  const gradientId = useId();

  const scatterData = useMemo(
    () =>
      data.map((point, index) => ({
        ...point,
        __scatterX: typeof point[xKey] === "number" ? Number(point[xKey]) : index + 1,
        __scatterY:
          typeof point[dataKey] === "number"
            ? Number(point[dataKey])
            : Number(point.value || 0),
      })),
    [data, dataKey, xKey],
  );

  const renderChart = () => {
    if (!data?.length) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">No data</div>
      );
    }

    switch (type) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill="hsl(187 85% 53%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke="hsl(187 85% 53%)" strokeWidth={2} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(187 85% 53%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(187 85% 53%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={dataKey}
              fill={`url(#${gradientId})`}
              stroke="hsl(187 85% 53%)"
              strokeWidth={2}
            />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey="__scatterX" type="number" name={xKey} />
            <YAxis dataKey="__scatterY" type="number" name={dataKey} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={scatterData} fill="hsl(187 85% 53%)" />
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full w-full rounded-lg border border-border bg-card p-4"
    >
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {renderChart()}
      </ResponsiveContainer>
    </motion.div>
  );
}
