import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, RotateCcw, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { detectDatasetFeatures } from "@/ai-engine/featureDetector";
import { parseQueryMessage } from "@/ai-engine/queryParser";
import ChatChartCard from "@/features/chat/components/ChatChartCard";
import { useDataset } from "@/shared/data/DataContext";
import { chatApi } from "@/shared/services/api";
import type {
  ChatAnalysis,
  ChatChartPayload,
  ChatFeatures,
  ChatResponse,
  ChatTablePayload,
  DatasetChart,
} from "@/shared/types/dataset";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  sql?: string;
  chart?: ChatResponse["chart"];
  table?: ChatTablePayload | null;
  insights?: string[];
  source?: string;
  suggestedCharts?: DatasetChart[];
  analysis?: ChatAnalysis | null;
  features?: ChatFeatures | null;
}

let counter = 0;
const uid = () => `msg-${Date.now()}-${++counter}`;

const buildWelcome = (hasDataset: boolean): Message => ({
  id: "welcome",
  role: "assistant",
  content: hasDataset
    ? 'Dataset loaded. Ask me anything about your data.\n\nTry: *"Show total sales by region"*'
    : "Welcome to **Chat**. Upload a dataset first.",
});

const isChartPayload = (chart: Message["chart"]): chart is ChatChartPayload =>
  Boolean(
    chart &&
    typeof chart === "object" &&
    "rows" in chart &&
    "chartType" in chart &&
    Array.isArray(chart.rows),
  );

const toChartPayload = (chart: Message["chart"]): ChatChartPayload | null => {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  if (isChartPayload(chart)) {
    return chart;
  }

  const datasetChart = chart as DatasetChart;
  if (!Array.isArray(datasetChart.data) || !datasetChart.data.length) {
    return null;
  }

  const xKey = datasetChart.xKey || "name";
  const yKey = datasetChart.dataKey || "value";

  return {
    title: datasetChart.title || "Chart",
    chartType: datasetChart.type || "bar",
    xKey,
    yKey,
    rows: datasetChart.data.map((point, index) => {
      const label = point[xKey] ?? point.name ?? point.label ?? `Item ${index + 1}`;
      const value = Number(point[yKey] ?? point.value ?? point.y ?? 0);

      return {
        ...point,
        [xKey]: typeof label === "number" ? label : String(label),
        [yKey]: Number.isFinite(value) ? value : 0,
        label: typeof label === "number" ? label : String(label),
        value: Number.isFinite(value) ? value : 0,
      };
    }),
    config: {
      xLabel: datasetChart.config?.xLabel || datasetChart.xKey || "Category",
      yLabel: datasetChart.config?.yLabel || datasetChart.dataKey || "Value",
      palette: datasetChart.config?.palette,
      showGrid: datasetChart.config?.showGrid ?? true,
      showLegend: datasetChart.config?.showLegend ?? datasetChart.type === "pie",
      curved: datasetChart.config?.curved ?? (datasetChart.type === "line" || datasetChart.type === "area"),
    },
  };
};

function ChartPreview({
  chart,
  table,
}: {
  chart: Message["chart"];
  table?: ChatTablePayload | null;
}) {
  const payload = toChartPayload(chart);

  if (!payload) {
    return null;
  }

  return (
    <div className="mt-4">
      <ChatChartCard payload={payload} table={table} />
    </div>
  );
}

function SuggestedChartGrid({ charts }: { charts: DatasetChart[] }) {
  const uniqueCharts = useMemo(() => {
    const seen = new Set<string>();
    return charts.filter((chart) => {
      const key = `${chart.title}:${chart.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [charts]);

  if (!uniqueCharts.length) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Suggested Charts
      </p>
      <div className="grid gap-3 xl:grid-cols-2">
        {uniqueCharts.slice(0, 2).map((chart) => (
          <div key={`${chart.title}-${chart.type}`} className="rounded-xl border border-border/70 bg-card/40 p-3">
            <ChartPreview chart={chart} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const { dataset } = useDataset();
  const [messages, setMessages] = useState<Message[]>(() => [buildWelcome(Boolean(dataset))]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredInput = useDeferredValue(input);

  const detectedFeatures = useMemo(() => detectDatasetFeatures(dataset), [dataset]);
  const liveQuery = useMemo(
    () =>
      parseQueryMessage(
        deferredInput,
        detectedFeatures,
        messages.map(({ role, content }) => ({ role, content })),
      ),
    [deferredInput, detectedFeatures, messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0].id === "welcome") {
        return [buildWelcome(Boolean(dataset))];
      }

      return current;
    });
  }, [dataset]);

  const handleReset = useCallback(() => {
    setMessages([buildWelcome(Boolean(dataset))]);
    setInput("");
    inputRef.current?.focus();
  }, [dataset]);

  const handleSuggestionClick = useCallback((value: string) => {
    setInput(value);
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    if (!dataset || !input.trim() || isLoading) {
      return;
    }

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: input.trim(),
    };

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await chatApi.send(userMsg.content, dataset, history);

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: resp.answer || "No answer available.",
        sql: resp.sql || "",
        chart: resp.chart || null,
        table: resp.table || null,
        insights: Array.isArray(resp.insights) ? resp.insights : [],
        source: resp.source,
        suggestedCharts: Array.isArray(resp.suggestedCharts) ? resp.suggestedCharts : [],
        analysis: resp.analysis || null,
        features: resp.features || null,
      };

      setMessages((current) => [...current, assistantMsg]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Chat request failed.";

      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content: errorMsg,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [dataset, input, isLoading, messages]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey && dataset && input.trim() && !isLoading) {
        void handleSend();
      }
    },
    [dataset, handleSend, input, isLoading],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
            >
              {message.role === "assistant" && (
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    message.isError ? "bg-destructive/15" : "bg-primary/15"
                  }`}
                >
                  {message.isError ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.isError
                      ? "border border-destructive/20 bg-destructive/10 text-destructive"
                      : "bg-card text-card-foreground"
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {message.analysis?.summary && !message.isError && (
                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {message.analysis.intent || "analysis"}
                    </span>
                    {": "}
                    {message.analysis.summary}
                  </div>
                )}

                {message.sql && (
                  <div className="mt-3 rounded-md bg-muted p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">SQL</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs font-mono">
                      {message.sql}
                    </pre>
                  </div>
                )}

                {message.insights && message.insights.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Insights
                    </p>
                    <div className="space-y-1.5">
                      {message.insights.slice(0, 4).map((insight, index) => (
                        <p key={`${message.id}-insight-${index}`} className="text-xs text-muted-foreground">
                          • {insight}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {message.chart && <ChartPreview chart={message.chart} table={message.table} />}

                {message.suggestedCharts && message.suggestedCharts.length > 0 && (
                  <SuggestedChartGrid charts={message.suggestedCharts} />
                )}

                {!message.isError && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.source && (
                      <div className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {message.source === "gemini" ? "AI Analytics" : "Dataset Analytics"}
                      </div>
                    )}
                    {message.features?.schema && (
                      <div className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                        {message.features.columnCount} columns
                      </div>
                    )}
                  </div>
                )}
              </div>

              {message.role === "user" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" />
            </div>
            <div className="flex gap-1 rounded-lg bg-card px-4 py-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${index * 200}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background p-4">
        {detectedFeatures && (
          <div className="mb-3 rounded-xl border border-border/70 bg-card/40 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Live detection</span>
              <span>Intent: {liveQuery.intent}</span>
              {liveQuery.columns.length > 0 && <span>Columns: {liveQuery.columns.join(", ")}</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {liveQuery.suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type}-${suggestion.label}`}
                  onClick={() => handleSuggestionClick(suggestion.value)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {suggestion.label}
                </button>
              ))}

              {!input.trim() && detectedFeatures.promptSuggestions.slice(0, 2).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data"
            disabled={!dataset || isLoading}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />

          <button
            onClick={() => {
              void handleSend();
            }}
            disabled={!dataset || !input.trim() || isLoading}
            className="rounded-lg bg-primary px-4 py-2.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
