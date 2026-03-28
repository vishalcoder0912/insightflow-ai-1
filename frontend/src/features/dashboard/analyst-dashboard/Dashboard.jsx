import { memo, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpToLine, ChevronDown, Sigma } from "lucide-react";
import AreaChartComponent from "./AreaChartComponent.jsx";
import BarChartComponent from "./BarChartComponent.jsx";
import ControlPanel from "./ControlPanel.jsx";
import LineChartComponent from "./LineChartComponent.jsx";
import PieChartComponent from "./PieChartComponent.jsx";
import SafeChart from "./SafeChart.jsx";
import ScatterChartComponent from "./ScatterChartComponent.jsx";

const initialControls = {
  color: "#0ea5e9",
  showGrid: true,
  showTooltip: true,
  showLegend: true,
  animate: true,
  barLayout: "vertical",
  lineCurve: "monotone",
  pieStyle: "donut",
  areaStyle: "gradient",
};

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const normalizeData = (input) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawCategory = item.category ?? item.name ?? item.label ?? `Item ${index + 1}`;
      const rawValue =
        item.value ??
        item.amount ??
        item.total ??
        Object.values(item).find((value) => isFiniteNumber(value));

      if (!isFiniteNumber(rawValue)) {
        return null;
      }

      return {
        category: String(rawCategory || `Item ${index + 1}`),
        value: Number(rawValue),
      };
    })
    .filter((item) => Boolean(item));
};

const buildCumulativeData = (data) => {
  let runningTotal = 0;

  return data.map((item) => {
    runningTotal += item.value;

    return {
      ...item,
      cumulativeValue: runningTotal,
    };
  });
};

const KpiCard = memo(({ label, value, icon: Icon }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      </div>
      <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
));

const EmptyDashboardState = memo(({ title }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
    <p className="text-lg font-semibold text-slate-900">{title}</p>
    <p className="mt-2 text-sm text-slate-500">
      Upload a valid CSV and map it to records like <code className="rounded bg-slate-100 px-1.5 py-0.5">{`[{category:"A",value:10}]`}</code>.
    </p>
  </div>
));

const Dashboard = memo(({ data = [], loading = false, title = "CSV Analytics Dashboard", description = "Interactive analytics workspace" }) => {
  const [controls, setControls] = useState(initialControls);
  const chartsRef = useRef(null);

  const normalizedData = useMemo(() => normalizeData(data), [data]);
  const cumulativeData = useMemo(() => buildCumulativeData(normalizedData), [normalizedData]);
  const hasData = normalizedData.length > 0;

  const metrics = useMemo(() => {
    if (!hasData) {
      return {
        average: "0.00",
        min: "0.00",
        max: "0.00",
      };
    }

    const values = normalizedData.map((item) => item.value);
    const total = values.reduce((sum, value) => sum + value, 0);

    return {
      average: (total / values.length).toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2),
    };
  }, [hasData, normalizedData]);

  const handleScrollDown = () => {
    chartsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-full bg-slate-100/60 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Analyst workspace</p>
              <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
              <p className="max-w-3xl text-sm text-slate-500">{description}</p>
            </div>

            <button
              type="button"
              onClick={handleScrollDown}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
            >
              Scroll Down
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Average value" value={metrics.average} icon={Sigma} />
          <KpiCard label="Min value" value={metrics.min} icon={ArrowDownToLine} />
          <KpiCard label="Max value" value={metrics.max} icon={ArrowUpToLine} />
        </div>

        <ControlPanel controls={controls} onChange={setControls} />

        {!loading && !hasData ? (
          <EmptyDashboardState title="No usable chart data detected" />
        ) : null}

        <div ref={chartsRef} className="flex scroll-mt-6 flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">5 Charts Overview</h2>
          <p className="text-sm text-slate-500">
            Compare category performance, trend movement, share distribution, cumulative growth, and scatter behavior in one view.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <SafeChart title="Bar Chart" subtitle="Category vs value comparison" isLoading={loading} hasData={hasData}>
            <BarChartComponent
              data={normalizedData}
              color={controls.color}
              showGrid={controls.showGrid}
              showTooltip={controls.showTooltip}
              showLegend={controls.showLegend}
              animate={controls.animate}
              layout={controls.barLayout}
            />
          </SafeChart>

          <SafeChart title="Line Chart" subtitle="Trend visualization across categories" isLoading={loading} hasData={hasData}>
            <LineChartComponent
              data={normalizedData}
              color={controls.color}
              showGrid={controls.showGrid}
              showTooltip={controls.showTooltip}
              showLegend={controls.showLegend}
              animate={controls.animate}
              curve={controls.lineCurve}
            />
          </SafeChart>

          <SafeChart title="Pie Chart" subtitle="Category distribution share" isLoading={loading} hasData={hasData}>
            <PieChartComponent
              data={normalizedData}
              color={controls.color}
              showTooltip={controls.showTooltip}
              showLegend={controls.showLegend}
              animate={controls.animate}
              style={controls.pieStyle}
            />
          </SafeChart>

          <SafeChart title="Area Chart" subtitle="Cumulative representation" isLoading={loading} hasData={hasData}>
            <AreaChartComponent
              data={cumulativeData}
              color={controls.color}
              showGrid={controls.showGrid}
              showTooltip={controls.showTooltip}
              showLegend={controls.showLegend}
              animate={controls.animate}
              style={controls.areaStyle}
            />
          </SafeChart>

          <div className="xl:col-span-2">
            <SafeChart
              title="Scatter Chart"
              subtitle="Analytical correlation feel using observation index vs value"
              isLoading={loading}
              hasData={hasData}
            >
              <ScatterChartComponent
                data={normalizedData}
                color={controls.color}
                showGrid={controls.showGrid}
                showTooltip={controls.showTooltip}
                showLegend={controls.showLegend}
                animate={controls.animate}
              />
            </SafeChart>
          </div>
        </div>

        <footer className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          <Activity className="h-4 w-4 text-sky-600" />
          Crash-proof rendering is enabled. Invalid rows are filtered safely before they reach any chart.
        </footer>
      </div>
    </div>
  );
});

export default Dashboard;
