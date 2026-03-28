import { env } from "../config/env.js";

const sanitizeJson = (text) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

const normalizeSuggestedCharts = (value) =>
  Array.isArray(value) ? value.filter((chart) => chart && typeof chart === "object") : [];

export const buildGeminiPrompt = ({
  message,
  history = [],
  features,
  analysis,
}) => {
  const historyText = history
    .slice(-6)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");

  return `
You are the InsightFlow AI analytics assistant.

Your job:
- Answer the user's question using only the provided dataset facts
- Keep the answer grounded in the computed analysis
- Suggest relevant chart types from: bar, line, pie, scatter, area
- Do not invent columns, values, or unsupported calculations

Current dataset:
- File: ${features.fileName}
- Rows: ${features.rowCount}
- Columns: ${features.columnCount}
- Schema: ${features.schema}

Column statistics:
${JSON.stringify(features.columns, null, 2)}

Historical and structural patterns:
${JSON.stringify(features.patterns, null, 2)}

Precomputed analysis for this question:
${JSON.stringify(analysis, null, 2)}

Recent chat context:
${historyText || "No prior history"}

User query:
${message}

Return JSON only with this shape:
{
  "answer": "Short markdown answer.",
  "insights": ["insight 1", "insight 2"],
  "suggestedCharts": [
    {
      "title": "Chart title",
      "type": "bar",
      "xKey": "name",
      "dataKey": "value",
      "data": [
        { "name": "A", "value": 10, "x": "A", "label": "A" }
      ]
    }
  ]
}
`.trim();
};

export const buildSafeFallback = ({ message, analysis, features }) => ({
  answer:
    analysis.summary ||
    `I analyzed ${features.fileName} for "${message}" using the current dataset features.`,
  insights: Array.isArray(analysis.highlights) && analysis.highlights.length
    ? analysis.highlights
    : features.patterns.slice(0, 3).map((pattern) => pattern.message),
  suggestedCharts: Array.isArray(analysis.suggestedCharts) && analysis.suggestedCharts.length
    ? analysis.suggestedCharts
    : features.chartSuggestions.slice(0, 3),
  source: "fallback",
});

export const callGeminiWithAnalysis = async ({
  message,
  history,
  features,
  analysis,
}) => {
  if (!env.geminiApiKey) {
    return buildSafeFallback({ message, analysis, features });
  }

  try {
    const response = await fetch(
      `${env.geminiApiUrl}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildGeminiPrompt({
                    message,
                    history,
                    features,
                    analysis,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini helper error ${response.status}:`, errorText.slice(0, 200));
      return buildSafeFallback({ message, analysis, features });
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

    if (!text) {
      return buildSafeFallback({ message, analysis, features });
    }

    const parsed = JSON.parse(sanitizeJson(text));

    return {
      answer: typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : buildSafeFallback({ message, analysis, features }).answer,
      insights: Array.isArray(parsed.insights)
        ? parsed.insights.map((item) => String(item))
        : buildSafeFallback({ message, analysis, features }).insights,
      suggestedCharts: normalizeSuggestedCharts(parsed.suggestedCharts),
      source: "gemini",
    };
  } catch (error) {
    console.error("Gemini helper failed:", error);
    return buildSafeFallback({ message, analysis, features });
  }
};
