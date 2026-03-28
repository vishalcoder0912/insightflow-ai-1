import { memo } from "react";

const baseInputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

const toggleClassName = (enabled) =>
  `relative inline-flex h-6 w-11 items-center rounded-full transition ${
    enabled ? "bg-sky-500" : "bg-slate-300"
  }`;

const knobClassName = (enabled) =>
  `inline-block h-5 w-5 transform rounded-full bg-white transition ${
    enabled ? "translate-x-5" : "translate-x-1"
  }`;

const Toggle = memo(({ label, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
  >
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <span className={toggleClassName(value)}>
      <span className={knobClassName(value)} />
    </span>
  </button>
));

const ControlPanel = memo(({ controls, onChange }) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Customization Panel</h2>
        <p className="mt-1 text-sm text-slate-500">Adjust chart appearance without risking crashes or invalid states.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Accent color</span>
          <input
            type="color"
            value={controls.color}
            onChange={(event) => onChange({ ...controls, color: event.target.value })}
            className="h-11 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-1"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Bar layout</span>
          <select
            value={controls.barLayout}
            onChange={(event) => onChange({ ...controls, barLayout: event.target.value })}
            className={baseInputClassName}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Line curve</span>
          <select
            value={controls.lineCurve}
            onChange={(event) => onChange({ ...controls, lineCurve: event.target.value })}
            className={baseInputClassName}
          >
            <option value="monotone">Monotone</option>
            <option value="linear">Linear</option>
            <option value="step">Step</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Pie style</span>
          <select
            value={controls.pieStyle}
            onChange={(event) => onChange({ ...controls, pieStyle: event.target.value })}
            className={baseInputClassName}
          >
            <option value="pie">Pie</option>
            <option value="donut">Donut</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Area fill</span>
          <select
            value={controls.areaStyle}
            onChange={(event) => onChange({ ...controls, areaStyle: event.target.value })}
            className={baseInputClassName}
          >
            <option value="gradient">Gradient</option>
            <option value="solid">Solid</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Toggle label="Show grid" value={controls.showGrid} onChange={(value) => onChange({ ...controls, showGrid: value })} />
        <Toggle label="Show tooltip" value={controls.showTooltip} onChange={(value) => onChange({ ...controls, showTooltip: value })} />
        <Toggle label="Show legend" value={controls.showLegend} onChange={(value) => onChange({ ...controls, showLegend: value })} />
        <Toggle label="Animate charts" value={controls.animate} onChange={(value) => onChange({ ...controls, animate: value })} />
      </div>
    </section>
  );
});

export default ControlPanel;
