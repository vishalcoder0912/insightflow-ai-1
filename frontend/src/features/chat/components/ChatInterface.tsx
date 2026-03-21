import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, User, AlertCircle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useDataset } from "@/shared/data/DataContext";
import { chatApi } from "@/shared/services/api";
import type { ChatChartPayload, ChatTablePayload, DatasetChart } from "@/shared/types/dataset";
import ChatChartCard from "@/features/chat/components/ChatChartCard";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;       // FIX #7 — distinguish error bubbles visually
  sql?: string;
  chart?: DatasetChart | null;
  chartPayload?: ChatChartPayload | null;
  table?: ChatTablePayload | null;
}

// ─── Stable ID generator (avoids Date.now() collision) ─────────────────────────

let _counter = 0;
const uid = () => `msg-${Date.now()}-${++_counter}`;

// ─── Welcome message factory (dataset-aware) ────────────────────────────────────

const buildWelcome = (hasDataset: boolean): Message => ({
  id: "welcome",
  role: "assistant",
  content: hasDataset
    ? "Dataset loaded. Ask me anything about your data.\n\nTry: *\"What are the top 5 products by revenue?\"*"
    : "Welcome to **InsightFlow AI**. Upload a dataset and ask a question about it.\n\nTry: *\"What are the top 5 products by revenue?\"*",
});

// ─── Chart renderer ─────────────────────────────────────────────────────────────

function ChartPreview({ chart }: { chart: DatasetChart }) {
  // Renders a simple bar-style preview so the chart data is actually visible.
  // Swap this out for Recharts / Chart.js if a full chart library is available.
  const max = Math.max(...chart.data.map((d) => Number(d.value) || 0));

  return (
    <div className="mt-3 rounded-md border border-border p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">{chart.title}</p>
      <p className="text-xs text-muted-foreground capitalize">{chart.type} chart · {chart.data.length} data points</p>
      <div className="space-y-1.5 mt-2">
        {chart.data.slice(0, 8).map((point, i) => {
          const pct = max > 0 ? (Number(point.value) / max) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{String(point.label ?? point.x ?? i)}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{point.value}</span>
            </div>
          );
        })}
        {chart.data.length > 8 && (
          <p className="text-xs text-muted-foreground">+{chart.data.length - 8} more rows</p>
        )}
      </div>
    </div>
  );
}

const isStructuredChart = (chart: unknown): chart is ChatChartPayload => {
  if (!chart || typeof chart !== "object") return false;
  return "chartType" in chart && "rows" in chart && "xKey" in chart && "yKey" in chart;
};

const toChatChartPayload = (chart: DatasetChart): ChatChartPayload => {
  const xKey = "name";
  const yKey = chart.dataKey || "value";
  const rows = chart.data.map((entry) => ({
    [xKey]: entry.name ?? entry.label ?? entry.x ?? "",
    [yKey]: Number(entry.value ?? entry.y ?? 0),
  }));

  return {
    title: chart.title,
    chartType: chart.type,
    xKey,
    yKey,
    rows,
    config: {
      xLabel: "",
      yLabel: "",
      palette: "cyan",
      showGrid: true,
      showLegend: chart.type === "pie",
      curved: false,
    },
  };
};
// ─── Main component ─────────────────────────────────────────────────────────────

export default function ChatInterface() {
  const { dataset } = useDataset();

  // FIX #6 — welcome message reflects whether a dataset is already loaded
  const [messages, setMessages] = useState<Message[]>(() => [buildWelcome(!!dataset)]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const [openTable, setOpenTable] = useState<Record<string, boolean>>({});

  // FIX #5 — point ref at the bottom sentinel, not the scroll container
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // FIX #6 — update welcome message when dataset availability changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [buildWelcome(!!dataset)];
      }
      return prev;
    });
  }, [dataset]);

  // ── Reset chat ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setMessages([buildWelcome(!!dataset)]);
    setInput("");
    setOpenSql({});
    setOpenTable({});
    inputRef.current?.focus();
  }, [dataset]);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    // FIX #3 — unified guard used by both button and Enter key
    if (!dataset || !input.trim() || isLoading) return;

    const userMsg: Message = { id: uid(), role: "user", content: input.trim() };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // FIX #1 — pass dataset so API has context
      // FIX #4 — pass full conversation history for multi-turn memory
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const resp = await chatApi.send(userMsg.content, dataset, history);

      const structuredChart = resp.chart
        ? isStructuredChart(resp.chart)
          ? resp.chart
          : toChatChartPayload(resp.chart as DatasetChart)
        : null;

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: resp.answer,
          sql: resp.sql,
          chart: isStructuredChart(resp.chart) ? null : (resp.chart as DatasetChart | null),
          chartPayload: structuredChart,
          table: resp.table || null,
        },
      ]);
    } catch (error) {
      // FIX #7 — error messages are flagged separately so UI can style them
      const message = error instanceof Error ? error.message : "Chat request failed.";
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: message, isError: true },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [dataset, input, isLoading, messages]);

  // ── Enter key handler ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // FIX #3 — respect all disabled conditions before firing
      if (e.key === "Enter" && !e.shiftKey && dataset && input.trim() && !isLoading) {
        void handleSend();
      }
    },
    [handleSend, dataset, input, isLoading],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Message list ── */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {/* Assistant avatar */}
              {msg.role === "assistant" && (
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.isError ? "bg-destructive/15" : "bg-primary/15"
                  }`}
                >
                  {msg.isError ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
                    : msg.isError
                      // FIX #7 — error bubbles get distinct destructive styling
                      ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-tr-2xl rounded-br-2xl rounded-tl-2xl"
                      : "bg-card card-elevated text-card-foreground rounded-tr-2xl rounded-br-2xl rounded-tl-2xl"
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children }) => (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>

                {/* SQL block */}
                {msg.sql && (
                  <div className="mt-3">
                    <button
                      onClick={() => setOpenSql((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {openSql[msg.id] ? "Hide SQL" : "Show SQL"}
                    </button>
                    {openSql[msg.id] && (
                      <div className="mt-2 bg-muted rounded-md p-3">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Generated SQL</p>
                        <pre className="text-xs font-mono text-primary overflow-x-auto whitespace-pre-wrap">{msg.sql}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* FIX #9 � render actual chart preview instead of just describing it */}
                {msg.chartPayload && (
                  <ChatChartCard payload={msg.chartPayload} table={msg.table} />
                )}

                {!msg.chartPayload && msg.chart && <ChartPreview chart={msg.chart} />}

                {!msg.chartPayload && !msg.chart && msg.table && (
                  <div className="mt-3">
                    <button
                      onClick={() => setOpenTable((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {openTable[msg.id] ? "Hide data table" : "Show data table"}
                    </button>
                    {openTable[msg.id] && (
                      <div className="mt-2 border border-border rounded-lg overflow-auto max-h-56">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              {msg.table.columns.map((col) => (
                                <th key={col} className="px-2 py-1 text-left text-muted-foreground font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.table.rows.slice(0, 20).map((row, index) => (
                              <tr key={index} className="border-t border-border/60">
                                {msg.table.columns.map((col) => (
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
                )}


              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse-glow" />
            </div>
            <div className="bg-card card-elevated rounded-tr-2xl rounded-br-2xl rounded-tl-2xl px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="typing-dot"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FIX #5 — bottom sentinel for reliable scroll-to-bottom */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          {/* FIX #8 — reset / new chat button */}
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              disabled={isLoading}
              title="Reset chat"
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              dataset
                ? "Ask about your data…"
                : "Upload a dataset before asking questions"
            }
            disabled={!dataset || isLoading}
            // FIX #10 — tooltip on disabled state
            title={!dataset ? "Upload a dataset first to start chatting" : undefined}
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            onClick={() => { void handleSend(); }}
            disabled={!dataset || !input.trim() || isLoading}
            title={!dataset ? "Upload a dataset first" : "Send message"}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
















