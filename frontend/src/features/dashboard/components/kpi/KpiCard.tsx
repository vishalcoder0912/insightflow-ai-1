import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export default function KpiCard({ label, value, change, changeType = "neutral", icon: Icon }: KpiCardProps) {
  const changeColor = {
    positive: "text-chart-emerald",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="text-2xl font-semibold text-gray-900 font-mono">{value}</div>
      {change && (
        <p className={`text-xs mt-1 ${changeColor}`}>{change}</p>
      )}
    </motion.div>
  );
}
