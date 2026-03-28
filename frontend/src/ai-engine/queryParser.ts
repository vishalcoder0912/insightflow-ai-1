import type { ChatFeatures } from "@/shared/types/dataset";

export type ParsedIntent =
  | "overview"
  | "question"
  | "filter"
  | "aggregation"
  | "trend"
  | "comparison"
  | "distribution"
  | "correlation";

export interface ChatContextEntry {
  role: "user" | "assistant";
  content: string;
}

export interface QuerySuggestion {
  type: "intent" | "column" | "chart" | "followup";
  label: string;
  value: string;
  hint: string;
}

export interface ParsedQueryResult {
  normalizedMessage: string;
  intent: ParsedIntent;
  metric: "count" | "sum" | "average" | "max" | "min";
  chartHint?: "bar" | "line" | "pie" | "scatter" | "area";
  columns: string[];
  recentTopics: string[];
  confidence: number;
  suggestions: QuerySuggestion[];
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const detectIntent = (message: string): ParsedIntent => {
  const normalized = normalize(message);

  if (/\b(scatter|correlation|relationship)\b/.test(normalized)) return "correlation";
  if (/\b(trend|timeline|over time|monthly|daily|yearly|by month|by year)\b/.test(normalized)) return "trend";
  if (/\b(compare|comparison|versus|vs)\b/.test(normalized)) return "comparison";
  if (/\b(distribution|breakdown|share|split|pie)\b/.test(normalized)) return "distribution";
  if (/\b(sum|total|average|avg|max|min|highest|lowest|top|count)\b/.test(normalized)) return "aggregation";
  if (/\b(where|only|with|after|before|between)\b/.test(normalized)) return "filter";
  if (normalized.includes("?")) return "question";
  return "overview";
};

const detectMetric = (message: string) => {
  const normalized = normalize(message);

  if (/\b(sum|total)\b/.test(normalized)) return "sum";
  if (/\b(avg|average|mean)\b/.test(normalized)) return "average";
  if (/\b(max|highest|top|largest|most)\b/.test(normalized)) return "max";
  if (/\b(min|lowest|smallest|least)\b/.test(normalized)) return "min";
  return "count";
};

const detectChartHint = (message: string) => {
  const normalized = normalize(message);

  if (normalized.includes("scatter")) return "scatter";
  if (normalized.includes("pie")) return "pie";
  if (normalized.includes("line")) return "line";
  if (normalized.includes("area")) return "area";
  if (normalized.includes("bar")) return "bar";
  return undefined;
};

const detectColumns = (message: string, features?: ChatFeatures | null) => {
  if (!features?.columns?.length) return [];

  const normalized = normalize(message);
  return features.columns
    .map((column) => column.name)
    .filter((name) => normalized.includes(normalize(name)));
};

const deriveRecentTopics = (history: ChatContextEntry[]) =>
  history
    .filter((entry) => entry.role === "user")
    .slice(-4)
    .flatMap((entry) => entry.content.split(/\s+/))
    .map((token) => token.replace(/[^\w]/g, "").toLowerCase())
    .filter((token) => token.length > 3)
    .filter((token, index, tokens) => tokens.indexOf(token) === index)
    .slice(0, 6);

const buildSuggestions = (
  message: string,
  intent: ParsedIntent,
  columns: string[],
  features?: ChatFeatures | null,
) => {
  const suggestions: QuerySuggestion[] = [];

  if (!message.trim()) {
    features?.chartSuggestions?.slice(0, 3).forEach((chart) => {
      suggestions.push({
        type: "chart",
        label: chart.title,
        value: `Show ${chart.title.toLowerCase()}`,
        hint: `Open with a ${chart.type} chart`,
      });
    });

    return suggestions;
  }

  suggestions.push({
    type: "intent",
    label: intent,
    value: message,
    hint: `Detected intent: ${intent}`,
  });

  columns.slice(0, 2).forEach((column) => {
    suggestions.push({
      type: "column",
      label: column,
      value: `Show ${column} breakdown`,
      hint: `Explore ${column} in the current dataset`,
    });
  });

  if (features?.measures?.[0] && features?.dimensions?.[0]) {
    suggestions.push({
      type: "followup",
      label: `${features.measures[0].name} by ${features.dimensions[0].name}`,
      value: `Show ${features.measures[0].name} by ${features.dimensions[0].name}`,
      hint: "Useful next chart",
    });
  }

  return suggestions.slice(0, 4);
};

export const parseQueryMessage = (
  message: string,
  features?: ChatFeatures | null,
  history: ChatContextEntry[] = [],
): ParsedQueryResult => {
  const normalizedMessage = normalize(message);
  const intent = detectIntent(message);
  const columns = detectColumns(message, features);
  const recentTopics = deriveRecentTopics(history);
  const suggestions = buildSuggestions(message, intent, columns, features);

  return {
    normalizedMessage,
    intent,
    metric: detectMetric(message),
    chartHint: detectChartHint(message),
    columns,
    recentTopics,
    confidence: columns.length || message.trim() ? 0.72 : 0.3,
    suggestions,
  };
};
