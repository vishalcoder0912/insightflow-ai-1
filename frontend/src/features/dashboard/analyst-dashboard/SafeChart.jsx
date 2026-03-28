import React, { memo } from "react";

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Chart rendering failed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-red-600">Chart unavailable</p>
            <p className="mt-1 text-xs text-red-500">The chart failed safely instead of crashing the dashboard.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const LoadingState = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 w-40 rounded bg-slate-200" />
    <div className="h-72 rounded-2xl bg-slate-100" />
  </div>
);

const EmptyState = ({ message }) => (
  <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
    <div>
      <p className="text-sm font-semibold text-slate-700">No chart data available</p>
      <p className="mt-1 text-xs text-slate-500">{message}</p>
    </div>
  </div>
);

const SafeChart = memo(({ title, subtitle, isLoading = false, hasData = false, emptyMessage = "Provide valid category/value rows to populate this visualization.", children }) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : hasData ? (
        <ChartErrorBoundary>{children}</ChartErrorBoundary>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
});

export default SafeChart;
