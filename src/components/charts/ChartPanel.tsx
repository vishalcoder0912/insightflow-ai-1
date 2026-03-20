import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  type: "bar" | "line" | "area" | "pie";
  data: any[];
  dataKey: string;
  xKey?: string;
}

const COLORS = [
  "hsl(187, 85%, 53%)",
  "hsl(38, 92%, 60%)",
  "hsl(160, 70%, 45%)",
  "hsl(350, 80%, 60%)",
  "hsl(270, 70%, 60%)",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(220, 18%, 12%)",
    border: "1px solid hsl(220, 14%, 18%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(210, 20%, 92%)",
  },
};

export default function ChartPanel({ title, subtitle, type, data, dataKey, xKey = "name" }: ChartPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg p-4 card-elevated"
    >
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 15%)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey={dataKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 15%)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={dataKey} stroke={COLORS[0]} fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          ) : type === "pie" ? (
            <PieChart>
              <Tooltip {...tooltipStyle} />
              <Pie data={data} dataKey={dataKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 15%)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey={dataKey} stroke={COLORS[0]} strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
