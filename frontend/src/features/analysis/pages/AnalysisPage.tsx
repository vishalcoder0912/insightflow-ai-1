import { useState, useEffect, useCallback } from "react";
import { useDataset } from "@/shared/data/DataContext";
import { Sparkles, BarChart3, TrendingUp, AlertTriangle, Layers, Download } from "lucide-react";
import { motion } from "framer-motion";

type AnalysisTab = "correlations" | "outliers" | "distributions" | "trends";

interface AnalysisBaseResult {
  analysis_type: string;
  summary: string;
}

interface CorrelationItem {
  column_a: string;
  column_b: string;
  direction: string;
  correlation: number;
}

interface CorrelationResult extends AnalysisBaseResult {
  results: {
    strong_correlations: CorrelationItem[];
  };
}

interface OutlierItem {
  column: string;
  outlier_count: number;
  lower_bound: number;
  upper_bound: number;
}

interface OutlierResult extends AnalysisBaseResult {
  results: OutlierItem[];
}

interface DistributionItem {
  column: string;
  mean: number;
  median: number;
  variance: number;
  skewness: number;
}

interface DistributionResult extends AnalysisBaseResult {
  results: DistributionItem[];
}

interface AnalysisResultsMap {
  correlations: CorrelationResult | null;
  outliers: OutlierResult | null;
  distributions: DistributionResult | null;
  trends: AnalysisBaseResult | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function AnalysisPage() {
  const { dataset } = useDataset();
  const [activeTab, setActiveTab] = useState<AnalysisTab>("correlations");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResultsMap>({
    correlations: null,
    outliers: null,
    distributions: null,
    trends: null,
  });

  const fetchAnalysis = useCallback(async (type: AnalysisTab) => {
    if (!dataset || results[type]) return;
    
    // If trend is requested, need parameters. For now, simple endpoints:
    if (type === "trends") {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/${type}`);
      if (!res.ok) throw new Error("Failed to fetch analysis");
      
      const data = await res.json();
      setResults((prev) => ({ ...prev, [type]: data as AnalysisResultsMap[typeof type] }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dataset, results]);

  useEffect(() => {
    if (dataset && activeTab !== "trends") {
      void fetchAnalysis(activeTab);
    }
  }, [dataset, activeTab, fetchAnalysis]);

  if (!dataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50 backdrop-blur-sm">
        <div className="rounded-full bg-primary/10 p-4 mb-4 ring-1 ring-primary/20">
          <Sparkles className="w-8 h-8 text-primary opacity-80" />
        </div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">No Dataset Available</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Upload a CSV or Excel file on the upload page to perform deep statistical analysis.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: "correlations", label: "Correlations", icon: Layers },
    { id: "outliers", label: "Outliers", icon: AlertTriangle },
    { id: "distributions", label: "Distributions", icon: BarChart3 },
    { id: "trends", label: "Trends", icon: TrendingUp },
  ] as const;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 max-w-[1200px] mx-auto w-full animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Statistical Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-balance">
            Deep structural analysis running on the Python backend (Pandas/SciPy).
          </p>
        </div>
        
        <button 
          onClick={() => window.open(`${API_BASE_URL}/api/export/report/json`, "_blank")}
          className="bg-primary text-primary-foreground border border-primary rounded-md px-3 py-1.5 flex items-center gap-2 text-sm shadow-sm hover:opacity-90 transition-opacity"
          title="Download Analysis Report (JSON)"
        >
          <Download className="w-4 h-4" />
          <span className="font-medium">Export Report</span>
        </button>
      </div>

      <div className="flex gap-2 border-b border-border pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg
                ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-primary" : "opacity-70"}`} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Running advanced statistical analysis...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "correlations" && results.correlations && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Correlation Matrix</h3>
                <p className="text-sm text-muted-foreground mb-6">{results.correlations.summary}</p>
                <div className="space-y-2">
                  {results.correlations.results.strong_correlations.map((c: CorrelationItem, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="font-medium text-sm">{c.column_a} &harr; {c.column_b}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{c.direction}</span>
                        <span className={`text-sm font-bold ${c.correlation > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {c.correlation.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {results.correlations.results.strong_correlations.length === 0 && (
                     <p className="text-sm py-4 text-center text-muted-foreground">No strong correlations found.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "outliers" && results.outliers && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Anomaly Detection</h3>
                <p className="text-sm text-muted-foreground mb-6">{results.outliers.summary}</p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {results.outliers.results.map((r: OutlierItem, i: number) => (
                    <div key={i} className="p-4 bg-muted/20 border border-border rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold">{r.column}</span>
                        <span className="text-xs px-2 py-1 bg-rose-500/10 text-rose-500 rounded-full font-medium">
                          {r.outlier_count} Outliers
                        </span>
                      </div>
                      <div className="text-sm flex justify-between text-muted-foreground mb-1">
                        <span>Min Threshold: {r.lower_bound.toFixed(2)}</span>
                        <span>Max Threshold: {r.upper_bound.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "distributions" && results.distributions && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Column Distributions</h3>
                <p className="text-sm text-muted-foreground mb-6">{results.distributions.summary}</p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.distributions.results.map((r: DistributionItem, i: number) => (
                    <div key={i} className="p-4 bg-muted/20 border border-border rounded-xl">
                      <span className="font-semibold inline-block mb-3">{r.column}</span>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Mean</span>
                          <span className="text-foreground">{r.mean.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Median</span>
                          <span className="text-foreground">{r.median.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Variance</span>
                          <span className="text-foreground">{r.variance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-1 mt-1 border-t border-border/50">
                          <span>Skewness</span>
                          <span className={`font-medium ${r.skewness > 0.5 || r.skewness < -0.5 ? "text-amber-500" : "text-emerald-500"}`}>
                            {r.skewness.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "trends" && (
              <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Trend Analysis</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Requires parameter selection (Time column + Metric column). Full interactive interface coming in next iteration.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
