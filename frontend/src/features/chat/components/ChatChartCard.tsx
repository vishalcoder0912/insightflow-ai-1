import { useMemo, useState } from "react";
import ChartPanel from "@/features/dashboard/components/charts/ChartPanel";
import { CHART_TYPE_OPTIONS, PRESET_PALETTES } from "@/features/dashboard/components/charts/chartOptions";
import type { ChatChartPayload, ChatTablePayload } from "@/shared/types/dataset";

const PALETTE_KEYS = Object.keys(PRESET_PALETTES);
const CHAT_CHART_TYPES = CHART_TYPE_OPTIONS.filter((opt) =>
  ["bar", "line", "area", "pie", "scatter"].includes(opt.value),
);

const normalizePalette = (palette?: string) => {
  if (!palette) return "Cyan";
  const lower = palette.toLowerCase();
  if (lower in { cyan: true, blue: true }) return "Cyan";
  if (lower in { amber: true, orange: true }) return "Amber";
  if (lower in { emerald: true, green: true }) return "Emerald";
  if (lower in { rose: true, pink: true }) return "Rose";
  return PALETTE_KEYS.find((key) => key.toLowerCase() === lower) || "Cyan";
};

const isNumeric = (value: unknown) => Number.isFinite(Number(value));

interface ChatChartCardProps {
  payload: ChatChartPayload;
  table?: ChatTablePayload | null;
}

export default function ChatChartCard({ payload, table }: ChatChartCardProps) {
  const baseConfig = useMemo(
    () => ({
      xLabel: payload.config?.xLabel || payload.xKey,
      yLabel: payload.config?.yLabel || payload.yKey,
      palette: normalizePalette(payload.config?.palette),
      showGrid: payload.config?.showGrid ?? true,
      showLegend: payload.config?.showLegend ?? false,
      curved: payload.config?.curved ?? false,
    }),
    [payload],
  );

  const [chartType, setChartType] = useState(payload.chartType);
  const [xKey, setXKey] = useState(payload.xKey);
  const [yKey, setYKey] = useState(payload.yKey);
  const [config, setConfig] = useState(baseConfig);
  const [showTable, setShowTable] = useState(false);

  const rowKeys = useMemo(
    () =>
      payload.rows[0]
        ? Object.keys(payload.rows[0])
        : [payload.xKey, payload.yKey].filter(Boolean),
    [payload.rows, payload.xKey, payload.yKey],
  );
  const numericKeys = useMemo(() => rowKeys.filter((key) => payload.rows.every((row) => isNumeric(row[key]))), [rowKeys, payload.rows]);

  const resetChart = () => {
    setChartType(payload.chartType);
    setXKey(payload.xKey);
    setYKey(payload.yKey);
    setConfig(baseConfig);
  };

  const availableTable = table || (payload.rows.length ? { columns: rowKeys, rows: payload.rows } : null);

  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-card/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{payload.title}</p>
        <button
          onClick={resetChart}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset
        </button>
      </div>

      <ChartPanel
        title={payload.title}
        type={chartType}
        data={payload.rows}
        dataKey={yKey}
        xKey={xKey}
        config={config}
        editable={false}
        hideHeader
      />

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Chart type
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as typeof chartType)}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          >
            {CHAT_CHART_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Color palette
          <select
            value={config.palette}
            onChange={(e) => setConfig((prev) => ({ ...prev, palette: e.target.value }))}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          >
            {PALETTE_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          X-axis
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          >
            {rowKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Y-axis
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          >
            {numericKeys.length ? numericKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            )) : rowKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.showGrid}
            onChange={(e) => setConfig((prev) => ({ ...prev, showGrid: e.target.checked }))}
            className="rounded border-border bg-background"
          />
          Grid
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.showLegend}
            onChange={(e) => setConfig((prev) => ({ ...prev, showLegend: e.target.checked }))}
            className="rounded border-border bg-background"
          />
          Legend
        </label>
        {(chartType === "line" || chartType === "area") && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.curved}
              onChange={(e) => setConfig((prev) => ({ ...prev, curved: e.target.checked }))}
              className="rounded border-border bg-background"
            />
            Curved
          </label>
        )}
      </div>

      {availableTable && (
        <button
          onClick={() => setShowTable((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showTable ? "Hide data table" : "Show data table"}
        </button>
      )}

      {availableTable && showTable && (
        <div className="border border-border rounded-lg overflow-auto max-h-56">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                {availableTable.columns.map((col) => (
                  <th key={col} className="px-2 py-1 text-left text-muted-foreground font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableTable.rows.slice(0, 20).map((row, index) => (
                <tr key={index} className="border-t border-border/60">
                  {availableTable.columns.map((col) => (
                    <td key={col} className="px-2 py-1 text-foreground">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
